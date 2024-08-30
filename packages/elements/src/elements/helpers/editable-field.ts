import { wrapPathInSvg } from '@holochain-open-dev/elements';
import { mdiClose, mdiContentSave, mdiPencil } from '@mdi/js';
import '@shoelace-style/shoelace/dist/components/icon-button/icon-button.js';
import { LitElement, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { ref } from 'lit/directives/ref.js';

import { sharedStyles } from '../utils/shared-styles.js';

@customElement('editable-field')
export class EditableField extends LitElement {
	@property()
	value: any;

	@state()
	_editing: boolean = false;
	@state()
	_newValue: any;
	@state()
	_valid: boolean = true;

	save() {
		this.dispatchEvent(
			new CustomEvent('field-saved', { detail: { value: this._newValue } }),
		);
		this._editing = false;
	}

	cancel() {
		this._editing = false;
		this._newValue = this.value;
	}

	firstUpdated() {
		this._newValue = this.value;
	}

	setupField(fieldSlot: Element | undefined) {
		if (!fieldSlot) return;

		setTimeout(() => {
			const field = (fieldSlot as HTMLSlotElement).assignedNodes({
				flatten: true,
			})[1] as HTMLInputElement;

			field.addEventListener('input', e => {
				field.reportValidity();
				this._newValue = (field as any).value;
				this._valid = (field as any).validity.valid;
			});
		});
	}

	render() {
		return html`<div class="row">
			${this._editing
				? html` <slot ${ref(this.setupField)}></slot
						><sl-icon-button
							@click=${() => this.save()}
							.disabled=${!this._valid}
							.src=${wrapPathInSvg(mdiContentSave)}
						></sl-icon-button
						><sl-icon-button
							@click=${() => this.cancel()}
							.src=${wrapPathInSvg(mdiClose)}
						></sl-icon-button>`
				: html`<span class="center-content">${this.value}</span
						><sl-icon-button
							class="placeholder"
							@click=${() => (this._editing = true)}
							.src=${wrapPathInSvg(mdiPencil)}
						></sl-icon-button>`}
		</div>`;
	}

	static styles = [sharedStyles];
}
