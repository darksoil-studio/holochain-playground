import { StoreSubscriber } from 'lit-svelte-stores';
import { html } from 'lit';
import { JsonViewer } from '@power-elements/json-viewer';
import { Card } from '@scoped-elements/material-web';
import '@holochain-open-dev/elements/dist/elements/holo-identicon.js';

import { sharedStyles } from '../utils/shared-styles.js';
import { shortenStrRec } from '../utils/hash.js';
import { PlaygroundElement } from '../../base/playground-element.js';
import { getEntryContents } from '../utils/utils.js';

/**
 * @element entry-contents
 */
export class EntryContents extends PlaygroundElement {
  _activeDhtHash = new StoreSubscriber(this, () => this.store?.activeDhtHash);

  _activeContent = new StoreSubscriber(this, () => this.store?.activeContent());

  render() {
    return html`
      <mwc-card style="width: auto; min-height: 200px;" class="fill">
        <div class="column fill" style="padding: 16px;">
          <span class="title row" style="margin-bottom: 8px;">
            ${this._activeContent.value && this._activeContent.value.type
              ? 'Action'
              : 'Entry'}
            Contents${this._activeDhtHash.value
              ? html`<span class="row placeholder">
                  , with hash
                  <holo-identicon
                    .hash=${this._activeDhtHash.value}
                    style="margin-left: 8px;"
                  ></holo-identicon
                ></span>`
              : html``}</span
          >
          ${this._activeContent.value
            ? html`
                <div class="column fill">
                  <div class="fill flex-scrollable-parent">
                    <div class="flex-scrollable-container">
                      <div class="flex-scrollable-y" style="height: 100%;">
                        <json-viewer
                          .object=${shortenStrRec(
                            this._activeContent.value.entry
                              ? getEntryContents(this._activeContent.value)
                              : this._activeContent.value
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
      </mwc-card>
    `;
  }

  static get scopedElements() {
    return {
      'json-viewer': JsonViewer,
      'mwc-card': Card,
    };
  }

  static styles = [sharedStyles];
}
