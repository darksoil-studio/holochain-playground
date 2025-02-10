import '@alenaksu/json-viewer';
import '@shoelace-style/shoelace/dist/components/card/card.js';
import '@tnesh-stack/elements/dist/elements/holo-identicon.js';
import { css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import { PlaygroundElement } from '../../base/playground-element.js';
import { shortenStrRec } from '../utils/hash.js';
import { sharedStyles } from '../utils/shared-styles.js';
import { getEntryContents } from '../utils/utils.js';

/**
 * @element entry-contents
 */
@customElement('entry-contents')
export class EntryContents extends PlaygroundElement {
	@property({ type: Boolean, attribute: 'hide-header' })
	hideHeader: boolean = false;

	render() {
		const activeDhtHash = this.store.activeDhtHash.get();
		const activeContent = this.store.activeContent.get();

		return html`
			<div class="column" style="flex: 1">
				${this.hideHeader
					? html``
					: html`
							<span
								class="title row"
								style="margin-bottom: 8px; align-items:center"
							>
								${activeContent.status === 'completed' &&
								activeContent.value &&
								activeContent.value.type
									? 'Action'
									: 'Entry'}
								Contents${activeDhtHash
									? html`<span
											class="row placeholder"
											style="align-items:center"
										>
											, with hash
											<holo-identicon
												.hash=${activeDhtHash}
												style="margin-left: 8px;"
											></holo-identicon
										></span>`
									: html``}</span
							>
						`}
				${activeContent.status === 'completed' && activeContent.value
					? html`
							<div class="column fill">
								<div class="fill flex-scrollable-parent">
									<div class="flex-scrollable-container">
										<div class="flex-scrollable-y" style="height: 100%;">
											<json-viewer
												.data=${shortenStrRec(
													activeContent.value.entry
														? getEntryContents(activeContent.value)
														: activeContent.value,
												)}
												style="flex: 1"
											></json-viewer>
										</div>
									</div>
								</div>
							</div>
						`
					: html`
							<div class="column fill center-content">
								<span class="placeholder">Select entry to inspect.</span>
							</div>
						`}
			</div>
		`;
	}

	static styles = [
		css`
			:host {
				display: flex;
				flex: 1;
			}
		`,
		sharedStyles,
	];
}
