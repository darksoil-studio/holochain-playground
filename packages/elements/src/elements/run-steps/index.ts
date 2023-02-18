import { html, css } from 'lit';
import { state, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';

import { StoreSubscriber } from 'lit-svelte-stores';
import { CellMap } from '@holochain-open-dev/utils';
import {
  ListItem,
  Card,
  List,
  Button,
  CircularProgress,
} from '@scoped-elements/material-web';

import { sharedStyles } from '../utils/shared-styles.js';
import { PlaygroundElement } from '../../base/playground-element.js';
import {
  SimulatedCellStore,
  SimulatedPlaygroundStore,
} from '../../store/simulated-playground-store.js';

export interface Step {
  title: (context: PlaygroundElement) => string;
  run: (context: PlaygroundElement) => Promise<void>;
}

export class RunSteps extends PlaygroundElement<SimulatedPlaygroundStore> {
  _cells = new StoreSubscriber(this, () => this.store?.cellsForActiveDna());

  @property({ type: Array })
  steps!: Array<Step>;

  @state()
  _runningStepIndex: number | undefined = undefined;

  @state()
  _running = false;

  async runSteps() {
    this._running = true;

    await this.awaitNetworkConsistency();

    for (let i = 0; i < this.steps.length; i++) {
      this._runningStepIndex = i;
      await this.steps[i].run(this);
      await this.awaitNetworkConsistency();
    }
    this._running = false;
  }

  async awaitNetworkConsistency() {
    return new Promise((resolve) => {
      const cellsStores = this._cells.value as CellMap<SimulatedCellStore>;

      if (!cellsStores) resolve(null);

      const cells = cellsStores.values().map((c) => c.cell);

      const checkConsistency = (consistencyCheckCount = 0) => {
        for (const cell of cells) {
          for (const triggers of Object.values(cell._triggers)) {
            if (triggers.running || triggers.triggered) return;
          }
        }
        if (consistencyCheckCount === 3) resolve(null);
        else setTimeout(() => checkConsistency(consistencyCheckCount + 1), 200);
      };

      for (const cell of cells) {
        cell.workflowExecutor.success(async () => checkConsistency());
        cell.workflowExecutor.error(async () => checkConsistency());
      }
    });
  }

  renderContent() {
    if (!this._cells.value || this._cells.value.cellIds().length === 0)
      return html`<div class="fill center-content">
        <mwc-circular-progress></mwc-circular-progress>
      </div>`;
    if (!this.steps)
      return html`<div class="center-content" style="flex: 1;">
        <span class="placeholder">There are no steps to run</span>
      </div>`;
    return html`
      <mwc-list activatable>
        ${this.steps.map(
          (step, index) =>
            html`<mwc-list-item
              noninteractive
              class=${classMap({
                future: this._runningStepIndex < index,
              })}
              .activated=${this._running && this._runningStepIndex === index}
              >${index + 1}. ${step.title(this)}</mwc-list-item
            >`
        )}
      </mwc-list>
    `;
  }

  render() {
    return html`
      <mwc-card class="block-card">
        <div class="column" style="margin: 16px; flex: 1;">
          <div class="row">
            <span class="block-title" style="flex: 1;">Run Steps</span>
            <mwc-button
              .label=${this._running ? 'RUNNING...' : 'RUN'}
              raised
              .disabled=${this._running || !this._cells.value}
              @click=${() => this.runSteps()}
            ></mwc-button>
          </div>
          ${this.renderContent()}
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
        .future {
          opacity: 0.7;
        }
      `,
      sharedStyles,
    ];
  }

  static get scopedElements() {
    return {
      'mwc-circular-progress': CircularProgress,
      'mwc-list-item': ListItem,
      'mwc-list': List,
      'mwc-button': Button,
      'mwc-card': Card,
    };
  }
}
