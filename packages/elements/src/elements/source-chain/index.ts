import '@holochain-open-dev/elements/dist/elements/holo-identicon.js';
import {
	NewEntryAction,
	decodeHashFromBase64,
	encodeHashToBase64,
} from '@holochain/client';
import '@scoped-elements/cytoscape';
import '@shoelace-style/shoelace/dist/components/card/card.js';
import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import isEqual from 'lodash-es/isEqual.js';

import { PlaygroundElement } from '../../base/playground-element.js';
import '../helpers/help-button.js';
import { sharedStyles } from '../utils/shared-styles.js';
import { graphStyles } from './graph.js';
import { sourceChainNodes } from './processors.js';

/**
 * @element source-chain
 */
@customElement('source-chain')
export class SourceChain extends PlaygroundElement {
	get elements() {
		const activeCell = this.store.activeCell.get();
		if (activeCell.status !== 'completed' || !activeCell.value) return [];
		const sourceChain = activeCell.value.sourceChain.get();
		if (sourceChain.status !== 'completed') return [];

		return sourceChainNodes(activeCell.value, sourceChain.value);
	}

	get selectedNodesIds() {
		const activeCell = this.store.activeCell.get();
		if (activeCell.status !== 'completed' || !activeCell.value) return [];
		const sourceChain = activeCell.value.sourceChain.get();
		if (sourceChain.status !== 'completed') return [];
		const activeHash = this.store.activeDhtHash.get();
		if (!activeHash) return [];

		const nodesIds = [];
		for (const element of sourceChain.value) {
			const action = element.signed_action.hashed;
			if (isEqual(action.hash, activeHash)) {
				return [encodeHashToBase64(activeHash)];
			}

			const entry_hash = (action.content as NewEntryAction).entry_hash;
			if (entry_hash !== undefined && isEqual(entry_hash, activeHash)) {
				nodesIds.push(
					`${encodeHashToBase64(action.hash)}:${encodeHashToBase64(
						entry_hash,
					)}`,
				);
			}
		}

		return nodesIds;
	}

	get cytoscapeOptions() {
		return {
			autoungrabify: true,
			userZoomingEnabled: true,
			userPanningEnabled: true,
			style: graphStyles,
		};
	}

	renderHelp() {
		return html` <help-button heading="Source Chain" class="block-help">
			<span>
				This graph displays the source chain of the selected cell. On the
				top-left sequence, you can see the hash-chain of actions. On the
				bottom-right sequence, you can see the entries associated with each
				action. Links between actions
				<br />
				<br />
				Dashed relationships are embedded references: the actions contain the
				hash of the last action, and also the entry hash if they have an entry.
			</span>
		</help-button>`;
	}

	render() {
		const activeAgent = this.store.activeAgentPubKey.get();
		const activeCell = this.store.activeCell.get();
		return html`
			<sl-card class="block-card">
				<div class="column fill">
					<span class="block-title row" style="margin: 16px;"
						>Source
						Chain${activeAgent
							? html`
									<span class="placeholder row">
										, for Agent
										<holo-identicon
											.hash=${activeAgent}
											style="margin-left: 8px;"
										></holo-identicon>
									</span>
								`
							: html``}</span
					>
					${this.renderHelp()}
					${activeCell.status === 'completed' && activeCell.value
						? html``
						: html`
								<div style="flex: 1;" class="center-content placeholder">
									<span>Select a cell to display its source chain</span>
								</div>
							`}

					<cytoscape-dagre
						.elements=${this.elements}
						.selectedNodesIds=${this.selectedNodesIds}
						.options=${this.cytoscapeOptions}
						@node-selected=${(e: any) => {
							let activeHash = e.detail.id();

							if (activeHash.includes(':')) {
								activeHash = activeHash.split(':')[1];
							}

							this.store.activeDhtHash.set(decodeHashFromBase64(activeHash));
						}}
						style=${styleMap({
							display:
								activeCell.status === 'completed' && activeCell.value
									? ''
									: 'none',
							flex: '1',
						})}
					></cytoscape-dagre>
				</div>
			</sl-card>
		`;
	}

	static get styles() {
		return [
			sharedStyles,
			css`
				:host {
					min-height: 350px;
					min-width: 100px;
					display: flex;
				}
				#source-chain-graph {
					width: 100%;
					height: 100%;
				}
			`,
		];
	}
}
