import { ScopedElementsMixin } from '@open-wc/scoped-elements';
import { html, LitElement } from 'lit';
import { property } from 'lit/decorators.js';
import { IconButton } from '@scoped-elements/material-web';

import { sharedStyles } from '../utils/shared-styles';

export class ExpandableLine extends ScopedElementsMixin(LitElement) {
  @property({ type: Boolean })
  _expanded = false;

  render() {
    return html`
      <div class="row">
        <mwc-icon-button
          style="--mdc-icon-button-size: 30px; margin-right: 4px;"
          .icon=${this._expanded ? 'arrow_drop_up' : 'arrow_drop_down'}
          @click=${() => (this._expanded = !this._expanded)}
        ></mwc-icon-button>

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

  static get scopedElements() {
    return {
      'mwc-icon-button': IconButton,
    };
  }
}
