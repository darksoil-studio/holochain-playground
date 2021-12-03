import { html, css } from 'lit';
import { ListItem, Card, Select } from '@scoped-elements/material-web';
import { StoreSubscriber } from 'lit-svelte-stores';
import { serializeHash } from '@holochain-open-dev/core-types';
import { DnaHash } from '@holochain/conductor-api';
import isEqual from 'lodash-es/isEqual';

import { PlaygroundElement } from '../../base/playground-element';
import { sharedStyles } from '../utils/shared-styles';

export class SelectActiveDna extends PlaygroundElement {
  _allDnas = new StoreSubscriber(this, () => this.store?.allDnas());
  _activeDna = new StoreSubscriber(this, () => this.store?.activeDna);

  selectDNA(dna: DnaHash) {
    this.store.activeDna.set(dna);
  }

  renderDna(dna: DnaHash) {
    const strDna = serializeHash(dna);

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
