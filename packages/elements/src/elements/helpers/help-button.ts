import { wrapPathInSvg } from '@holochain-open-dev/elements';
import { mdiHelpCircleOutline } from '@mdi/js';
import '@shoelace-style/shoelace/dist/components/button/button.js';
import '@shoelace-style/shoelace/dist/components/dialog/dialog.js';
import SlDialog from '@shoelace-style/shoelace/dist/components/dialog/dialog.js';
import '@shoelace-style/shoelace/dist/components/icon-button/icon-button.js';
import { LitElement, html } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';

@customElement('help-button')
export class HelpButton extends LitElement {
	@property({ type: String })
	heading!: string;

	@query('#help-dialog')
	_helpDialog!: SlDialog;

	renderHelpDialog() {
		return html`
			<sl-dialog id="help-dialog" .label=${this.heading}>
				<slot></slot>
			</sl-dialog>
		`;
	}

	render() {
		return html`
			${this.renderHelpDialog()}
			<sl-icon-button
				.src=${wrapPathInSvg(mdiHelpCircleOutline)}
				@click=${() => this._helpDialog.show()}
			></sl-icon-button>
		`;
	}
}
