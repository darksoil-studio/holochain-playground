import { ScopedElementsMixin } from '@open-wc/scoped-elements';
import { html, LitElement } from 'lit';
import { property, state } from 'lit/decorators.js';
import { ref } from 'lit/directives/ref.js';
import { IconButton } from '@scoped-elements/material-web';
import { sharedStyles } from '../utils/shared-styles';

export class EditableField extends ScopedElementsMixin(LitElement) {
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
      new CustomEvent('field-saved', { detail: { value: this._newValue } })
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

  setupField(fieldSlot: HTMLSlotElement) {
    if (!fieldSlot) return;

    setTimeout(() => {
      const field = fieldSlot.assignedNodes({
        flatten: true,
      })[1] as HTMLInputElement;

      field.addEventListener('input', (e) => {
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
            ><mwc-icon-button
              @click=${() => this.save()}
              .disabled=${!this._valid}
              icon="save"
            ></mwc-icon-button
            ><mwc-icon-button
              @click=${() => this.cancel()}
              icon="close"
            ></mwc-icon-button>`
        : html`<span class="center-content">${this.value}</span
            ><mwc-icon-button
              class="placeholder"
              @click=${() => (this._editing = true)}
              icon="mode_edit"
            ></mwc-icon-button>`}
    </div>`;
  }

  static get scopedElements() {
    return {
      'mwc-icon-button': IconButton,
    };
  }

  static styles = [sharedStyles];
}
