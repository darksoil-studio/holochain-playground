import { playgroundContext } from './context.js';
import { ScopedElementsMixin } from '@open-wc/scoped-elements';
import { LitElement } from 'lit';
import { state } from 'lit/decorators.js';
import { consume } from '@lit/context';

import { PlaygroundStore } from '../store/playground-store.js';

export class PlaygroundElement<
  T extends PlaygroundStore<any> = PlaygroundStore<any>
> extends ScopedElementsMixin(LitElement) {
  @consume({ context: playgroundContext, subscribe: true })
  @state()
  store: T;

  showMessage(message: string) {
    this.dispatchEvent(
      new CustomEvent('show-message', {
        bubbles: true,
        composed: true,
        detail: { message },
      })
    );
  }
}
