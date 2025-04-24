import '@alenaksu/json-viewer';
import '@darksoil-studio/holochain-elements/dist/elements/holo-identicon.js';
import { AsyncComputed } from '@darksoil-studio/holochain-signals';
import {
	AppInfoStatus,
	CellInfo,
	CellType,
	DnaHash,
	DnaHashB64,
	decodeHashFromBase64,
	encodeHashToBase64,
} from '@holochain/client';
import { decode } from '@msgpack/msgpack';
import '@shoelace-style/shoelace/dist/components/button/button.js';
import '@shoelace-style/shoelace/dist/components/card/card.js';
import '@shoelace-style/shoelace/dist/components/details/details.js';
import '@shoelace-style/shoelace/dist/components/divider/divider.js';
import '@shoelace-style/shoelace/dist/components/icon-button/icon-button.js';
import '@shoelace-style/shoelace/dist/components/tab-group/tab-group.js';
import '@shoelace-style/shoelace/dist/components/tab-panel/tab-panel.js';
import '@shoelace-style/shoelace/dist/components/tab/tab.js';
import '@shoelace-style/shoelace/dist/components/tag/tag.js';
import '@vaadin/grid';
import '@vaadin/grid/vaadin-grid-column.js';
import { PropertyValues, css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { join } from 'lit/directives/join.js';

import { PlaygroundElement } from '../../base/playground-element.js';
import {
	ConnectedConductorStore,
	ConnectedPlaygroundStore,
} from '../../store/connected-playground-store.js';
import { CellStore, ConductorStore } from '../../store/playground-store.js';
import {
	SimulatedCellStore,
	SimulatedConductorStore,
	SimulatedPlaygroundStore,
} from '../../store/simulated-playground-store.js';
import { cellCount, cellName, dnaHash, dnaModifiers } from '../../utils.js';
import '../helpers/call-functions.js';
import '../helpers/help-button.js';
import { shortenStrRec } from '../utils/hash.js';
import { sharedStyles } from '../utils/shared-styles.js';
import '../validation-queue/vaadin-grid-template-renderer-column.js';

@customElement('conductor-happs')
export class ConductorHapps extends PlaygroundElement {
	@property({ type: Boolean, attribute: 'hide-header' })
	hideHeader: boolean = false;

	@property({ type: Boolean, attribute: 'hide-dna-modifiers' })
	hideDnaModifiers: boolean = false;

	_activeConductor = new AsyncComputed(() => {
		const activeCell = this.store.activeCell.get();
		if (activeCell.status !== 'completed') return activeCell;

		const conductor = activeCell.value?.conductorStore;
		return {
			status: 'completed',
			value: conductor,
		};
	});

	get isSimulated() {
		return this.store && this.store instanceof SimulatedPlaygroundStore;
	}

	renderHelp() {
		const activeAgentPubKey = this.store.activeAgentPubKey.get();
		return html`
			<help-button heading="Conductor Happs Help">
				<span>
					You've selected the conductor with Agent ID
					${activeAgentPubKey
						? encodeHashToBase64(activeAgentPubKey)
						: undefined}.
					Here you can see all happs it has installed, and their cells. Select
					one of the cells to select that network.
				</span>
			</help-button>
		`;
	}

	renderHappStatus(status: AppInfoStatus) {
		if (status.type === 'running') {
			return html`<sl-tag variant="success">Running</sl-tag>`;
		}
		if (status.type === 'awaiting_memproofs') {
			return html`<sl-tag variant="neutral">Awaiting Memproofs</sl-tag>`;
		}

		if (status.type === 'disabled') {
			return html`<sl-tag variant="danger">Disabled</sl-tag>`;
		}
		if (status.type === 'paused') {
			return html`<sl-tag variant="warning">Paused</sl-tag>`;
		}
	}

	renderCells(cells: Record<string, CellInfo[]>) {
		const cellInfos = ([] as CellInfo[]).concat(...Object.values(cells));
		const activeDna = this.store.activeDna.get();
		const items = cellInfos.map(cellInfo => ({
			role: cellName(cellInfo),
			dnaHash: encodeHashToBase64(dnaHash(cellInfo)),
			networkSeed: dnaModifiers(cellInfo).network_seed,
			properties: decode(dnaModifiers(cellInfo).properties),
			isActive:
				activeDna &&
				encodeHashToBase64(activeDna) === encodeHashToBase64(dnaHash(cellInfo)),
		}));
		return html`
			<vaadin-grid style="flex: 1" .items=${items} .allRowsVisible=${true}>
				<vaadin-grid-sort-column
					path="role"
					header="Role"
					width="180px"
					flex-grow="${this.hideDnaModifiers ? '1' : '0'}"
				></vaadin-grid-sort-column>
				${this.hideDnaModifiers
					? html``
					: html`
							<vaadin-grid-column
								path="networkSeed"
								header="Net.Seed"
								flex-grow="0"
							></vaadin-grid-column>
							<vaadin-grid-template-renderer-column
								header="Properties"
								flex-grow="1"
								.getId=${(item: any) => `${item.dnaHash}`}
								.templateRenderer=${(item: any) => html`
									<json-viewer .data=${shortenStrRec(item.properties)}>
									</json-viewer>
								`}
							></vaadin-grid-template-renderer-column>
						`}
				<vaadin-grid-template-renderer-column
					header="DNA Hash"
					flex-grow="0"
					.autoWidth=${true}
					.getId=${(item: any) => item.dnaHash}
					.templateRenderer=${(item: any) =>
						html`<div
							style="display: flex; flex-direction: row; align-items: center; justify-content: center"
						>
							<holo-identicon hash="${item.dnaHash}"></holo-identicon>
						</div>`}
				></vaadin-grid-template-renderer-column>
				<vaadin-grid-template-renderer-column
					.autoWidth=${true}
					flex-grow="0"
					.getId=${(item: any) => `${item.isActive}${item.dnaHash}`}
					.templateRenderer=${(item: any) =>
						item.isActive
							? html`
									<sl-button disabled style="width: 6em" variant="primary"
										>Active Dna
									</sl-button>
								`
							: html`
									<sl-button
										style="width: 6em"
										variant="primary"
										@click=${() => {
											this.store.activeDna.set(
												decodeHashFromBase64(item.dnaHash),
											);
										}}
										>Select
									</sl-button>
								`}
				></vaadin-grid-template-renderer-column>
			</vaadin-grid>
		`;
	}

	renderHapps(conductorStore: ConductorStore<any>) {
		const happs = conductorStore.happs.get();

		switch (happs.status) {
			case 'pending':
				return html`<div
					class="column"
					style="align-items: center; justify-content: center; flex: 1"
				>
					<sl-spinner></sl-spinner>
				</div> `;
			case 'error':
				return html`
					<div
						class="column"
						style="align-items: center; justify-content: center; flex: 1"
					>
						<display-error
							.error=${happs.error}
							headline="Error getting the hApps"
						></display-error>
					</div>
				`;
			case 'completed':
				return html`
					<div class="flex-scrollable-parent" style="flex: 1">
						<div class="flex-scrollable-container">
							<div class="flex-scrollable-y">
								${happs.value.map(
									appInfo =>
										html`<sl-details>
											<div
												slot="summary"
												class="row"
												style="flex: 1; gap: 16px; align-items: center; margin-right: 16px"
											>
												<span>${appInfo.installed_app_id}</span>

												<span style="flex: 1"></span>

												<div class="row" style="gap: 8px; align-items: center">
													<span class="placeholder">Agent:</span>
													<holo-identicon
														.hash=${appInfo.agent_pub_key}
														style="height: 32px"
													></holo-identicon>
												</div>

												${this.renderHappStatus(appInfo.status)}

												<span class="placeholder"
													>${cellCount(appInfo)}
													${cellCount(appInfo) === 1 ? 'cell' : 'cells'}</span
												>
											</div>

											${this.renderCells(appInfo.cell_info)}
										</sl-details>`,
								)}
							</div>
						</div>
					</div>
				`;
		}
	}

	renderContent() {
		const activeConductor = this._activeConductor.get();

		if (activeConductor.status !== 'completed' || !activeConductor.value)
			return html`
				<div class="column fill center-content">
					<span class="placeholder"
						>Select a cell to inspect its conductor.</span
					>
				</div>
			`;
		return html`
			<div class="column" style="flex: 1">
				${this.renderHapps(activeConductor.value)}
			</div>
		`;
	}

	renderName() {
		const activeConductor = this._activeConductor.get();
		if (activeConductor.status !== 'completed' || !activeConductor.value)
			return '';
		if (this.isSimulated)
			return (activeConductor.value as SimulatedConductorStore).name;
		return (activeConductor.value as ConnectedConductorStore).url;
	}

	render() {
		const activeConductor = this._activeConductor.get();
		return html`
			<div class="column fill" style="gap: 8px">
				${this.hideHeader
					? html``
					: html`
							<div class="row" style="align-items: center;">
								<span class="title">Conductor hApps</span>
								${activeConductor.status === 'completed' &&
								activeConductor.value
									? html`<span class="placeholder"
											>, for ${this.renderName()}</span
										>`
									: html``}

								<div style="flex: 1;"></div>
								${this.renderHelp()}
							</div>
						`}
				${this.renderContent()}
			</div>
		`;
	}

	static get styles() {
		return [
			sharedStyles,
			css`
				:host {
					display: flex;
					flex: 1;
					min-height: 300px;
				}
				.bottom-border {
					border-bottom: 1px solid lightgrey;
				}
				sl-details::part(content) {
					padding: 0;
				}
			`,
		];
	}
}
