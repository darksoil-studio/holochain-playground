import { encodeHashToBase64 } from '@holochain/client';
import '@power-elements/json-viewer';
import '@shoelace-style/shoelace/dist/components/button/button.js';
import '@shoelace-style/shoelace/dist/components/card/card.js';
import '@shoelace-style/shoelace/dist/components/icon-button/icon-button.js';
import '@shoelace-style/shoelace/dist/components/tab-group/tab-group.js';
import '@shoelace-style/shoelace/dist/components/tab-panel/tab-panel.js';
import '@shoelace-style/shoelace/dist/components/tab/tab.js';
import '@tnesh-stack/elements/dist/elements/holo-identicon.js';
import { AsyncComputed } from '@tnesh-stack/signals';
import '@vaadin/grid/vaadin-grid-column.js';
import '@vaadin/grid/vaadin-grid.js';
import { Grid, GridColumn } from '@vaadin/grid/vaadin-grid.js';
import { PropertyValues, css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { createRef, ref } from 'lit/directives/ref.js';
import isEqual from 'lodash-es/isEqual.js';

import { PlaygroundElement } from '../../base/playground-element.js';
import { selectCell } from '../../base/selectors.js';
import {
	ConnectedCellStore,
	ConnectedConductorStore,
	ConnectedPlaygroundStore,
} from '../../store/connected-playground-store.js';
import { CellStore, ConductorStore } from '../../store/playground-store.js';
import {
	SimulatedCellStore,
	SimulatedConductorStore,
	SimulatedPlaygroundStore,
} from '../../store/simulated-playground-store.js';
import '../helpers/call-functions.js';
import '../helpers/help-button.js';
import { sharedStyles } from '../utils/shared-styles.js';
import { adminApi } from './admin-api.js';

@customElement('conductor-admin')
export class ConductorAdmin extends PlaygroundElement {
	_activeConductor = new AsyncComputed(() => {
		const activeCell = this.store.activeCell.get();
		if (activeCell.status !== 'completed') return activeCell;

		const conductor = activeCell.value?.conductorStore;
		return {
			status: 'completed',
			value: conductor,
		};
	});

	private _grid = createRef<Grid>();

	get isSimulated() {
		return this.store && this.store instanceof SimulatedPlaygroundStore;
	}

	renderHelp() {
		const activeAgentPubKey = this.store.activeAgentPubKey.get();
		return html`
			<help-button heading="Conductor Admin Help">
				<span>
					You've selected the conductor with Agent ID
					${activeAgentPubKey
						? encodeHashToBase64(activeAgentPubKey)
						: undefined}.
					Here you can see all the cells that it's running, as well as execute
					admin functions for it.
				</span>
			</help-button>
		`;
	}

	updated(changedValues: PropertyValues) {
		super.updated(changedValues);
		if (this._grid.value) {
			this._grid.value.requestContentUpdate();
		}
	}

	setupGrid(grid: Grid) {
		setTimeout(() => {
			if (!grid) return;
			const dnaColumn = this.shadowRoot!.querySelector(
				'#dna-column',
			) as GridColumn;
			dnaColumn.renderer = (root: any, column, model) => {
				const cell = model.item as any as CellStore;
				root.innerHTML = `<holo-identicon hash="${encodeHashToBase64(
					cell.cellId[0],
				)}"></holo-identicon>`;
				root.item = model.item;
			};
			const agentPubKeyColumn = this.shadowRoot!.querySelector(
				'#agent-pub-key-column',
			) as GridColumn;
			agentPubKeyColumn.renderer = (root: any, column, model) => {
				const cell = model.item as any as CellStore;
				root.innerHTML = `<holo-identicon hash="${encodeHashToBase64(
					cell.cellId[1],
				)}"></holo-identicon>`;
				root.item = model.item;
			};

			if (this.isSimulated) {
				grid.rowDetailsRenderer = function (root, grid, model) {
					if (!root.firstElementChild) {
						const cell = model.item as any as CellStore;

						if (cell instanceof SimulatedCellStore) {
							root.innerHTML = `
            <div class="column" style="padding: 8px; padding-top: 0">
            <span>networkSeed: "${cell.dna.networkSeed}"</span>
            <div class="row">
            <span>Properties:</span>
            <json-viewer style="margin-left: 8px">
            <script type="application/json">
            ${JSON.stringify(cell.dna.properties)}
            </script>
            </json-viewer>
            </div>
            </div>
            `;
						}
					}
				};

				const detailsToggleColumn = this.shadowRoot!.querySelector(
					'#details',
				) as GridColumn;
				detailsToggleColumn.renderer = function (root: any, column, model) {
					if (!root.firstElementChild) {
						root.innerHTML = '<sl-button>Details</sl-button>';
						let opened = false;
						root.firstElementChild.addEventListener('click', (e: any) => {
							if (!opened) {
								grid.openItemDetails(root.item);
							} else {
								grid.closeItemDetails(root.item);
							}
							opened = !opened;
						});
					}
					root.item = model.item;
				};
			}

			const selectColumn = this.shadowRoot!.querySelector(
				'#select',
			) as GridColumn;
			selectColumn.renderer = (root: any, column, model) => {
				const cell = model.item as any as CellStore;

				const isSelected =
					isEqual(this.store.activeDna.get()!, cell.cellId[0]) &&
					isEqual(this.store.activeAgentPubKey.get()!, cell.cellId[1]);
				root.innerHTML = `<sl-button label="Select" ${
					isSelected ? 'disabled' : ''
				}></sl-button>`;
				root.firstElementChild.addEventListener('click', (e: any) => {
					const cell = model.item as any as CellStore;

					this.store.activeDna.set(cell.cellId[0]);
					this.store.activeAgentPubKey.set(cell.cellId[1]);
				});

				root.item = model.item;
			};
		});
	}

	renderCells() {
		const cells = this.store.cellsForActiveDna.get();
		if (cells.status !== 'completed') return html``;

		const items = cells.value.values();

		return html`
			<div class="column fill">
				<vaadin-grid
					.items=${items}
					${ref(this._grid)}
					${ref(el => this.setupGrid(el as Grid))}
				>
					<vaadin-grid-column
						path="dna"
						action="Dna"
						id="dna-column"
					></vaadin-grid-column>
					<vaadin-grid-column
						id="agent-pub-key-column"
						path="agentPubKey"
						action="Agent Pub Key"
					></vaadin-grid-column>
					${this.isSimulated
						? html`
								<vaadin-grid-column
									flex-grow="0"
									id="details"
								></vaadin-grid-column>
							`
						: html``}
					<vaadin-grid-column flex-grow="0" id="select"></vaadin-grid-column>
				</vaadin-grid>
			</div>
		`;
	}

	renderAdminAPI() {
		if (!this.isSimulated)
			return html`<div class="column fill center-content">
				<span class="placeholder" style="margin: 16px;"
					>Calling a connected admin conductor interface is not yet
					available.</span
				>
			</div>`;
		const activeConductor = this._activeConductor.get();
		if (
			this.store instanceof ConnectedPlaygroundStore ||
			activeConductor.status !== 'completed' ||
			!activeConductor.value ||
			activeConductor.value instanceof ConnectedConductorStore
		)
			return html``;

		const happs = this.store.simulatedHapps.get();

		const adminApiFns = adminApi(this, happs, activeConductor.value);

		return html` <div class="column fill">
			<call-functions .callableFns=${adminApiFns}></call-functions>
		</div>`;
	}

	renderContent() {
		const activeConductor = this._activeConductor.get();

		// TODO: add spinner on loading

		if (activeConductor.status !== 'completed' || !activeConductor.value)
			return html`
				<div class="column fill center-content">
					<span class="placeholder"
						>Select a cell to inspect its conductor</span
					>
				</div>
			`;
		return html`
			${this.renderHelp()}

			<div class="column fill">
				<sl-tab-group>
					<sl-tab slot="nav" panel="cells">Cells</sl-tab>
					<sl-tab slot="nav" panel="admin_api">Admin API</sl-tab>
					<sl-tab-panel name="cells">${this.renderCells()}</sl-tab-panel>
					<sl-tab-panel name="admin_api">${this.renderAdminAPI()}</sl-tab-panel>
				</sl-tab-group>
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
			<sl-card class="block-card">
				<div class="column fill">
					<div class="row" style="padding: 16px">
						<div class="column" style="flex: 1;">
							<span class="title"
								>Conductor
								Admin${activeConductor.status === 'completed' &&
								activeConductor.value
									? html`<span class="placeholder"
											>, for ${this.renderName()}</span
										>`
									: html``}</span
							>
						</div>
					</div>
					<div class="column fill">${this.renderContent()}</div>
				</div>
			</sl-card>
		`;
	}

	static get styles() {
		return [
			sharedStyles,
			css`
				:host {
					display: flex;
				}
				.bottom-border {
					border-bottom: 1px solid lightgrey;
				}
			`,
		];
	}
}
