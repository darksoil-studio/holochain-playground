import {
	Cell,
	SimulatedDna,
	SimulatedZome,
} from '@holochain-playground/simulator';
import { decodeHashFromBase64, encodeHashToBase64 } from '@holochain/client';
import { mdiAlertOutline, mdiCheckCircleOutline } from '@mdi/js';
import '@power-elements/json-viewer';
import '@shoelace-style/shoelace/dist/components/card/card.js';
import '@shoelace-style/shoelace/dist/components/icon/icon.js';
import '@shoelace-style/shoelace/dist/components/spinner/spinner.js';
import '@shoelace-style/shoelace/dist/components/tab-group/tab-group.js';
import '@shoelace-style/shoelace/dist/components/tab-panel/tab-panel.js';
import '@shoelace-style/shoelace/dist/components/tab/tab.js';
import { wrapPathInSvg } from '@tnesh-stack/elements';
import '@tnesh-stack/elements/dist/elements/holo-identicon.js';
import { CellMap, isHash } from '@tnesh-stack/utils';
import { css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { cloneDeepWith } from 'lodash-es';

import { PlaygroundElement } from '../../base/playground-element.js';
import {
	SimulatedCellStore,
	SimulatedConductorStore,
	SimulatedPlaygroundStore,
} from '../../store/simulated-playground-store.js';
import { CallFns, CallableFn } from '../helpers/call-functions.js';
import '../helpers/call-functions.js';
import '../helpers/expandable-line.js';
import { shortenStrRec } from '../utils/hash.js';
import { sharedStyles } from '../utils/shared-styles.js';
import { ZomeFunctionResult } from './types.js';

type Dictionary<T> = Record<string, T>;

/**
 * @element call-zome-fns
 */
@customElement('call-zome-fns')
export class CallZomeFns extends PlaygroundElement<SimulatedPlaygroundStore> {
	@property({ type: Boolean, attribute: 'hide-zome-selector' })
	hideZomeSelector = false;
	@property({ type: Boolean, attribute: 'hide-agent-pub-key' })
	hideAgentPubKey = false;
	@property({ type: String })
	selectedZomeFnName: string | undefined = undefined;

	@state()
	private _selectedZomeIndex: number = 0;

	// Arguments segmented by dnaHash/agentPubKey/zome/fn_name/arg_name
	_arguments: CellMap<Dictionary<Dictionary<Dictionary<any>>>> = new CellMap();
	// Results segmented by dnaHash/agentPubKey/timestamp
	_results: CellMap<ZomeFunctionResult[]> = new CellMap();

	get dna(): SimulatedDna | undefined {
		const activeCell = this.store.activeCell.get();
		if (activeCell.status !== 'completed') return undefined;
		return activeCell.value?.dna;
	}

	async callZomeFunction(
		zome: SimulatedZome,
		fnName: string,
		args: Dictionary<any>,
	) {
		const activeCell = this.store.activeCell.get();
		if (activeCell.status !== 'completed' || !activeCell.value || !zome) return;

		const cellId = activeCell.value.cellId;
		if (!this._results.get(cellId)) this._results.set(cellId, []);
		const zomeFnResult: ZomeFunctionResult = {
			cellId,
			zome: zome.name,
			fnName,
			payload: args,
			timestamp: Date.now(),
			result: undefined,
		};
		this._results.get(cellId)!.push(zomeFnResult);

		this.requestUpdate();
		const conductor = (
			activeCell.value.conductorStore as SimulatedConductorStore
		).conductor;

		try {
			const deserializedPayload = cloneDeepWith(args, value => {
				if (typeof value === 'string' && isHash(value)) {
					return decodeHashFromBase64(value);
				}
			});

			let result = await conductor.callZomeFn({
				cellId: activeCell.value.cellId,
				zome: zome.name,
				payload: deserializedPayload,
				fnName,
				cap: new Uint8Array([]),
			});

			result = cloneDeepWith(result, value => {
				if (
					typeof value === 'object' &&
					value &&
					value.buffer &&
					ArrayBuffer.isView(value)
				) {
					return encodeHashToBase64(value as Uint8Array);
				}
			});

			const index = this._results
				.get(cellId)!
				.findIndex(r => r === zomeFnResult);
			this._results.get(cellId)![index].result = {
				success: true,
				payload: result,
			};

			this.requestUpdate();
		} catch (e) {
			const index = this._results
				.get(cellId)!
				.findIndex(r => r === zomeFnResult);
			this._results.get(cellId)![index].result = {
				success: false,
				payload: (e as any).message,
			};

			this.requestUpdate();
		}
	}

	renderActiveZomeFns(zome: SimulatedZome) {
		const zomeFns = Object.entries(zome.zome_functions);

		if (zomeFns.length === 0)
			return html`<div class="fill center-content">
				<span class="placeholder" style="padding: 24px;"
					>This zome has no functions</span
				>
			</div> `;

		const fns: Array<CallableFn> = zomeFns.map(zomeFn => ({
			name: zomeFn[0],
			args: zomeFn[1].arguments.map(arg => ({ ...arg, field: 'textfield' })),
			call: args => this.callZomeFunction(zome, zomeFn[0], args),
		}));

		return html` <call-functions .callableFns=${fns}></call-functions> `;
	}

	getActiveResults(): Array<ZomeFunctionResult> {
		const activeCell = this.store.activeCell.get();
		if (activeCell.status !== 'completed' || !activeCell.value) return [];

		if (!this._results.has(activeCell.value.cellId)) return [];

		return this._results.get(activeCell.value.cellId) || [];
	}

	renderResult(result: ZomeFunctionResult) {
		if (!result.result)
			return html`<span class="placeholder">Executing...</span>`;

		const payload = result.result.payload
			? shortenStrRec(result.result.payload)
			: undefined;
		if (!result.result.payload || typeof payload === 'string')
			return html`<span>${payload}</span>`;
		else
			return html`
				<expandable-line>
					<json-viewer .object=${payload} class="fill"></json-viewer>
				</expandable-line>
			`;
	}

	renderResults() {
		const results = this.getActiveResults();
		return html`
			<div class="column" style="flex: 1; margin: 16px">
				<span class="title row">Results </span>
				${results.length === 0
					? html`
							<div class="row fill center-content">
								<span class="placeholder" style="margin: 0 24px;"
									>Call a ZomeFn to see its results</span
								>
							</div>
						`
					: html` <div class="flex-scrollable-parent">
							<div class="flex-scrollable-container">
								<div class="flex-scrollable-y">
									<div style="margin: 0 16px;">
										${results.map(
											(result, index) => html`
												<div class="column" style="flex: 1;">
													<div class="row" style="margin: 8px 0;">
														${result.result
															? html`
																	<sl-icon
																		style=${styleMap({
																			color: result.result.success
																				? 'green'
																				: 'red',
																			'align-self': 'start',
																			'margin-top': '16px',
																			'font-size': '36px',
																		})}
																		.src=${wrapPathInSvg(
																			result.result.success
																				? mdiCheckCircleOutline
																				: mdiAlertOutline,
																		)}
																	></sl-icon>
																`
															: html`
																	<sl-spinner
																		style="align-self: center;"
																	></sl-spinner>
																`}
														<div
															class="column"
															style="flex: 1; margin: 12px; margin-right: 0;"
														>
															<div class="row" style="flex: 1;">
																<span style="flex: 1; margin-bottom: 8px;">
																	${result.fnName}
																	<span class="placeholder">
																		in ${result.zome}
																		zome${result.result
																			? result.result.success
																				? ', result:'
																				: ', error:'
																			: ''}
																	</span>
																</span>
																<span class="placeholder">
																	${new Date(
																		result.timestamp,
																	).toLocaleTimeString()}
																</span>
															</div>
															${this.renderResult(result)}
														</div>
													</div>
													${index < results.length - 1
														? html`
																<span
																	class="horizontal-divider"
																	style="align-self: center;"
																></span>
															`
														: html``}
												</div>
											`,
										)}
									</div>
								</div>
							</div>
						</div>`}
			</div>
		`;
	}

	render() {
		const activeCell = this.store.activeCell.get();
		return html`
			<sl-card style="width: auto; flex: 1;">
				${activeCell.status === 'completed' && activeCell.value
					? html`
							<div class="column" style="flex: 1">
								<span class="title row" style="margin: 16px; margin-bottom: 0;"
									>Call Zome
									Fns${this.hideAgentPubKey
										? html``
										: html`<span class="placeholder row"
												>, for agent
												<holo-identicon
													.hash=${activeCell.value.cellId[1]}
													style="margin-left: 8px;"
												></holo-identicon
											></span> `}</span
								>
								<span
									class="horizontal-divider"
									style="margin-top: 16px"
								></span>

								<div class="row" style="flex: 1;">
									<div class="column" style="flex: 1">
										${this.hideZomeSelector
											? html``
											: html`
													<sl-tab-group
														.activeIndex=${this._selectedZomeIndex}
														@MDCTabBar:activated=${(e: CustomEvent) => {
															this.selectedZomeFnName = undefined;
															this._selectedZomeIndex = e.detail.index;
														}}
													>
														${this.dna?.zomes.map(
															zome => html`
																<sl-tab slot="nav" .panel=${zome.name}
																	>${zome.name}</sl-tab
																>
																<sl-tab-panel name=${zome.name}>
																	${this.renderActiveZomeFns(zome)}
																</sl-tab-panel>
															`,
														)}
													</sl-tab-group>
												`}
									</div>

									<span class="vertical-divider"></span>

									${this.renderResults()}
								</div>
							</div>
						`
					: html`<div class="fill center-content placeholder">
							<span style="padding: 24px;"
								>Select a cell to call its zome functions</span
							>
						</div>`}
			</sl-card>
		`;
	}

	static get styles() {
		return [
			sharedStyles,
			css`
				:host {
					display: flex;
					flex: 1;
				}
			`,
		];
	}
}
