import { ScopedElementsMixin } from '@open-wc/scoped-elements';
import { html, LitElement } from 'lit';
import { property, query } from 'lit/decorators.js';
import { IconButton } from '@scoped-elements/material-web';
import { Snackbar } from '@scoped-elements/material-web';
import { sharedStyles } from '../utils/shared-styles';
import { serializeHash } from '@holochain-open-dev/core-types';

export class CopyableHash extends ScopedElementsMixin(LitElement) {
  @property()
  hash!: Uint8Array | string;

  @property({ type: Number })
  sliceLength: number = 8;

  @query('#copy-notification')
  _copyNotification: Snackbar;

  get strHash() {
    return typeof this.hash === 'string' ? this.hash : serializeHash(this.hash);
  }

  async copyHash() {
    await navigator.clipboard.writeText(this.strHash);
    this._copyNotification.show();
  }

  render() {
    return html`
      <mwc-snackbar
        id="copy-notification"
        labelText="Hash copied to clipboard"
      ></mwc-snackbar>
      <div class="row center-content">
        <span style="font-family: monospace;"
          >${this.strHash.substring(0, this.sliceLength)}...</span
        >
        <mwc-icon-button
          style="--mdc-icon-button-size	: 24px; --mdc-icon-size: 20px;"
          icon="content_copy"
          @click=${() => this.copyHash()}
        ></mwc-icon-button>
      </div>
    `;
  }

  static get styles() {
    return sharedStyles;
  }

  static get scopedElements() {
    return {
      'mwc-icon-button': IconButton,
      'mwc-snackbar': Snackbar,
    };
  }
}
