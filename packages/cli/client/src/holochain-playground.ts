import { ScopedElementsMixin } from '@open-wc/scoped-elements';
import { LitElement, html, css } from 'lit';
import {
  ConnectedPlaygroundGoldenLayout,
  ConnectedPlaygroundGoldenLayoutMenu,
} from '@holochain-playground/golden-layout';
import {
  GoldenLayoutRoot,
  GoldenLayoutStack,
  GoldenLayoutColumn,
  GoldenLayoutComponent,
  GoldenLayoutRow,
} from '@scoped-elements/golden-layout';
import {
  TopAppBar,
  Drawer,
  IconButton,
  CircularProgress,
} from '@scoped-elements/material-web';
import { query, state } from 'lit/decorators.js';
import { io, Socket } from 'socket.io-client';
import { ConnectedPlaygroundStore } from '@holochain-playground/elements';

export const socket: Socket = io();

export class HolochainPlayground extends ScopedElementsMixin(LitElement) {
  @query('mwc-drawer')
  drawer!: Drawer;

  @state()
  urls: string[] = [];

  ready = false;

  async firstUpdated() {
    socket.on('urls-updated', (response: { urls: string[] }) => {
      this.urls = response.urls;
    });
  }

  render() {
    if (this.urls.length === 0)
      return html`
        <div
          style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center"
        >
          <mwc-circular-progress indeterminate></mwc-circular-progress>
          <span style="margin-top: 16px;">Connecting to conductors... </span
          ><span style="margin-top: 16px; width: 600px;"
            >If this doesn't work, check that the holochain-playground command
            is being run in a folder with <b>.hc_live_*</b> files, or with some
            URLs as arguments, like
            <b>holochain-playground ws://localhost:8888</b>.</span
          ><span style="margin-top: 16px; width: 600px;"
            >See the documentation at
            <a href="https://www.npmjs.com/package/@holochain-playground/cli"
              >https://www.npmjs.com/package/@holochain-playground/cli</a
            >.</span
          >
        </div>
      `;

    return html`
      <connected-playground-golden-layout
        id="context"
        style="flex: 1;"
        .urls=${this.urls}
        @playground-ready=${e => {
          const store = e.detail.store as ConnectedPlaygroundStore;
          store.conductors.subscribe(c => {
            if (!c || c.length === 0) return;
            c[0].cells.subscribe(cells => {
              if (!this.ready && cells.entries().length > 0) {
                this.ready = true;
                store.activeDna.set(cells.entries()[0][0][0]);
                if (this.urls.length === 1) {
                  store.activeAgentPubKey.set(cells.entries()[0][0][1]);
                }
              }
            });
          });
        }}
      >
        <mwc-drawer hasHeader type="modal" style="flex:1;">
          <span slot="title">Blocks</span>
          <span slot="subtitle">Drag-and-drop items </span>

          <connected-playground-golden-layout-menu></connected-playground-golden-layout-menu>
          <div slot="appContent" style="height: 100%; display: flex;">
            <mwc-top-app-bar>
              <mwc-icon-button
                slot="navigationIcon"
                @click=${() => {
                  this.drawer.open = true;
                }}
                icon="menu"
              ></mwc-icon-button>
              <div slot="title">
                Holochain Playground, for nodes at ${this.urls.toString()}
              </div>
            </mwc-top-app-bar>
            <golden-layout-root style="flex: 1; margin-top: 66px;">
              <golden-layout-row>
                <golden-layout-component
                  component-type="source-chain"
                  width="30"
                ></golden-layout-component>
                <golden-layout-column>
                  <golden-layout-component
                    component-type="dht-entries"
                  ></golden-layout-component>

                  <golden-layout-row>
                    <golden-layout-component
                      component-type="dht-cells"
                      height="40"
                    ></golden-layout-component>

                    <golden-layout-stack>
                      <golden-layout-component
                        component-type="entry-contents"
                      ></golden-layout-component>
                      <golden-layout-component
                        component-type="conductor-admin"
                      ></golden-layout-component>
                    </golden-layout-stack>
                  </golden-layout-row>
                </golden-layout-column>
              </golden-layout-row>
            </golden-layout-root>
          </div>
        </mwc-drawer>
      </connected-playground-golden-layout>
    `;
  }

  static get scopedElements() {
    return {
      'connected-playground-golden-layout': ConnectedPlaygroundGoldenLayout,
      'golden-layout-root': GoldenLayoutRoot,
      'mwc-top-app-bar': TopAppBar,
      'mwc-drawer': Drawer,
      'mwc-icon-button': IconButton,
      'mwc-circular-progress': CircularProgress,
      'golden-layout-row': GoldenLayoutRow,
      'golden-layout-stack': GoldenLayoutStack,
      'golden-layout-component': GoldenLayoutComponent,
      'golden-layout-column': GoldenLayoutColumn,
      'connected-playground-golden-layout-menu':
        ConnectedPlaygroundGoldenLayoutMenu,
    };
  }

  static get styles() {
    return css`
      :host {
        display: flex;
      }
    `;
  }
}
