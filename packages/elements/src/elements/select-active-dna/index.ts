import { html, css } from 'lit';
import { ListItem, Card, Select } from '@scoped-elements/material-web';
import { StoreSubscriber } from 'lit-svelte-stores';
import { DnaHash, encodeHashToBase64 } from '@holochain/client';
import isEqual from 'lodash-es/isEqual.js';

import { PlaygroundElement } from '../../base/playground-element.js';
import { sharedStyles } from '../utils/shared-styles.js';

export class SelectActiveDna extends PlaygroundElement {
  _allDnas = new StoreSubscriber(this, () => this.store?.allDnas());
  _activeDna = new StoreSubscriber(this, () => this.store?.activeDna);

  selectDNA(dna: DnaHash) {
    this.store.activeDna.set(dna);
  }

  renderDna(dna: DnaHash) {
    const strDna = encodeHashToBase64(dna);

    return html`
      <mwc-list-item
        ?selected=${isEqual(this._activeDna.value, dna)}
        .value=${strDna}
        >${strDna}</mwc-list-item
      >
    `;
  }

  render() {
    return html`
      <mwc-card class="block-card">
        <div class="column" style="margin: 16px;">
          <span class="block-title" style="margin-bottom: 16px;"
            >Select Active Dna</span
          >
          <mwc-select
            outlined
            fullwidth
            @selected=${(e) =>
              this.selectDNA(this._allDnas.value[e.detail.index])}
          >
            ${this._allDnas.value?.map((dna) => this.renderDna(dna))}
          </mwc-select>
        </div>
      </mwc-card>
    `;
  }

  static get styles() {
    return [
      css`
        :host {
          display: flex;
          flex: 1;
        }
      `,
      sharedStyles,
    ];
  }

  static get scopedElements() {
    return {
      'mwc-list-item': ListItem,
      'mwc-select': Select,
      'mwc-card': Card,
    };
  }
}
