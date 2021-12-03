import {
  IconButton,
  Snackbar,
  CircularProgress,
} from '@scoped-elements/material-web';

import { LitElement, html, css, PropertyValues } from 'lit';
import { property, query } from 'lit/decorators.js';

import { ScopedElementsMixin } from '@open-wc/scoped-elements';
import { ContextProvider } from '@lit-labs/context';

import { PlaygroundContext, playgroundContext } from './context';
import { PlaygroundStore } from '../store/playground-store';
import { PlaygroundMode } from '../store/mode';

export abstract class BasePlaygroundContext<
  T extends PlaygroundMode
> extends ScopedElementsMixin(LitElement) {
  @query('#snackbar')
  private snackbar: Snackbar;

  @property({ type: String })
  private message: string | undefined;

  /** Context variables */
  abstract buildStore(): Promise<PlaygroundStore<T>>;

  _playgroundStoreContext: ContextProvider<
    PlaygroundContext<T>
  > = new ContextProvider(this, playgroundContext, undefined);

  async firstUpdated() {
    const store = await this.buildStore();

    this._playgroundStoreContext.setValue(store);

    this.dispatchEvent(
      new CustomEvent('playground-ready', {
        bubbles: true,
        composed: true,
        detail: { store },
      })
    );

    this.addEventListener('show-message', (e: CustomEvent) => {
      this.showMessage(e.detail.message);
    });
  }

  showMessage(message: string) {
    this.message = message;
    this.snackbar.show();
  }

  renderSnackbar() {
    return html`
      <mwc-snackbar id="snackbar" .labelText=${this.message}>
        <mwc-icon-button icon="close" slot="dismiss"></mwc-icon-button>
      </mwc-snackbar>
    `;
  }

  render() {
    return html`
      ${this.renderSnackbar()}
      ${this._playgroundStoreContext.value
        ? html` <mwc-circular-progress></mwc-circular-progress>`
        : html` <slot></slot> `}
    `;
  }

  static get scopedElements() {
    return {
      'mwc-circular-progress': CircularProgress,
      'mwc-snackbar': Snackbar,
      'mwc-icon-button': IconButton,
    };
  }

  static get styles() {
    return [
      css`
        :host {
          display: contents;
        }
      `,
    ];
  }
}
