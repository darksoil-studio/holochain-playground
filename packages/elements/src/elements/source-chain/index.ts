import { html, PropertyValues, css } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import { StoreSubscriber } from 'lit-svelte-stores';
import { CytoscapeDagre } from '@scoped-elements/cytoscape';

import { Card } from '@scoped-elements/material-web';
import { deserializeHash, serializeHash } from '@holochain-open-dev/core-types';

import { sourceChainNodes } from './processors';
import { sharedStyles } from '../utils/shared-styles';

import { HelpButton } from '../helpers/help-button';
import { PlaygroundElement } from '../../base/playground-element';
import { graphStyles } from './graph';
import { CopyableHash } from '../helpers/copyable-hash';

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
    if (!this._activeHash.value) return [];
    else return [serializeHash(this._activeHash.value)];
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
        top-left sequence, you can see the hash-chain of headers. On the
        bottom-right sequence, you can see the entries associated with each
        header. Links between headers
        <br />
        <br />
        Dashed relationships are embedded references: the headers contain the
        hash of the last header, and also the entry hash if they have an entry.
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

              this.store.activeDhtHash.set(deserializeHash(activeHash));
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
      'copyable-hash': CopyableHash,
      'cytoscape-dagre': CytoscapeDagre,
      'help-button': HelpButton,
    };
  }
}
