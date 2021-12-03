import { property, query } from 'lit/decorators.js';
import { html, LitElement } from 'lit';
import { Button, Dialog, IconButton } from '@scoped-elements/material-web';
import { ScopedElementsMixin } from '@open-wc/scoped-elements';

export class HelpButton extends ScopedElementsMixin(LitElement) {
  @property({ type: String })
  heading: string;

  @query('#help-dialog')
  _helpDialog: Dialog;

  renderHelpDialog() {
    return html`
      <mwc-dialog id="help-dialog" .heading=${this.heading}>
        <slot></slot>
        <mwc-button slot="primaryAction" dialogAction="cancel">
          Got it!
        </mwc-button>
      </mwc-dialog>
    `;
  }

  render() {
    return html`
      ${this.renderHelpDialog()}
      <mwc-icon-button
        icon="help_outline"
        @click=${() => this._helpDialog.show()}
      ></mwc-icon-button>
    `;
  }

  static get scopedElements() {
    return {
      'mwc-icon-button': IconButton,
      'mwc-button': Button,
      'mwc-dialog': Dialog,
    };
  }
}
