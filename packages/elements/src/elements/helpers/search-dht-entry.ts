import '@alenaksu/json-viewer';
import { areEqual } from '@holochain-playground/simulator';
import { AnyDhtHash, encodeHashToBase64 } from '@holochain/client';
import { mdiHelpCircleOutline, mdiInformationOutline } from '@mdi/js';
import { decode } from '@msgpack/msgpack';
import { SlInput } from '@shoelace-style/shoelace';
import '@shoelace-style/shoelace/dist/components/button/button.js';
import '@shoelace-style/shoelace/dist/components/dialog/dialog.js';
import '@shoelace-style/shoelace/dist/components/icon-button/icon-button.js';
import { wrapPathInSvg } from '@tnesh-stack/elements';
import { AsyncComputed, Signal, SignalWatcher } from '@tnesh-stack/signals';
import { HoloHashMap } from '@tnesh-stack/utils';
import { css, html } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { join } from 'lit/directives/join.js';

import { PlaygroundElement } from '../../base/playground-element.js';
import { summarizeDht } from '../dht-entries/dht.js';
import { shortenStrRec } from '../utils/hash.js';
import { sharedStyles } from '../utils/shared-styles.js';

type SearchResults = HoloHashMap<
	AnyDhtHash,
	{ dhtObject: any; matchingString: string }
>;

@customElement('search-dht-entry')
export class SearchDhtEntry extends PlaygroundElement {
	searchFilter: Signal.State<string | undefined> = new Signal.State(
		undefined as string | undefined,
	);

	search = new AsyncComputed(() => {
		const filter = this.searchFilter.get();

		if (!filter)
			return {
				status: 'completed',
				value: new HoloHashMap() as SearchResults,
			};

		const dht = this.store.dhtForActiveDna.get();
		if (dht.status !== 'completed') return dht;

		const summary = summarizeDht(dht.value);

		const matchingEntries: SearchResults = new HoloHashMap();

		for (const [actionHash, action] of Array.from(summary.actions.entries())) {
			const str = JSON.stringify(shortenStrRec(action));
			if (encodeHashToBase64(actionHash) === filter || str.includes(filter)) {
				matchingEntries.set(actionHash, {
					dhtObject: action,
					matchingString: '',
				});
			}
		}

		for (const [entryHash, entry] of Array.from(summary.entries.entries())) {
			const object = entry.entry_type === 'App' ? decode(entry.entry) : entry;
			const str = JSON.stringify(shortenStrRec(object));
			if (encodeHashToBase64(entryHash) === filter || str.includes(filter)) {
				matchingEntries.set(entryHash, {
					dhtObject: object,
					matchingString: '',
				});
			}
		}
		return {
			status: 'completed',
			value: matchingEntries,
		};
	});

	show() {
		this.shadowRoot?.querySelector('sl-dialog')!.show();
	}

	renderSearchResults(results: SearchResults) {
		if (results.size === 0)
			return html`
				<div
					class="column placeholder"
					style="flex: 1; align-items:center;justify-content:center; gap: 8px"
				>
					<sl-icon
						.src=${wrapPathInSvg(mdiInformationOutline)}
						style="font-size: 64px"
					>
					</sl-icon>
					<span>No entry matches the search filter. </span>
				</div>
			`;
		const activeDhtHash = this.store.activeDhtHash.get();
		return html`
			<div class="flex-scrollable-parent">
				<div class="flex-scrollable-container">
					<div class="flex-scrollable-y">
						<div class="column">
							${join(
								Array.from(results.entries()).map(
									([hash, object]) =>
										html`<div class="row" style="gap: 8px; align-items: center">
											<json-viewer
												.data=${shortenStrRec(object.dhtObject)}
												style="flex: 1"
											></json-viewer>
											<div style="flex: 1"></div>

											${activeDhtHash && areEqual(activeDhtHash, hash)
												? html` <sl-button disabled>Active</sl-button> `
												: html`
														<sl-button
															@click=${() => this.store.activeDhtHash.set(hash)}
															>Select</sl-button
														>
													`}
										</div>`,
								),
								html`<sl-divider></sl-divider>`,
							)}
						</div>
					</div>
				</div>
			</div>
		`;
	}

	renderSearch() {
		const search = this.search.get();
		switch (search.status) {
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
							.error=${search.error}
							headline="Error searching the DHT."
						></display-error>
					</div>
				`;
			case 'completed':
				return this.renderSearchResults(search.value);
		}
	}

	render() {
		return html`
			<div class="column" style="gap: 16px; flex: 1">
				<sl-input
					label="Search Filter"
					@sl-input=${(e: CustomEvent) => {
						this.searchFilter.set((e.target as SlInput).value);
					}}
				>
				</sl-input>
				${this.searchFilter.get()
					? this.renderSearch()
					: html`
							<span class="placeholder"
								>Input search filter to search for entries.</span
							>
						`}
			</div>
		`;
	}

	static styles = [sharedStyles, css``];
}
