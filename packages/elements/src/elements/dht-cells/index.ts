import { DhtOpHash } from '@holochain-open-dev/core-types';
import '@holochain-open-dev/elements/dist/elements/holo-identicon.js';
import { AsyncComputed, Signal } from '@holochain-open-dev/signals';
import { CellMap, HoloHashMap } from '@holochain-open-dev/utils';
import {
	BadAgent,
	NetworkRequestInfo,
	NetworkRequestType,
	PublishRequestInfo,
	WorkflowType,
	sleep,
} from '@holochain-playground/simulator';
import {
	AgentPubKey,
	DhtOp,
	decodeHashFromBase64,
	encodeHashToBase64,
	getDhtOpType,
} from '@holochain/client';
import { CytoscapeCircle } from '@scoped-elements/cytoscape';
import {
	Button,
	Card,
	Formfield,
	Icon,
	IconButton,
	ListItem,
	Menu,
	MenuSurface,
	Slider,
	Switch,
} from '@scoped-elements/material-web';
import { NodeSingular } from 'cytoscape';
import { PropertyValues, css, html } from 'lit';
import { property, query } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';
import uniq from 'lodash-es/uniq.js';

import { MiddlewareController } from '../../base/middleware-controller.js';
import { PlaygroundElement } from '../../base/playground-element.js';
import { CellStore } from '../../store/playground-store.js';
import {
	SimulatedCellStore,
	SimulatedPlaygroundStore,
} from '../../store/simulated-playground-store.js';
import { joinAsyncCellMap, mapCellValues } from '../../store/utils.js';
import { CellTasks } from '../helpers/cell-tasks.js';
import { HelpButton } from '../helpers/help-button.js';
import { sharedStyles } from '../utils/shared-styles.js';
import { cytoscapeOptions, layoutConfig } from './graph.js';
import {
	allPeersEdges,
	dhtCellsNodes,
	isHoldingElement,
	isHoldingEntry,
	simulatedNeighbors,
} from './processors.js';

const MIN_ANIMATION_DELAY = 1;
const MAX_ANIMATION_DELAY = 7;

/**
 * @element dht-cells
 */
export class DhtCells extends PlaygroundElement {
	@property({ type: Number })
	animationDelay: number = 2;

	@property({ type: Array })
	workflowsToDisplay: WorkflowType[] = [
		WorkflowType.CALL_ZOME,
		WorkflowType.APP_VALIDATION,
	];

	@property({ type: Array })
	networkRequestsToDisplay: NetworkRequestType[] = [
		NetworkRequestType.PUBLISH_REQUEST,
		NetworkRequestType.CALL_REMOTE,
		NetworkRequestType.WARRANT,
	];

	@property({ type: Boolean, attribute: 'hide-time-controller' })
	hideTimeController: boolean = false;

	@property({ type: Boolean, attribute: 'hide-filter' })
	hideFilter: boolean = false;

	@property({ type: Boolean, attribute: 'step-by-step' })
	stepByStep = false;

	@property({ type: Boolean, attribute: 'show-zome-fn-success' })
	showZomeFnSuccess = false;

	@query('#active-workflows-button')
	private _activeWorkflowsButton!: Button;
	@query('#active-workflows-menu')
	private _activeWorkflowsMenu!: Menu;

	@query('#network-requests-button')
	private _networkRequestsButton!: Button;
	@query('#network-requests-menu')
	private _networkRequestsMenu!: Menu;
	@query('#graph')
	private _graph!: CytoscapeCircle;

	_paused = new Signal.Computed(() =>
		this.store instanceof SimulatedPlaygroundStore
			? this.store?.paused.get()
			: false,
	);
	_badAgents = new AsyncComputed(() => {
		if (!(this.store instanceof SimulatedPlaygroundStore))
			return {
				status: 'completed',
				value: new CellMap<BadAgent | undefined>(),
			};

		const cellsForActiveDna = this.store.cellsForActiveDna.get();
		if (cellsForActiveDna.status !== 'completed') return cellsForActiveDna;

		const value = mapCellValues(
			cellsForActiveDna.value as CellMap<SimulatedCellStore>,
			(c: SimulatedCellStore) => c.conductorStore.badAgent.get(),
		);
		return {
			status: 'completed',
			value,
		};
	});
	_dhtShards = new AsyncComputed(() => {
		const cellsForActiveDna = this.store.cellsForActiveDna.get();
		if (cellsForActiveDna.status !== 'completed') return cellsForActiveDna;

		return joinAsyncCellMap(
			mapCellValues(cellsForActiveDna.value, (c: CellStore) =>
				c.dhtShard.get(),
			),
		);
	});
	_peers = new AsyncComputed(() => {
		const cellsForActiveDna = this.store.cellsForActiveDna.get();
		if (cellsForActiveDna.status !== 'completed') return cellsForActiveDna;

		return joinAsyncCellMap(
			mapCellValues(cellsForActiveDna.value, (c: CellStore) => c.peers.get()),
		);
	});
	_farPeers = new AsyncComputed(() => {
		if (!(this.store instanceof SimulatedPlaygroundStore))
			return {
				status: 'completed',
				value: new CellMap<AgentPubKey[]>(),
			};
		const cellsForActiveDna = this.store.cellsForActiveDna.get();
		if (cellsForActiveDna.status !== 'completed') return cellsForActiveDna;

		const value = mapCellValues(
			cellsForActiveDna.value,
			(c: SimulatedCellStore) => c.farPeers.get(),
		);
		return {
			status: 'completed',
			value,
		};
	});
	_recognizedBadActors = new AsyncComputed(() => {
		if (!(this.store instanceof SimulatedPlaygroundStore))
			return {
				status: 'completed',
				value: new CellMap<AgentPubKey[]>(),
			};
		const cellsForActiveDna = this.store.cellsForActiveDna.get();
		if (cellsForActiveDna.status !== 'completed') return cellsForActiveDna;

		const value = mapCellValues(
			cellsForActiveDna.value,
			(c: SimulatedCellStore) => c.badAgents.get(),
		);
		return {
			status: 'completed',
			value,
		};
	});

	_middlewares!: MiddlewareController;

	highlightNodesWithEntry() {
		if (!this._graph || !this._graph.cy) return;
		const cellsForActiveDna = this.store.cellsForActiveDna.get();
		const dhtShards = this._dhtShards.get();
		if (cellsForActiveDna.status !== 'completed') return;
		if (dhtShards.status !== 'completed') return;

		cellsForActiveDna.value.cellIds().forEach(([_, agentPubKey]) => {
			this._graph.cy
				.getElementById(encodeHashToBase64(agentPubKey))
				.removeClass('highlighted');
		});

		const activeDhtHash = this.store.activeDhtHash.get();

		if (activeDhtHash) {
			const holdingCells = dhtShards.value.filter(
				dhtShard =>
					isHoldingEntry(dhtShard, activeDhtHash) ||
					isHoldingElement(dhtShard, activeDhtHash),
			);

			for (const [_, agentPubKey] of holdingCells.cellIds()) {
				this._graph.cy
					.getElementById(encodeHashToBase64(agentPubKey))
					.addClass('highlighted');
			}
		}
	}

	async beforeNetworkRequest(networkRequest: NetworkRequestInfo<any, any>) {
		const store = this.store as unknown as SimulatedPlaygroundStore;

		if (!this.networkRequestsToDisplay.includes(networkRequest.type)) return;
		if (
			networkRequest.toAgent.toString() === networkRequest.fromAgent.toString()
		)
			return;

		if (!this._graph.cy) return;

		const fromNode = this._graph.cy.getElementById(
			encodeHashToBase64(networkRequest.fromAgent),
		);
		if (!fromNode.position()) return;
		const toNode = this._graph.cy.getElementById(
			encodeHashToBase64(networkRequest.toAgent),
		);

		const fromPosition = fromNode.position();
		const toPosition = toNode.position();

		let label = networkRequest.type;
		if (networkRequest.type === NetworkRequestType.PUBLISH_REQUEST) {
			const dhtOps: HoloHashMap<DhtOpHash, DhtOp> = (
				networkRequest as PublishRequestInfo
			).details.dhtOps;

			const types = Array.from(dhtOps.values()).map(dhtOp =>
				getDhtOpType(dhtOp),
			);

			label = `Publish: ${uniq(types).join(', ')}`;
		}

		const el = this._graph.cy.add([
			{
				group: 'nodes',
				data: {
					networkRequest,
					label,
				},
				position: { x: fromPosition.x + 1, y: fromPosition.y + 1 },
				classes: 'network-request',
			},
		]);

		const delay = this.animationDelay * 1000;
		if (this.stepByStep) {
			const halfPosition = {
				x: (toPosition.x - fromPosition.x) / 2 + fromPosition.x,
				y: (toPosition.y - fromPosition.y) / 2 + fromPosition.y,
			};
			el.animate({
				position: halfPosition,
				duration: delay / 2,
			});

			await sleep(delay / 2);

			store.paused.pause();

			await store.paused.awaitResume();

			el.animate({
				position: toPosition,
				duration: delay / 2,
			});

			await sleep(delay / 2);
		} else {
			el.animate({
				position: toNode.position(),
				duration: delay,
			});

			await sleep(delay);
		}
		this._graph.cy.remove(el);
	}

	updated(changedValues: PropertyValues) {
		super.updated(changedValues);

		this.highlightNodesWithEntry();

		(this._graph?.cy?.style() as any)?.selector('.cell').style({
			opacity: this._paused.get() ? 0.4 : 1,
		});

		if (
			changedValues.has('store') &&
			!this._middlewares &&
			this.store &&
			this.store instanceof SimulatedPlaygroundStore
		) {
			const cellsForActiveDna = this.store.cellsForActiveDna.get();
			if (cellsForActiveDna.status === 'completed') {
				this._middlewares = new MiddlewareController(
					this,
					() => cellsForActiveDna.value.map((s: SimulatedCellStore) => s.cell),
					{
						networkRequests: {
							before: n => this.beforeNetworkRequest(n),
						},
					},
				);
			}
		}
	}

	get elements() {
		const cellsForActiveDna = this.store.cellsForActiveDna.get();
		const badAgents = this._badAgents.get();
		if (cellsForActiveDna.status !== 'completed') return [];
		if (badAgents.status !== 'completed') return [];

		const nodes = dhtCellsNodes(cellsForActiveDna.value, badAgents.value);

		let edges = [];

		const peers = this._peers.get();
		const farPeers = this._farPeers.get();
		const recognizedBadActors = this._recognizedBadActors.get();

		if (
			peers.status === 'completed' &&
			farPeers.status === 'completed' &&
			recognizedBadActors.status === 'completed'
		) {
			if (this.store instanceof SimulatedPlaygroundStore) {
				edges = simulatedNeighbors(
					cellsForActiveDna.value,
					peers.value,
					farPeers.value,
					recognizedBadActors.value,
				);
			} else {
				edges = allPeersEdges(cellsForActiveDna.value, peers.value);
			}
		}

		return [...nodes, ...edges];
	}

	renderTimeController() {
		if (
			this.hideTimeController ||
			!(this.store instanceof SimulatedPlaygroundStore)
		)
			return html``;

		const store: SimulatedPlaygroundStore = this.store;

		return html`
			<div class="row center-content">
				${this.stepByStep
					? html`
							<mwc-icon-button
								.disabled=${!this._paused.get()}
								icon="play_arrow"
								style=${styleMap({
									'background-color': this._paused.get() ? '#dbdbdb' : 'white',
									'border-radius': '50%',
								})}
								@click=${() => store.paused.resume()}
							></mwc-icon-button>
						`
					: html`
							<mwc-slider
								style="margin-right: 16px; width: 150px;"
								discrete
								withTickMarks
								.value=${MAX_ANIMATION_DELAY - this.animationDelay}
								.valueEnd=${MAX_ANIMATION_DELAY - this.animationDelay}
								.min=${MIN_ANIMATION_DELAY}
								.max=${MAX_ANIMATION_DELAY}
								@change=${(e: any) =>
									(this.animationDelay = MAX_ANIMATION_DELAY - e.target.value)}
							></mwc-slider>
							<mwc-icon style="margin: 0 8px;">speed</mwc-icon>
						`}

				<span
					class="vertical-divider"
					style="margin: 0 16px; margin-right: 24px;"
				></span>

				<mwc-formfield label="Step By Step" style="margin-right: 16px;">
					<mwc-switch
						id="step-by-step-switch"
						.checked=${this.stepByStep}
						@change=${(e: any) => {
							this.stepByStep = e.target.checked;
							if (this._paused.get()) store.paused.resume();
						}}
					></mwc-switch>
				</mwc-formfield>
			</div>
		`;
	}

	renderHelp() {
		const cellsForActiveDna = this.store.cellsForActiveDna.get();

		return html`
			<help-button heading="DHT Cells" class="block-help">
				<span>
					This is a visual interactive representation of a holochain
					<a
						href="https://developer.holochain.org/docs/concepts/4_public_data_on_the_dht/"
						target="_blank"
						>Dht</a
					>, with
					${cellsForActiveDna.status === 'completed'
						? cellsForActiveDna.value?.cellIds().length
						: ``}
					nodes.
					<br />
					<br />
					In the DHT, all nodes have a <strong>public and private key</strong>.
					The public key is visible and shared througout the network, but
					private keys never leave their nodes. This public key is of 256 bits
					an it's actually the node's ID, which you can see labeled besides the
					nodes (encoded in base58 strings).
					<br />
					<br />
					If you pay attention, you will see that
					<strong>all nodes in the DHT are ordered alphabetically</strong>. This
					is because the nodes organize themselves in neighborhoods: they are
					more connected with the nodes that are closest to their ID, and less
					connected with the nodes that are far.
				</span>
			</help-button>
		`;
	}

	renderTasksTooltips() {
		const cellsForActiveDna = this.store.cellsForActiveDna.get();

		const activeDna = this.store.activeDna.get();

		if (
			cellsForActiveDna.status !== 'completed' ||
			activeDna == undefined ||
			!(this.store instanceof SimulatedPlaygroundStore) ||
			!this._graph ||
			!this._graph.cy
		)
			return html``;

		// Get the nodes but filter out the temporal network request ones
		const nodes = this._graph.cy.nodes().filter(node => {
			if (node.data().networkRequest) return false;
			if (!activeDna) return false;

			const agentPubKey = node.id();
			return cellsForActiveDna.value.has([
				activeDna,
				decodeHashFromBase64(agentPubKey),
			]);
		});
		const cellsWithPosition = nodes.map(node => {
			const agentPubKey = node.id();

			const cellStore = cellsForActiveDna.value.get([
				activeDna,
				decodeHashFromBase64(agentPubKey),
			]) as SimulatedCellStore;

			const cell = cellStore.cell;

			return { cell, position: (node as NodeSingular).renderedPosition() };
		});

		return html`${cellsWithPosition.map(({ cell, position }) => {
			const leftSide = this._graph.cy.width() / 2 > position.x;
			const upSide = this._graph.cy.height() / 2 > position.y;

			const finalX = position.x + (leftSide ? -250 : 50);
			const finalY = position.y + (upSide ? -50 : 50);

			return html`<cell-tasks
				.workflowsToDisplay=${this.workflowsToDisplay}
				.workflowDelay=${this.animationDelay * 1000}
				.cell=${cell}
				style=${styleMap({
					top: `${finalY}px`,
					left: `${finalX}px`,
					position: 'absolute',
					'z-index': '30',
				})}
				.stepByStep=${this.stepByStep}
				.showZomeFnSuccess=${this.showZomeFnSuccess}
			>
			</cell-tasks>`;
		})}`;
	}

	renderBottomToolbar() {
		if (!(this.store instanceof SimulatedPlaygroundStore)) return html``;

		const workflowsNames = Object.values(WorkflowType);
		const networkRequestNames = Object.values(NetworkRequestType);
		return html`
			<div class="row center-content" style="margin: 16px; position: relative;">
				${this.hideFilter
					? html``
					: html`
							<mwc-button
								label="Visible Worfklows"
								style="--mdc-theme-primary: rgba(0,0,0,0.7);"
								icon="arrow_drop_down"
								id="active-workflows-button"
								trailingIcon
								@click=${() => this._activeWorkflowsMenu.show()}
							></mwc-button>
							<mwc-menu
								corner="BOTTOM_END"
								multi
								activatable
								id="active-workflows-menu"
								.anchor=${this._activeWorkflowsButton}
								@selected=${(e: any) =>
									(this.workflowsToDisplay = [...e.detail.index].map(
										index => workflowsNames[index],
									))}
							>
								${workflowsNames.map(
									type => html`
										<mwc-list-item
											graphic="icon"
											.selected=${this.workflowsToDisplay.includes(
												type as WorkflowType,
											)}
											.activated=${this.workflowsToDisplay.includes(
												type as WorkflowType,
											)}
										>
											${this.workflowsToDisplay.includes(type as WorkflowType)
												? html` <mwc-icon slot="graphic">check</mwc-icon> `
												: html``}
											${type}
										</mwc-list-item>
									`,
								)}
							</mwc-menu>

							<mwc-button
								label="Visible Network Requests"
								style="--mdc-theme-primary: rgba(0,0,0,0.7);"
								icon="arrow_drop_down"
								id="network-requests-button"
								trailingIcon
								@click=${() => this._networkRequestsMenu.show()}
							></mwc-button>
							<mwc-menu
								corner="BOTTOM_END"
								multi
								activatable
								id="network-requests-menu"
								.anchor=${this._networkRequestsButton}
								@selected=${(e: any) =>
									(this.networkRequestsToDisplay = [...e.detail.index].map(
										index => networkRequestNames[index],
									))}
							>
								${networkRequestNames.map(
									type => html`
										<mwc-list-item
											graphic="icon"
											.selected=${this.networkRequestsToDisplay.includes(
												type as NetworkRequestType,
											)}
											.activated=${this.networkRequestsToDisplay.includes(
												type as NetworkRequestType,
											)}
										>
											${this.networkRequestsToDisplay.includes(
												type as NetworkRequestType,
											)
												? html` <mwc-icon slot="graphic">check</mwc-icon> `
												: html``}
											${type}
										</mwc-list-item>
									`,
								)}
							</mwc-menu>
						`}

				<span style="flex: 1;"></span>

				${this.renderTimeController()}
			</div>
		`;
	}

	get selectedNodesIds() {
		if (!this.store.activeAgentPubKey.get()) return [];
		return [encodeHashToBase64(this.store.activeAgentPubKey.get()!)];
	}

	render() {
		const activeDna = this.store.activeDna.get();

		return html`
			<mwc-card class="block-card" style="position: relative;">
				${this.renderHelp()} ${this.renderTasksTooltips()}
				<div class="column fill">
					<div class="block-title row" style="margin: 16px;">
						Dht Cells
						${activeDna
							? html`
									<div class="placeholder row">
										<span>, for Dna</span>
										<holo-identicon
											.hash=${activeDna}
											style="margin-left: 8px;"
										></holo-identicon>
									</div>
								`
							: html``}
					</div>
					<cytoscape-circle
						id="graph"
						class="fill ${classMap({
							paused: this._paused.get(),
						})}"
						.elements=${this.elements}
						.options=${cytoscapeOptions}
						.circleOptions=${layoutConfig}
						@node-selected=${(e: CustomEvent) =>
							this.store.activeAgentPubKey.set(
								decodeHashFromBase64(e.detail.id()),
							)}
						.selectedNodesIds=${this.selectedNodesIds}
					></cytoscape-circle>
					${this.renderBottomToolbar()}
				</div>
			</mwc-card>
		`;
	}

	static get styles() {
		return [
			sharedStyles,
			css`
				:host {
					min-height: 350px;
					min-width: 400px;
					display: flex;
				}

				.paused {
					background-color: #dbdbdba0;
				}
			`,
		];
	}

	static get scopedElements() {
		return {
			'mwc-card': Card,
			'mwc-menu-surface': MenuSurface,
			'mwc-button': Button,
			'mwc-icon': Icon,
			'mwc-menu': Menu,
			'mwc-list-item': ListItem,
			'mwc-slider': Slider,
			'mwc-switch': Switch,
			'mwc-formfield': Formfield,
			'mwc-icon-button': IconButton,
			'cytoscape-circle': CytoscapeCircle,
			'help-button': HelpButton,
			'cell-tasks': CellTasks,
		};
	}
}
