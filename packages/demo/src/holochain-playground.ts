import { ScopedElementsMixin } from '@open-wc/scoped-elements';
import { LitElement, html, css } from 'lit';
import {
  SimulatedPlaygroundGoldenLayout,
  SimulatedPlaygroundGoldenLayoutMenu,
} from '@holochain-playground/golden-layout';
import {
  GoldenLayoutRoot,
  GoldenLayoutStack,
  GoldenLayoutColumn,
  GoldenLayoutComponent,
  GoldenLayoutRow,
} from '@scoped-elements/golden-layout';
import { TopAppBar, Drawer, IconButton } from '@scoped-elements/material-web';
import { query } from 'lit/decorators.js';

export class HolochainPlayground extends ScopedElementsMixin(LitElement) {
  @query('mwc-drawer')
  drawer!: Drawer;

  render() {
    return html`
      <holochain-playground-golden-layout style="flex: 1;">
        <mwc-drawer hasHeader type="modal" style="flex:1;">
          <span slot="title">Blocks</span>
          <span slot="subtitle">Drag-and-drop items </span>

          <holochain-playground-golden-layout-menu></holochain-playground-golden-layout-menu>
          <div slot="appContent" style="height: 100%; display: flex;">
            <mwc-top-app-bar>
              <mwc-icon-button
                slot="navigationIcon"
                @click=${() => {
                  this.drawer.open = true;
                }}
                icon="menu"
              ></mwc-icon-button>
              <div slot="title">Holochain Playground</div>
            </mwc-top-app-bar>
            <golden-layout-root style="flex: 1; margin-top: 66px;">
              <golden-layout-row>
                <golden-layout-component
                  component-type="dht-cells"
                ></golden-layout-component>
                <golden-layout-column>
                  <golden-layout-row>
                    <golden-layout-component
                      component-type="call-zome-fns"
                    ></golden-layout-component>
                    <golden-layout-stack>
                      <golden-layout-component
                        component-type="entry-contents"
                      ></golden-layout-component>
                    </golden-layout-stack>
                  </golden-layout-row>
                  <golden-layout-stack>
                    <golden-layout-component
                      component-type="dht-entries"
                    ></golden-layout-component>
                    <golden-layout-component
                      component-type="source-chain"
                    ></golden-layout-component>
                  </golden-layout-stack>
                </golden-layout-column>
              </golden-layout-row>
            </golden-layout-root>
          </div>
        </mwc-drawer>
      </holochain-playground-golden-layout>
    `;
  }

  static get scopedElements() {
    return {
      'holochain-playground-golden-layout': SimulatedPlaygroundGoldenLayout,
      'golden-layout-root': GoldenLayoutRoot,
      'mwc-top-app-bar': TopAppBar,
      'mwc-drawer': Drawer,
      'mwc-icon-button': IconButton,
      'golden-layout-row': GoldenLayoutRow,
      'golden-layout-stack': GoldenLayoutStack,
      'golden-layout-component': GoldenLayoutComponent,
      'golden-layout-column': GoldenLayoutColumn,
      'holochain-playground-golden-layout-menu':
        SimulatedPlaygroundGoldenLayoutMenu,
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
