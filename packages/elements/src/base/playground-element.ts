import { playgroundContext } from './context';
import { ScopedElementsMixin } from '@open-wc/scoped-elements';
import { LitElement } from 'lit';
import { state } from 'lit/decorators.js';
import { contextProvided } from '@lit-labs/context';

import { PlaygroundStore } from '../store/playground-store';
import { PlaygroundMode } from '../store/mode';

export class PlaygroundElement<
  T extends PlaygroundStore<any> = PlaygroundStore<any>
> extends ScopedElementsMixin(LitElement) {
  @contextProvided({ context: playgroundContext, multiple: true })
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
