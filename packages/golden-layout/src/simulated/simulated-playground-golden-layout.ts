import { html } from 'lit';
import {
  GoldenLayout,
  GoldenLayoutRegister,
} from '@scoped-elements/golden-layout';
import {
  CallZomeFns,
  ConductorAdmin,
  DhtCells,
  EntryContents,
  DhtEntries,
  SourceChain,
  SimulatedPlaygroundContext,
} from '@holochain-playground/elements';

export class SimulatedPlaygroundGoldenLayout extends SimulatedPlaygroundContext {
  render() {
    return html`
      <golden-layout
        .scopedElements=${{
          'source-chain': SourceChain,
          'dht-cells': DhtCells,
          'conductor-admin': ConductorAdmin,
          'call-zome-fns': CallZomeFns,
          'entry-contents': EntryContents,
          'dht-entries': DhtEntries,
        }}
      >
        <golden-layout-register component-type="source-chain">
          <template>
            <div
              style="height: 100%; width: 100%; overflow: auto; display: flex;"
            >
              <source-chain style="flex: 1; margin: 8px;"></source-chain>
            </div>
          </template>
        </golden-layout-register>
        <golden-layout-register component-type="dht-cells">
          <template>
            <div
              style="height: 100%; width: 100%; overflow: auto; display: flex;"
            >
              <dht-cells style="flex: 1; margin: 8px;"></dht-cells>
            </div>
          </template>
        </golden-layout-register>
        <golden-layout-register component-type="conductor-admin">
          <template>
            <div
              style="height: 100%; width: 100%; overflow: auto; display: flex;"
            >
              <conductor-admin style="flex: 1; margin: 8px;"></conductor-admin>
            </div>
          </template>
        </golden-layout-register>
        <golden-layout-register component-type="call-zome-fns">
          <template>
            <div
              style="height: 100%; width: 100%; overflow: auto; display: flex;"
            >
              <call-zome-fns style="flex: 1; margin: 8px;"></call-zome-fns>
            </div>
          </template>
        </golden-layout-register>
        <golden-layout-register component-type="entry-contents">
          <template>
            <div
              style="height: 100%; width: 100%; overflow: auto; display: flex;"
            >
              <entry-contents style="flex: 1; margin: 8px;"></entry-contents>
            </div>
          </template>
        </golden-layout-register>
        <golden-layout-register component-type="dht-entries">
          <template>
            <div
              style="height: 100%; width: 100%; overflow: auto; display: flex;"
            >
              <dht-entries style="flex: 1; margin: 8px;"></dht-entries>
            </div>
          </template>
        </golden-layout-register>
        ${super.render()}
      </golden-layout>
    `;
  }

  static get scopedElements() {
    return {
      ...SimulatedPlaygroundContext.scopedElements,
      'golden-layout': GoldenLayout,
      'golden-layout-register': GoldenLayoutRegister,
    };
  }
}
