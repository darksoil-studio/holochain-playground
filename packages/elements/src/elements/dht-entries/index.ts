import '@holochain-open-dev/elements/dist/elements/holo-identicon.js';
import { CellMap } from '@holochain-open-dev/utils';
import {
	DhtOp,
	decodeHashFromBase64,
	encodeHashToBase64,
} from '@holochain/client';
import { CytoscapeCoseBilkent } from '@scoped-elements/cytoscape';
import {
	Button,
	Card,
	Checkbox,
	Formfield,
	Icon,
	IconButton,
	ListItem,
	Menu,
} from '@scoped-elements/material-web';
import { css, html } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { isEqual } from 'lodash-es';

import { PlaygroundElement } from '../../base/playground-element.js';
import { SimulatedCellStore } from '../../store/simulated-playground-store.js';
import { HelpButton } from '../helpers/help-button.js';
import { sharedStyles } from '../utils/shared-styles.js';
import { cytoscapeConfig } from './graph.js';
import { allEntries } from './processors.js';

/**
 * @element dht-entries
 */
export class DhtEntries extends PlaygroundElement {
	@property({ type: Boolean, attribute: 'hide-filter' })
	hideFilter: boolean = false;

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

	@query('#visible-entries-button')
	private _visibleEntriesButton!: Button;

	@query('#visible-entries-menu')
	private _visibleEntriesMenu!: Menu;

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
		if (dhtShards.status !== 'completed') return undefined;

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
			style="align-items: center; justify-content: start; margin: 8px;"
		>
			<mwc-formfield label="Show Entry Contents" style="margin-right: 16px">
				<mwc-checkbox
					.checked=${this.showEntryContents}
					@change=${(e: any) => {
						this.showEntryContents = e.target.checked;
					}}
				></mwc-checkbox
			></mwc-formfield>

			<mwc-formfield
				label="Show Only Active Agent's Shard"
				style="margin-right: 16px"
			>
				<mwc-checkbox
					.checked=${this.showOnlyActiveAgentsShard}
					@change=${(e: any) => {
						this.showOnlyActiveAgentsShard = e.target.checked;
					}}
				></mwc-checkbox
			></mwc-formfield>

			<span class="vertical-divider"></span>

			<div class="row" style="position: relative;">
				<mwc-button
					label="Visible entries"
					style="--mdc-theme-primary: rgba(0,0,0,0.7); margin-left: 16px;"
					icon="arrow_drop_down"
					id="visible-entries-button"
					trailingIcon
					@click=${() => this._visibleEntriesMenu.show()}
				></mwc-button>
				<mwc-menu
					corner="BOTTOM_RIGHT"
					multi
					fixed
					activatable
					id="visible-entries-menu"
					.anchor=${this._visibleEntriesButton}
					@selected=${(e: any) => {
						const includedEntryTypes = [...e.detail.index];
						this.excludedEntryTypes = this._entryTypes.filter(
							(type, index) => !includedEntryTypes.includes(index),
						);
					}}
				>
					${this._entryTypes.map(
						type => html`
							<mwc-list-item
								graphic="icon"
								.selected=${!this.excludedEntryTypes.includes(type)}
								.activated=${!this.excludedEntryTypes.includes(type)}
							>
								${!this.excludedEntryTypes.includes(type)
									? html` <mwc-icon slot="graphic">check</mwc-icon> `
									: html``}
								${type}
							</mwc-list-item>
						`,
					)}
				</mwc-menu>
			</div>
		</div>`;
	}

	render() {
		const activeDna = this.store.activeDna.get();
		return html`
			<mwc-card class="block-card" style="position: relative;">
				<div class="column fill">
					<span class="block-title row" style="margin: 16px; margin-bottom: 0;"
						>Dht
						Entries${activeDna
							? html`
									<span class="placeholder row">
										, for Dna
										<holo-identicon
											.hash=${activeDna}
											style="margin-left: 8px;"
										></holo-identicon>
									</span>
								`
							: html``}</span
					>

					<cytoscape-cose-bilkent
						.elements=${this.elements}
						.selectedNodesIds=${this.selectedNodesIds}
						class="fill"
						.options=${cytoscapeConfig}
						@node-selected=${(e: any) =>
							this.store?.activeDhtHash.set(
								decodeHashFromBase64(e.detail.id()),
							)}
					></cytoscape-cose-bilkent>

					${this.renderHelp()}
					${!this.hideFilter ? this.renderFilter() : html``}
				</div>
			</mwc-card>
		`;
	}

	static get scopedElements() {
		return {
			'mwc-checkbox': Checkbox,
			'mwc-formfield': Formfield,
			'mwc-icon-button': IconButton,
			'mwc-card': Card,
			'mwc-menu': Menu,
			'mwc-icon': Icon,
			'mwc-list-item': ListItem,
			'mwc-button': Button,
			'help-button': HelpButton,
			'cytoscape-cose-bilkent': CytoscapeCoseBilkent,
		};
	}

	static get styles() {
		return [
			sharedStyles,
			css`
				:host {
					display: flex;
					min-height: 300px;
					min-width: 300px;
				}
			`,
		];
	}
}
