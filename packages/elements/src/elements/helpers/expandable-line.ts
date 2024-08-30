import { wrapPathInSvg } from '@holochain-open-dev/elements';
import { mdiArrowDown, mdiArrowUp } from '@mdi/js';
import '@shoelace-style/shoelace/dist/components/icon-button/icon-button.js';
import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import { sharedStyles } from '../utils/shared-styles.js';

@customElement('expandable-line')
export class ExpandableLine extends LitElement {
	@property({ type: Boolean })
	_expanded = false;

	render() {
		return html`
			<div class="row">
				<sl-icon-button
					style="font-size: 30px; margin-right: 4px;"
					.src=${wrapPathInSvg(this._expanded ? mdiArrowUp : mdiArrowDown)}
					@click=${() => (this._expanded = !this._expanded)}
				></sl-icon-button>

				${this._expanded
					? html` <slot></slot> `
					: html`
							<span class="placeholder" style="align-self: center;"
								>Expand to see the object</span
							>
						`}
			</div>
		`;
	}

	static get styles() {
		return sharedStyles;
	}
}
