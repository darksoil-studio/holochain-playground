import {
	CellInfo,
	CellType,
	InstalledAppInfoStatus,
	encodeHashToBase64,
} from '@holochain/client';
import '@power-elements/json-viewer';
import '@shoelace-style/shoelace/dist/components/button/button.js';
import '@shoelace-style/shoelace/dist/components/card/card.js';
import '@shoelace-style/shoelace/dist/components/details/details.js';
import '@shoelace-style/shoelace/dist/components/divider/divider.js';
import '@shoelace-style/shoelace/dist/components/icon-button/icon-button.js';
import '@shoelace-style/shoelace/dist/components/tab-group/tab-group.js';
import '@shoelace-style/shoelace/dist/components/tab-panel/tab-panel.js';
import '@shoelace-style/shoelace/dist/components/tab/tab.js';
import '@shoelace-style/shoelace/dist/components/tag/tag.js';
import '@tnesh-stack/elements/dist/elements/holo-identicon.js';
import { AsyncComputed } from '@tnesh-stack/signals';
import { PropertyValues, css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
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
import { cellCount, cellName, dnaHash } from '../../utils.js';
import '../helpers/call-functions.js';
import '../helpers/help-button.js';
import { sharedStyles } from '../utils/shared-styles.js';

@customElement('conductor-happs')
export class ConductorHapps extends PlaygroundElement {
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

	renderHappStatus(status: InstalledAppInfoStatus) {
		if (status === 'running') {
			return html`<sl-tag variant="success">Running</sl-tag>`;
		}
		if (status === 'awaiting_memproofs') {
			return html`<sl-tag variant="neutral">Awaiting Memproofs</sl-tag>`;
		}

		if ('disabled' in status) {
			return html`<sl-tag variant="danger">Disabled</sl-tag>`;
		}
		if ('paused' in status) {
			return html`<sl-tag variant="warning">Paused</sl-tag>`;
		}
	}

	renderCell(cellInfo: CellInfo) {
		const activeDna = this.store.activeDna.get();
		const cellDnaHash = dnaHash(cellInfo);
		const name = cellName(cellInfo);
		const isActive =
			activeDna &&
			encodeHashToBase64(activeDna) === encodeHashToBase64(cellDnaHash);

		return html`<div
			class="row"
			style="gap: 16px; align-items: center; height: 40px"
		>
			<div class="row" style="align-items: center">
				<span class="placeholder">Role:&nbsp;</span>
				<span>${name}</span>
			</div>
			<span style="flex: 1"> </span>

			<div class="row" style="gap: 8px; align-items: center">
				<span class="placeholder">Dna Hash:</span>
				<holo-identicon
					.hash=${cellDnaHash}
					style="height: 32px"
				></holo-identicon>
			</div>

			${isActive
				? html`<sl-tag variant="primary">Active Dna</sl-tag>`
				: html`
						<sl-button
							variant="primary"
							@click=${() => {
								this.store.activeDna.set(cellDnaHash);
							}}
							>Select
						</sl-button>
					`}
		</div>`;
	}

	renderCells(cells: Record<string, CellInfo[]>) {
		return html`
			<div class="column">
				${join(
					Object.values(cells)
						.filter(cellInfos => cellInfos.length > 0)
						.map(cellInfos =>
							cellInfos.map(cellInfo => this.renderCell(cellInfo)),
						),
					html`<sl-divider></sl-divider>`,
				)}
			</div>
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
				<div class="row" style="align-items: center;">
					<span class="title">Conductor hApps</span>
					${activeConductor.status === 'completed' && activeConductor.value
						? html`<span class="placeholder">, for ${this.renderName()}</span>`
						: html``}

					<div style="flex: 1;"></div>
					${this.renderHelp()}
				</div>
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
				}
				.bottom-border {
					border-bottom: 1px solid lightgrey;
				}
			`,
		];
	}
}
