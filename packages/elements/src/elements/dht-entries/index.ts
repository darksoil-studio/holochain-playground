import {
	DhtOp,
	decodeHashFromBase64,
	encodeHashToBase64,
} from '@holochain/client';
import { mdiFilter, mdiFilterMinus } from '@mdi/js';
import '@scoped-elements/cytoscape';
import '@shoelace-style/shoelace/dist/components/button/button.js';
import '@shoelace-style/shoelace/dist/components/card/card.js';
import '@shoelace-style/shoelace/dist/components/checkbox/checkbox.js';
import '@shoelace-style/shoelace/dist/components/divider/divider.js';
import '@shoelace-style/shoelace/dist/components/icon-button/icon-button.js';
import '@shoelace-style/shoelace/dist/components/icon/icon.js';
import '@shoelace-style/shoelace/dist/components/select/select.js';
import { wrapPathInSvg } from '@tnesh-stack/elements';
import '@tnesh-stack/elements/dist/elements/holo-identicon.js';
import { CellMap } from '@tnesh-stack/utils';
import { css, html } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import isEqual from 'lodash-es/isEqual.js';

import { PlaygroundElement } from '../../base/playground-element.js';
import { SimulatedCellStore } from '../../store/simulated-playground-store.js';
import '../helpers/help-button.js';
import { sharedStyles } from '../utils/shared-styles.js';
import { cytoscapeConfig } from './graph.js';
import { allEntries } from './processors.js';

/**
 * @element dht-entries
 */
@customElement('dht-entries')
export class DhtEntries extends PlaygroundElement {
	@property({ type: Boolean, attribute: 'hide-filter' })
	hideFilter: boolean = false;

	@property({ type: Boolean, attribute: 'hide-header' })
	hideHeader: boolean = false;

	@property({ type: Boolean, attribute: 'show-entry-contents' })
	showEntryContents: boolean = false;

	@property({ type: Boolean, attribute: 'hide-deleted' })
	hideDeleted: boolean = false;

	@property({ type: Boolean, attribute: 'show-only-active-agents-shard' })
	showOnlyActiveAgentsShard: boolean = false;

	@property({ type: Array })
	excludedEntryTypes: string[] = [];

	@state()
	private _entryTypes: string[] = [];

	get _simulatedDna() {
		const cellsForActiveDna = this.store.cellsForActiveDna.get();
		if (cellsForActiveDna.status !== 'completed') return undefined;

		const cells = cellsForActiveDna.value.values();
		return cells && cells.length > 0
			? (cells[0] as SimulatedCellStore).dna
			: undefined;
	}

	get elements() {
		const dhtShards = this.store.dhtForActiveDna.get();
		if (dhtShards.status !== 'completed') return [];

		let dht = dhtShards.value;

		const activeAgentPubKey = this.store.activeAgentPubKey.get();

		if (this.showOnlyActiveAgentsShard && activeAgentPubKey) {
			dht = new CellMap<DhtOp[]>([
				dht
					.entries()
					.find(([cellId, _]) => isEqual(cellId[1], activeAgentPubKey))!,
			]);
		}

		const { nodes, edges, entryTypes } = allEntries(
			dht,
			this._simulatedDna,
			this.showEntryContents,
			!this.hideDeleted,
			this.excludedEntryTypes,
		);
		this._entryTypes = entryTypes;

		return [...nodes, ...edges];
	}

	get selectedNodesIds() {
		const activeDhtHash = this.store.activeDhtHash.get();
		return activeDhtHash ? [encodeHashToBase64(activeDhtHash)] : [];
	}

	renderHelp() {
		return html` <help-button heading="Dht Entries" class="block-help">
			<span>
				This graph contains a
				<strong>high-level view of all the entries</strong> that are present in
				the Dht. Every object you see represents an entry, and the relationships
				between them are links.
				<br />
				<br />
				Dashed relationships are embedded references, and solid relationships
				are normal holochain links. The tag of the holochain links appears as
				the label.
			</span>
		</help-button>`;
	}

	renderFilter() {
		return html` <div
			class="row"
			style="align-items: center; justify-content: start;"
		>
			<sl-checkbox
				style="margin-right: 16px"
				.checked=${this.showEntryContents}
				@sl-change=${(e: any) => {
					this.showEntryContents = e.target.checked;
				}}
				>Show Entry Contents</sl-checkbox
			>

			<sl-checkbox
				.checked=${this.showOnlyActiveAgentsShard}
				style="margin-right: 16px"
				@change=${(e: any) => {
					this.showOnlyActiveAgentsShard = e.target.checked;
				}}
				>Show Only Active Agent's Shard</sl-checkbox
			>

			<div style="flex: 1"></div>

			<sl-select
				multiple
				@sl-change=${(e: any) => {
					this.excludedEntryTypes = e.target.value;
				}}
				placeholder="No filtered entry types"
				style="min-width: 20em"
			>
				<sl-icon
					slot="prefix"
					style="margin-left: 8px"
					.src=${wrapPathInSvg(mdiFilter)}
				></sl-icon>
				${this._entryTypes.map(
					type => html` <sl-option value="${type}"> ${type} </sl-option> `,
				)}
			</sl-select>
		</div>`;
	}

	render() {
		const activeDna = this.store.activeDna.get();
		return html`
			<div class="column fill">
				${this.hideHeader
					? html``
					: html`
							<div class="block-title row" style="align-items: center">
								<span>Dht Entries</span>
								<div style="flex: 1"></div>

								${this.renderHelp()}
							</div>
						`}
				${this.elements.length > 0
					? html`
							<cytoscape-klay
								.elements=${this.elements}
								.selectedNodesIds=${this.selectedNodesIds}
								class="fill"
								.options=${cytoscapeConfig}
								@node-selected=${(e: any) =>
									this.store.activeDhtHash.set(
										decodeHashFromBase64(e.detail.id()),
									)}
								@edge-selected=${(e: any) => {
									this.store.activeDhtHash.set(
										decodeHashFromBase64(e.detail.id()),
									);
								}}
							></cytoscape-klay>
						`
					: html`
							<div
								class="column"
								style="flex: 1; align-items: center; justify-content: center;"
							>
								<span class="placeholder">No entries match this filter</span>
							</div>
						`}
				${!this.hideFilter ? this.renderFilter() : html``}
			</div>
		`;
	}

	static get styles() {
		return [
			sharedStyles,
			css`
				:host {
					display: flex;
					min-height: 300px;
					min-width: 300px;
					flex: 1;
				}
			`,
		];
	}
}
