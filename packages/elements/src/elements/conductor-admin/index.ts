import { html, css, PropertyValues } from 'lit';
import { state } from 'lit/decorators.js';
import { ref, createRef } from 'lit/directives/ref.js';

import {
  Card,
  IconButton,
  Tab,
  TabBar,
  List,
  ListItem,
  Button,
} from '@scoped-elements/material-web';
import { Grid, GridColumn } from '@vaadin/grid';
import { JsonViewer } from '@power-elements/json-viewer';
import { StoreSubscriber } from 'lit-svelte-stores';
import { derived } from 'svelte/store';
import isEqual from 'lodash-es/isEqual.js';
import '@holochain-open-dev/elements/dist/elements/holo-identicon.js';

import { sharedStyles } from '../utils/shared-styles.js';
import { PlaygroundElement } from '../../base/playground-element.js';
import { selectCell } from '../../base/selectors.js';
import { HelpButton } from '../helpers/help-button.js';
import { adminApi } from './admin-api.js';
import { CallFns } from '../helpers/call-functions.js';
import { CellStore, ConductorStore } from '../../store/playground-store.js';
import { ConnectedConductorStore } from '../../store/connected-playground-store.js';
import {
  SimulatedCellStore,
  SimulatedConductorStore,
  SimulatedPlaygroundStore,
} from '../../store/simulated-playground-store.js';
import { encodeHashToBase64 } from '@holochain/client';

export class ConductorAdmin extends PlaygroundElement {
  _activeAgentPubKey = new StoreSubscriber(
    this,
    () => this.store?.activeAgentPubKey
  );

  _activeDna = new StoreSubscriber(this, () => this.store?.activeDna);

  _activeConductor = new StoreSubscriber(this, () =>
    derived(this.store?.activeCell(), (c) => c?.conductorStore)
  );

  _happs = new StoreSubscriber(
    this,
    () => (this.store as SimulatedPlaygroundStore)?.happs
  );

  _cellsForActiveConductor = new StoreSubscriber(
    this,
    () => this._activeConductor.value?.cells
  );

  @state()
  private _selectedTabIndex: number = 0;

  private _grid = createRef<Grid>();

  get isSimulated() {
    return this.store && this.store instanceof SimulatedPlaygroundStore;
  }

  renderHelp() {
    return html`
      <help-button
        heading="Conductor Admin Help"
        style="--mdc-dialog-max-width: 700px"
        class="block-help"
      >
        <span>
          You've selected the conductor with Agent ID
          ${this._activeAgentPubKey.value
            ? encodeHashToBase64(this._activeAgentPubKey.value)
            : undefined}.
          Here you can see all the cells that it's running, as well as execute
          admin functions for it.
        </span>
      </help-button>
    `;
  }

  updated(changedValues: PropertyValues) {
    super.updated(changedValues);
    if (this._grid.value) {
      this._grid.value.requestContentUpdate();
    }
  }

  setupGrid(grid: Grid) {
    setTimeout(() => {
      if (!grid) return;
      const dnaColumn = this.shadowRoot.querySelector(
        '#dna-column'
      ) as GridColumn;
      dnaColumn.renderer = (root: any, column, model) => {
        const cell = model.item as any as CellStore<any>;
        root.innerHTML = `<holo-identicon hash="${encodeHashToBase64(
          cell.cellId[0]
        )}"></holo-identicon>`;
        root.item = model.item;
      };
      const agentPubKeyColumn = this.shadowRoot.querySelector(
        '#agent-pub-key-column'
      ) as GridColumn;
      agentPubKeyColumn.renderer = (root: any, column, model) => {
        const cell = model.item as any as CellStore<any>;
        root.innerHTML = `<holo-identicon hash="${encodeHashToBase64(
          cell.cellId[1]
        )}"></holo-identicon>`;
        root.item = model.item;
      };

      if (this.isSimulated) {
        grid.rowDetailsRenderer = function (root, grid, model) {
          if (!root.firstElementChild) {
            const cell = model.item as any as CellStore<any>;

            if (cell instanceof SimulatedCellStore) {
              root.innerHTML = `
            <div class="column" style="padding: 8px; padding-top: 0">
            <span>uid: "${cell.dna.uid}"</span>
            <div class="row">
            <span>Properties:</span>
            <json-viewer style="margin-left: 8px">
            <script type="application/json">
            ${JSON.stringify(cell.dna.properties)}
            </script>
            </json-viewer>
            </div>
            </div>
            `;
            }
          }
        };

        const detailsToggleColumn = this.shadowRoot.querySelector(
          '#details'
        ) as GridColumn;
        detailsToggleColumn.renderer = function (root: any, column, model) {
          if (!root.firstElementChild) {
            root.innerHTML = '<mwc-button label="Details"></mwc-button>';
            let opened = false;
            root.firstElementChild.addEventListener('click', (e: any) => {
              if (!opened) {
                grid.openItemDetails(root.item);
              } else {
                grid.closeItemDetails(root.item);
              }
              opened = !opened;
            });
          }
          root.item = model.item;
        };
      }

      const selectColumn = this.shadowRoot.querySelector(
        '#select'
      ) as GridColumn;
      selectColumn.renderer = (root: any, column, model) => {
        const cell = model.item as any as CellStore<any>;

        const isSelected =
          isEqual(this._activeDna.value, cell.cellId[0]) &&
          isEqual(this._activeAgentPubKey.value, cell.cellId[1]);
        root.innerHTML = `<mwc-button label="Select" ${
          isSelected ? 'disabled' : ''
        }></mwc-button>`;
        root.firstElementChild.addEventListener('click', (e: any) => {
          const cell = model.item as any as CellStore<any>;

          this.store.activeDna.set(cell.cellId[0]);
          this.store.activeAgentPubKey.set(cell.cellId[1]);
        });

        root.item = model.item;
      };
    });
  }

  renderCells() {
    const cells = this._cellsForActiveConductor.value;
    if (!cells) return html``;

    const items = cells.values();

    return html`
      <div class="column fill">
        <vaadin-grid
          .items=${items}
          ${ref(this._grid)}
          ${ref((el) => this.setupGrid(el as Grid))}
        >
          <vaadin-grid-column
            path="dna"
            action="Dna"
            id="dna-column"
          ></vaadin-grid-column>
          <vaadin-grid-column
            id="agent-pub-key-column"
            path="agentPubKey"
            action="Agent Pub Key"
          ></vaadin-grid-column>
          ${this.isSimulated
            ? html`
                <vaadin-grid-column
                  flex-grow="0"
                  id="details"
                ></vaadin-grid-column>
              `
            : html``}
          <vaadin-grid-column flex-grow="0" id="select"></vaadin-grid-column>
        </vaadin-grid>
      </div>
    `;
  }

  renderAdminAPI() {
    if (!this.isSimulated)
      return html`<div class="column fill center-content">
        <span class="placeholder" style="margin: 16px;"
          >Calling a connected admin conductor interface is not yet
          available.</span
        >
      </div>`;
    const conductor = this._activeConductor.value;

    const adminApiFns = adminApi(
      this,
      this._happs.value,
      conductor as SimulatedConductorStore
    );

    return html` <div class="column fill">
      <call-functions .callableFns=${adminApiFns}></call-functions>
    </div>`;
  }

  renderContent() {
    if (!this._activeConductor.value)
      return html`
        <div class="column fill center-content">
          <span class="placeholder"
            >Select a cell to inspect its conductor</span
          >
        </div>
      `;
    return html`
      ${this.renderHelp()}

      <div class="column fill">
        <mwc-tab-bar
          @MDCTabBar:activated=${(e) => {
            this._selectedTabIndex = e.detail.index;
          }}
          .activeIndex=${this._selectedTabIndex}
        >
          <mwc-tab label="Cells"></mwc-tab>
          <mwc-tab label="Admin API"></mwc-tab>
        </mwc-tab-bar>
        ${this._selectedTabIndex === 0
          ? this.renderCells()
          : this.renderAdminAPI()}
      </div>
    `;
  }

  renderName() {
    if (this.isSimulated)
      return (this._activeConductor.value as SimulatedConductorStore).name;
    return (this._activeConductor.value as ConnectedConductorStore).url;
  }

  render() {
    return html`
      <mwc-card class="block-card">
        <div class="column fill">
          <div class="row" style="padding: 16px">
            <div class="column" style="flex: 1;">
              <span class="title"
                >Conductor
                Admin${this._activeConductor.value
                  ? html`<span class="placeholder"
                      >, for ${this.renderName()}</span
                    >`
                  : html``}</span
              >
            </div>
          </div>
          <div class="column fill">${this.renderContent()}</div>
        </div>
      </mwc-card>
    `;
  }

  static get styles() {
    return [
      sharedStyles,
      css`
        :host {
          display: flex;
        }
        .bottom-border {
          border-bottom: 1px solid lightgrey;
        }
      `,
    ];
  }

  static get scopedElements() {
    return {
      'call-functions': CallFns,
      'mwc-tab': Tab,
      'vaadin-grid': Grid,
      'vaadin-grid-column': GridColumn,
      'mwc-tab-bar': TabBar,
      'mwc-list': List,
      'json-viewer': JsonViewer,
      'mwc-list-item': ListItem,
      'mwc-card': Card,
      'mwc-button': Button,
      'mwc-icon-button': IconButton,
      'help-button': HelpButton,
    };
  }
}
