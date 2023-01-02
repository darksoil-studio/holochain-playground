import { html, PropertyValues, css } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import { StoreSubscriber } from 'lit-svelte-stores';
import { CytoscapeDagre } from '@scoped-elements/cytoscape';

import { Card } from '@scoped-elements/material-web';
import isEqual from 'lodash-es/isEqual';
import {
  decodeHashFromBase64,
  encodeHashToBase64,
  NewEntryAction,
} from '@holochain/client';
import { CopiableHash } from '@holochain-open-dev/elements';

import { sourceChainNodes } from './processors';
import { sharedStyles } from '../utils/shared-styles';

import { HelpButton } from '../helpers/help-button';
import { PlaygroundElement } from '../../base/playground-element';
import { graphStyles } from './graph';

/**
 * @element source-chain
 */
export class SourceChain extends PlaygroundElement {
  _activeAgentPubKey = new StoreSubscriber(
    this,
    () => this.store?.activeAgentPubKey
  );

  _activeHash = new StoreSubscriber(this, () => this.store?.activeDhtHash);

  _activeCell = new StoreSubscriber(this, () =>
    this.store ? this.store.activeCell() : undefined
  );

  _sourceChain = new StoreSubscriber(
    this,
    () => this._activeCell.value?.sourceChain
  );

  get elements() {
    if (!this._activeCell.value || !this._sourceChain.value) return [];
    return sourceChainNodes(this._activeCell.value, this._sourceChain.value);
  }

  get selectedNodesIds() {
    if (!this._activeHash.value || !this._sourceChain.value) return [];
    else {
      const nodesIds = [];
      for (const element of this._sourceChain.value) {
        const action = element.signed_action.hashed;
        if (isEqual(action.hash, this._activeHash.value)) {
          return [encodeHashToBase64(this._activeHash.value)];
        }

        const entry_hash = (action.content as NewEntryAction).entry_hash;
        if (
          entry_hash !== undefined &&
          isEqual(entry_hash, this._activeHash.value)
        ) {
          nodesIds.push(
            `${encodeHashToBase64(action.hash)}:${encodeHashToBase64(
              entry_hash
            )}`
          );
        }
      }

      return nodesIds;
    }
  }

  get cytoscapeOptions() {
    return {
      autoungrabify: true,
      userZoomingEnabled: true,
      userPanningEnabled: true,
      style: graphStyles,
    };
  }

  renderHelp() {
    return html` <help-button heading="Source Chain" class="block-help">
      <span>
        This graph displays the source chain of the selected cell. On the
        top-left sequence, you can see the hash-chain of actions. On the
        bottom-right sequence, you can see the entries associated with each
        action. Links between actions
        <br />
        <br />
        Dashed relationships are embedded references: the actions contain the
        hash of the last action, and also the entry hash if they have an entry.
      </span>
    </help-button>`;
  }

  render() {
    return html`
      <mwc-card class="block-card">
        <div class="column fill">
          <span class="block-title row" style="margin: 16px;"
            >Source
            Chain${this._activeAgentPubKey.value
              ? html`
                  <span class="placeholder row">
                    , for Agent
                    <copyable-hash
                      .hash=${this._activeAgentPubKey.value}
                      style="margin-left: 8px;"
                    ></copyable-hash>
                  </span>
                `
              : html``}</span
          >
          ${this.renderHelp()}
          ${this._activeCell.value
            ? html``
            : html`
                <div style="flex: 1;" class="center-content placeholder">
                  <span>Select a cell to display its source chain</span>
                </div>
              `}

          <cytoscape-dagre
            .elements=${this.elements}
            .selectedNodesIds=${this.selectedNodesIds}
            .options=${this.cytoscapeOptions}
            @node-selected=${(e) => {
              let activeHash = e.detail.id();

              if (activeHash.includes(':')) {
                activeHash = activeHash.split(':')[1];
              }

              this.store.activeDhtHash.set(decodeHashFromBase64(activeHash));
            }}
            style=${styleMap({
              display: this._activeCell.value ? '' : 'none',
              flex: '1',
            })}
          ></cytoscape-dagre>
        </div>
      </mwc-card>
    `;
  }

  static get styles() {
    return [
      sharedStyles,
      css`
        :host {
          min-height: 350px;
          min-width: 100px;
          display: flex;
        }
        #source-chain-graph {
          width: 100%;
          height: 100%;
        }
      `,
    ];
  }

  static get scopedElements() {
    return {
      'mwc-card': Card,
      'copyable-hash': CopiableHash,
      'cytoscape-dagre': CytoscapeDagre,
      'help-button': HelpButton,
    };
  }
}
