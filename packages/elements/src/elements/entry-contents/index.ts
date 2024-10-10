import '@holochain-open-dev/elements/dist/elements/holo-identicon.js';
import '@power-elements/json-viewer';
import '@shoelace-style/shoelace/dist/components/card/card.js';
import { html } from 'lit';
import { customElement } from 'lit/decorators.js';

import { PlaygroundElement } from '../../base/playground-element.js';
import { shortenStrRec } from '../utils/hash.js';
import { sharedStyles } from '../utils/shared-styles.js';
import { getEntryContents } from '../utils/utils.js';

/**
 * @element entry-contents
 */
@customElement('entry-contents')
export class EntryContents extends PlaygroundElement {
	render() {
		const activeDhtHash = this.store.activeDhtHash.get();
		const activeContent = this.store.activeContent.get();
		return html`
			<sl-card style="width: auto; min-height: 200px;" class="fill">
				<div class="column fill">
					<span class="title row" style="margin-bottom: 8px;">
						${activeContent.status === 'completed' &&
						activeContent.value &&
						activeContent.value.type
							? 'Action'
							: 'Entry'}
						Contents${activeDhtHash
							? html`<span class="row placeholder">
									, with hash
									<holo-identicon
										.hash=${activeDhtHash}
										style="margin-left: 8px;"
									></holo-identicon
								></span>`
							: html``}</span
					>
					${activeContent.status === 'completed' && activeContent.value
						? html`
								<div class="column fill">
									<div class="fill flex-scrollable-parent">
										<div class="flex-scrollable-container">
											<div class="flex-scrollable-y" style="height: 100%;">
												<json-viewer
													.object=${shortenStrRec(
														activeContent.value.entry
															? getEntryContents(activeContent.value)
															: activeContent.value,
													)}
													class="fill"
												></json-viewer>
											</div>
										</div>
									</div>
								</div>
							`
						: html`
								<div class="column fill center-content">
									<span class="placeholder">Select entry to inspect</span>
								</div>
							`}
				</div>
			</sl-card>
		`;
	}

	static styles = [sharedStyles];
}
