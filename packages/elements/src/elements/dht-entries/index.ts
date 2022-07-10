import { html, css } from 'lit';
import { state, property, query } from 'lit/decorators.js';

import cytoscape from 'cytoscape';

import {
  Checkbox,
  IconButton,
  Formfield,
  Card,
  Menu,
  Button,
  Icon,
  ListItem,
} from '@scoped-elements/material-web';
import { isEqual } from 'lodash-es';

import { deserializeHash, serializeHash } from '@holochain-open-dev/utils';
import { StoreSubscriber } from 'lit-svelte-stores';
import { DhtOp } from '@holochain/client';
import { CellMap } from '@holochain-playground/simulator';
import { CytoscapeCoseBilkent } from '@scoped-elements/cytoscape';

import { allEntries } from './processors';
import { sharedStyles } from '../utils/shared-styles';
import { HelpButton } from '../helpers/help-button';

import { cytoscapeConfig } from './graph';
import { PlaygroundElement } from '../../base/playground-element';
import { CopyableHash } from '../helpers/copyable-hash';
import { cytoscapeOptions } from '../dht-cells/graph';
import {
  SimulatedCellStore,
  SimulatedPlaygroundStore,
} from '../../store/simulated-playground-store';

/**
 * @element dht-entries
 */
export class DhtEntries extends PlaygroundElement {
  @property({ type: Boolean, attribute: 'hide-filter' })
  hideFilter: boolean = false;

  @property({ type: Boolean, attribute: 'show-entry-contents' })
  showEntryContents: boolean = false;

  @property({ type: Boolean, attribute: 'hide-deleted' })
  hideDeleted: boolean = false;

  @property({ type: Boolean, attribute: 'hide-actions' })
  hideActions: boolean = true;
  
  @property({ type: Boolean, attribute: 'show-only-active-agents-shard' })
  showOnlyActiveAgentsShard: boolean = false;

  @property({ type: Array })
  excludedEntryTypes: string[] = [];

  @state()
  private _entryTypes = [];

  @query('#visible-entries-button')
  private _visibleEntriesButton: Button;
  
  @query('#visible-entries-menu')
  private _visibleEntriesMenu: Menu;

  _cellsForActiveDna = new StoreSubscriber(this, () =>
    this.store?.cellsForActiveDna()
  );
  
  _activeDhtHash = new StoreSubscriber(this, () => this.store?.activeDhtHash);
  
  _activeDna = new StoreSubscriber(this, () => this.store?.activeDna);
  
  _activeAgentPubKey = new StoreSubscriber(
    this,
    () => this.store?.activeAgentPubKey
  );
  
  _dht = new StoreSubscriber(this, () => this.store?.dhtForActiveDna());

  get _simulatedDna() {
    const cells = this._cellsForActiveDna.value?.values();
    return cells && cells.length > 0
      ? (cells[0] as SimulatedCellStore).dna
      : undefined;
  }

  get elements() {
    let dht = this._dht.value;
    if (!dht) return undefined;

    if (this.showOnlyActiveAgentsShard && this._activeAgentPubKey.value) {
      dht = new CellMap<DhtOp[]>([
        dht
          .entries()
          .find(([cellId, _]) =>
            isEqual(cellId[1], this._activeAgentPubKey.value)
          ),
      ]);
    }

    const { nodes, edges, entryTypes } = allEntries(
      dht,
      this._simulatedDna,
      this.showEntryContents,
      !this.hideDeleted,
      this.hideActions,
      this.excludedEntryTypes
    );
    this._entryTypes = entryTypes;

    return [...nodes, ...edges];
  }

  get selectedNodesIds() {
    return this._activeDhtHash.value
      ? [serializeHash(this._activeDhtHash.value)]
      : [];
  }

  renderHelp() {
    return html` <help-button heading="Dht Entries" class="block-help">
      <span>
        This graph contains a
        <strong>high-level view of all the entries</strong> that are present in
        the Dht. Every object you see represents an entry, and the relationships
        between them are links.
        <br />
        <br />
        Dashed relationships are embedded references, and solid relationships
        are normal holochain links. The tag of the holochain links appears as
        the label.
      </span>
    </help-button>`;
  }

  renderFilter() {
    return html` <div
      class="row"
      style="align-items: center; justify-content: start;"
      style="margin: 8px;"
    >
      <mwc-formfield label="Show Entry Contents" style="margin-right: 16px">
        <mwc-checkbox
          .checked=${this.showEntryContents}
          @change=${(e) => (this.showEntryContents = e.target.checked)}
        ></mwc-checkbox
      ></mwc-formfield>

      <mwc-formfield label="Show Actions" style="margin-right: 16px">
        <mwc-checkbox
          .checked=${this.hideActions}
          @change=${(e) => (this.hideActions = e.target.checked)}
        ></mwc-checkbox
      ></mwc-formfield>

      <mwc-formfield
        label="Show Only Active Agent's Shard"
        style="margin-right: 16px"
      >
        <mwc-checkbox
          .checked=${this.showOnlyActiveAgentsShard}
          @change=${(e) => (this.showOnlyActiveAgentsShard = e.target.checked)}
        ></mwc-checkbox
      ></mwc-formfield>

      <span class="vertical-divider"></span>

      <div class="row" style="position: relative;">
        <mwc-button
          label="Visible entries"
          style="--mdc-theme-primary: rgba(0,0,0,0.7); margin-left: 16px;"
          icon="arrow_drop_down"
          id="visible-entries-button"
          trailingIcon
          @click=${() => this._visibleEntriesMenu.show()}
        ></mwc-button>
        <mwc-menu
          corner="BOTTOM_RIGHT"
          multi
          fixed
          activatable
          id="visible-entries-menu"
          .anchor=${this._visibleEntriesButton}
          @selected=${(e) => {
            const includedEntryTypes = [...e.detail.index];
            this.excludedEntryTypes = this._entryTypes.filter(
              (type, index) => !includedEntryTypes.includes(index)
            );
          }}
        >
          ${this._entryTypes.map(
            (type) => html`
              <mwc-list-item
                graphic="icon"
                .selected=${!this.excludedEntryTypes.includes(type)}
                .activated=${!this.excludedEntryTypes.includes(type)}
              >
                ${!this.excludedEntryTypes.includes(type)
                  ? html` <mwc-icon slot="graphic">check</mwc-icon> `
                  : html``}
                ${type}
              </mwc-list-item>
            `
          )}
        </mwc-menu>
      </div>
    </div>`;
  }

  render() {
    return html`
      <mwc-card class="block-card" style="position: relative;">
        <div class="column fill">
          <span class="block-title row" style="margin: 16px; margin-bottom: 0;"
            >Dht
            Entries${this._activeDna.value
              ? html`
                  <span class="placeholder row">
                    , for Dna
                    <copyable-hash
                      .hash=${this._activeDna.value}
                      style="margin-left: 8px;"
                    ></copyable-hash>
                  </span>
                `
              : html``}</span
          >

          <cytoscape-cose-bilkent
            .elements=${this.elements}
            .selectedNodesIds=${this.selectedNodesIds}
            class="fill"
            .options=${cytoscapeConfig}
            @node-selected=${(e) =>
              this.store?.activeDhtHash.set(deserializeHash(e.detail.id()))}
          ></cytoscape-cose-bilkent>

          ${this.renderHelp()}
          ${!this.hideFilter ? this.renderFilter() : html``}
        </div>
      </mwc-card>
    `;
  }

  static get scopedElements() {
    return {
      'mwc-checkbox': Checkbox,
      'mwc-formfield': Formfield,
      'mwc-icon-button': IconButton,
      'copyable-hash': CopyableHash,
      'mwc-card': Card,
      'mwc-menu': Menu,
      'mwc-icon': Icon,
      'mwc-list-item': ListItem,
      'mwc-button': Button,
      'help-button': HelpButton,
      'cytoscape-cose-bilkent': CytoscapeCoseBilkent,
    };
  }

  static get styles() {
    return [
      sharedStyles,
      css`
        :host {
          display: flex;
          min-height: 300px;
          min-width: 300px;
        }
      `,
    ];
  }
}
