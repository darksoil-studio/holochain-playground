import {
	BadAgent,
	NetworkRequestInfo,
	NetworkRequestType,
	PublishRequestInfo,
	WorkflowType,
	getDhtOpType,
	isWarrantOp,
	sleep,
} from '@holochain-playground/simulator';
import {
	AgentPubKey,
	ChainOp,
	DhtOp,
	decodeHashFromBase64,
	encodeHashToBase64,
} from '@holochain/client';
import { mdiCog, mdiLanConnect, mdiPlay, mdiSpeedometer } from '@mdi/js';
import '@scoped-elements/cytoscape';
import { CytoscapeCircle } from '@scoped-elements/cytoscape';
import SlButton from '@shoelace-style/shoelace/dist/components/button/button.js';
import '@shoelace-style/shoelace/dist/components/button/button.js';
import '@shoelace-style/shoelace/dist/components/card/card.js';
import '@shoelace-style/shoelace/dist/components/divider/divider.js';
import '@shoelace-style/shoelace/dist/components/dropdown/dropdown.js';
import '@shoelace-style/shoelace/dist/components/icon-button/icon-button.js';
import '@shoelace-style/shoelace/dist/components/icon-button/icon-button.js';
import '@shoelace-style/shoelace/dist/components/icon/icon.js';
import '@shoelace-style/shoelace/dist/components/input/input.js';
import '@shoelace-style/shoelace/dist/components/menu-item/menu-item.js';
import '@shoelace-style/shoelace/dist/components/menu/menu.js';
import SlMenu from '@shoelace-style/shoelace/dist/components/menu/menu.js';
import '@shoelace-style/shoelace/dist/components/range/range.js';
import '@shoelace-style/shoelace/dist/components/range/range.js';
import '@shoelace-style/shoelace/dist/components/switch/switch.js';
import { DhtOpHash } from '@tnesh-stack/core-types';
import { wrapPathInSvg } from '@tnesh-stack/elements';
import '@tnesh-stack/elements/dist/elements/holo-identicon.js';
import { AsyncComputed, Signal, watch } from '@tnesh-stack/signals';
import { CellMap, HoloHashMap } from '@tnesh-stack/utils';
import { ElementDefinition, NodeDefinition, NodeSingular } from 'cytoscape';
import { PropertyValues, css, html } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
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
import '../helpers/cell-tasks.js';
import '../helpers/help-button.js';
import { sharedStyles } from '../utils/shared-styles.js';
import { cytoscapeOptions, layoutConfig } from './graph.js';
import {
	allPeersEdges,
	dhtCellsNodes,
	isHoldingElement,
	isHoldingEntry,
	simulatedNeighbors,
	stringifyCellId,
} from './processors.js';
import { effect } from './utils.js';

const MIN_ANIMATION_DELAY = 1;
const MAX_ANIMATION_DELAY = 7;

/**
 * @element dht-cells
 */
@customElement('dht-cells')
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

	@property({ type: Boolean, attribute: 'hide-header' })
	hideHeader: boolean = false;

	@property({ type: Boolean, attribute: 'hide-time-controller' })
	hideTimeController: boolean = false;

	@property({ type: Boolean, attribute: 'hide-filter' })
	hideFilter: boolean = false;

	@property({ type: Boolean, attribute: 'step-by-step' })
	stepByStep = false;

	@property({ type: Boolean, attribute: 'show-zome-fn-success' })
	showZomeFnSuccess = false;

	@query('#active-workflows-button')
	private _activeWorkflowsButton!: SlButton;
	@query('#active-workflows-menu')
	private _activeWorkflowsMenu!: SlMenu;

	@query('#network-requests-button')
	private _networkRequestsButton!: SlButton;
	@query('#network-requests-menu')
	private _networkRequestsMenu!: SlMenu;
	@query('#graph')
	private _graph!: CytoscapeCircle;

	@state()
	private ghostNodes: NodeDefinition[] = [];

	private _paused = new Signal.Computed(() =>
		this.store instanceof SimulatedPlaygroundStore
			? this.store?.paused.get()
			: false,
	);
	private _badAgents = new AsyncComputed(() => {
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

	firstUpdated() {
		effect(() => {
			this.store.activeDna.get();
			this.ghostNodes = [];
		});
	}

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
			encodeHashToBase64(networkRequest.toAgent) ===
			encodeHashToBase64(networkRequest.fromAgent)
		)
			return;

		if (!this._graph.cy) return;

		const fromNode = this._graph.cy.getElementById(
			stringifyCellId([networkRequest.dnaHash, networkRequest.fromAgent]),
		);
		if (!fromNode.position()) return;
		const toNode = this._graph.cy.getElementById(
			stringifyCellId([networkRequest.dnaHash, networkRequest.toAgent]),
		);

		const fromPosition = fromNode.position();
		const toPosition = toNode.position();

		let label = networkRequest.type;
		if (networkRequest.type === NetworkRequestType.PUBLISH_REQUEST) {
			const dhtOps: HoloHashMap<DhtOpHash, DhtOp> = (
				networkRequest as PublishRequestInfo
			).details.dhtOps;

			const types = Array.from(dhtOps.values())
				.filter(dhtOp => !isWarrantOp(dhtOp))
				.map(dhtOp => (dhtOp as { ChainOp: ChainOp }).ChainOp)
				.map(dhtOp => getDhtOpType(dhtOp));

			label = `Publish: ${uniq(types).join(', ')}`;
		}
		await sleep(10);

		const id = `${Math.random()}`;

		const elementDefinition: NodeDefinition = {
			group: 'nodes',
			data: {
				id,
				networkRequest,
				label,
			},
			position: { x: fromPosition.x + 1, y: fromPosition.y + 1 },
			classes: 'network-request',
		};

		const el = this._graph.cy.add(elementDefinition);
		this.ghostNodes = [...this.ghostNodes, elementDefinition];

		const delay = this.animationDelay * 1000;
		if (this.stepByStep) {
			const halfPosition = {
				x: (toPosition.x - fromPosition.x) / 2 + fromPosition.x,
				y: (toPosition.y - fromPosition.y) / 2 + fromPosition.y,
			};
			el.animate(
				{
					position: halfPosition,
				},
				{
					duration: delay / 2,
				},
			);

			await sleep(delay / 2);
			store.paused.pause();

			await store.paused.awaitResume();

			el.animate(
				{
					position: toPosition,
				},
				{
					duration: delay / 2,
				},
			);

			await sleep(delay / 2);
		} else {
			el.animate(
				{
					position: toNode.position(),
				},
				{
					duration: delay,
				},
			);

			await sleep(delay);
		}
		this.ghostNodes = this.ghostNodes.filter(el => el.data.id !== id);
		this._graph.cy.remove(el);
	}

	updated(changedValues: PropertyValues) {
		super.updated(changedValues);

		this.highlightNodesWithEntry();

		(this._graph?.cy?.style() as any)?.selector('.cell').style({
			opacity: this._paused.get() ? 0.4 : 1,
		});

		if (
			!this._middlewares &&
			this.store &&
			this.store instanceof SimulatedPlaygroundStore
		) {
			const store = this.store;
			this._middlewares = new MiddlewareController(
				this,
				() => {
					const cellsForActiveDna = store.cellsForActiveDna.get();
					if (
						cellsForActiveDna.status === 'completed' &&
						Array.from(cellsForActiveDna.value.entries()).length > 0
					) {
						return cellsForActiveDna.value.map(
							(s: SimulatedCellStore) => s.cell,
						);
					}
					return undefined;
				},
				{
					networkRequests: {
						before: n => this.beforeNetworkRequest(n),
					},
				},
			);
		}
	}

	get elements(): ElementDefinition[] {
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
			<div class="row" style="gap: 16px; align-items: center">
				${this.stepByStep
					? html`
							<sl-button
								circle
								.disabled=${!this._paused.get()}
								@click=${() => store.paused.resume()}
								style=${styleMap({
									opacity: this.stepByStep ? '1' : '',
								})}
							>
								<sl-icon .src=${wrapPathInSvg(mdiPlay)}></sl-icon
							></sl-button>
						`
					: html`
							<div
								class="row"
								style="gap: 8px; align-items: center; height: 40px "
							>
								<sl-icon .src=${wrapPathInSvg(mdiSpeedometer)}></sl-icon>
								<sl-range
									style="--track-color-active: var(--sl-color-primary-600);"
									.value=${MAX_ANIMATION_DELAY - this.animationDelay}
									.min=${MIN_ANIMATION_DELAY}
									.max=${MAX_ANIMATION_DELAY}
									@sl-change=${(e: any) =>
										(this.animationDelay =
											MAX_ANIMATION_DELAY - e.target.value)}
								></sl-range>
							</div>
						`}

				<sl-switch
					id="step-by-step-switch"
					.checked=${this.stepByStep}
					@sl-change=${(e: any) => {
						this.stepByStep = e.target.checked;
						if (this._paused.get()) store.paused.resume();
					}}
					>Step By Step</sl-switch
				>
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
					and it's actually the node's ID, which you can see labeled besides the
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

			const agentPubKey = node.id().split('/')[1];
			return cellsForActiveDna.value.has([
				activeDna,
				decodeHashFromBase64(agentPubKey),
			]);
		});
		const cellsWithPosition = nodes.map(node => {
			const agentPubKey = node.id().split('/')[1];

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

			const finalX = position.x + (leftSide ? -210 : 50);
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
			<div class="row " style="align-items: center; gap: 8px">
				${this.hideFilter
					? html``
					: html`
							<sl-dropdown>
								<sl-button id="active-workflows-button" caret slot="trigger">
									<sl-icon
										.src=${wrapPathInSvg(mdiCog)}
										slot="prefix"
									></sl-icon>
									Worfklows</sl-button
								>
								<sl-menu id="active-workflows-menu">
									${workflowsNames.map(
										type => html`
											<sl-menu-item
												type="checkbox"
												.checked=${this.workflowsToDisplay.includes(
													type as WorkflowType,
												)}
												value=${type}
												@sl-select=${(event: any) => {
													const checked = event.detail.item.checked;
													const value = event.detail.item.value;

													this.workflowsToDisplay =
														this.workflowsToDisplay.filter(w => w !== value);
													if (checked) {
														this.workflowsToDisplay = [
															...this.workflowsToDisplay,
															value,
														];
													}
												}}
											>
												${type}
											</sl-menu-item>
										`,
									)}
								</sl-menu>
							</sl-dropdown>

							<sl-dropdown>
								<sl-button id="network-requests-button" caret slot="trigger">
									<sl-icon
										.src=${wrapPathInSvg(mdiLanConnect)}
										slot="prefix"
									></sl-icon>
									Network Requests</sl-button
								>
								<sl-menu
									id="network-requests-menu"
									@sl-select=${(event: any) => {
										const checked = event.detail.item.checked;
										const value = event.detail.item.value;

										this.networkRequestsToDisplay =
											this.networkRequestsToDisplay.filter(w => w !== value);
										if (checked) {
											this.networkRequestsToDisplay = [
												...this.networkRequestsToDisplay,
												value,
											];
										}
									}}
								>
									${networkRequestNames.map(
										type => html`
											<sl-menu-item
												type="checkbox"
												.checked=${this.networkRequestsToDisplay.includes(
													type as NetworkRequestType,
												)}
												value="${type}"
											>
												${type}
											</sl-menu-item>
										`,
									)}
								</sl-menu>
							</sl-dropdown>
						`}

				<span style="flex: 1;"></span>

				${this.renderTimeController()}
			</div>
		`;
	}

	get selectedNodesIds() {
		if (!this.store.activeAgentPubKey.get()) return [];
		if (!this.store.activeDna.get()) return [];
		return [
			`${encodeHashToBase64(this.store.activeDna.get()!)}/${encodeHashToBase64(this.store.activeAgentPubKey.get()!)}`,
		];
	}

	render() {
		return html`
			${this.renderTasksTooltips()}
			<div class="column" style="flex: 1">
				${this.hideHeader
					? html``
					: html`
							<div class="block-title row" style="align-items: center">
								<span>Dht Cells</span>

								<div style="flex: 1"></div>
								${this.renderHelp()}
							</div>
						`}
				<cytoscape-circle
					id="graph"
					class="fill ${classMap({
						paused: this._paused.get(),
					})}"
					.elements=${this.elements}
					.ghostNodes=${this.ghostNodes}
					.options=${cytoscapeOptions}
					.circleOptions=${layoutConfig}
					@node-selected=${(e: CustomEvent) =>
						this.store.activeAgentPubKey.set(
							decodeHashFromBase64(e.detail.id().split('/')[1]),
						)}
					.selectedNodesIds=${this.selectedNodesIds}
				></cytoscape-circle>
				${this.renderBottomToolbar()}
			</div>
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
					position: relative;
					flex: 1;
				}

				.paused {
					background-color: #dbdbdba0;
				}
			`,
		];
	}
}
