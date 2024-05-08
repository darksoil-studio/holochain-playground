import { SignalWatcher } from '@holochain-open-dev/signals';
import { consume } from '@lit/context';
import { ScopedElementsMixin } from '@open-wc/scoped-elements';
import { LitElement } from 'lit';
import { state } from 'lit/decorators.js';

import { PlaygroundStore } from '../store/playground-store.js';
import { playgroundContext } from './context.js';

export class PlaygroundElement<
	T extends PlaygroundStore<any> = PlaygroundStore<any>,
> extends SignalWatcher(ScopedElementsMixin(LitElement)) {
	@consume({ context: playgroundContext, subscribe: true })
	@state()
	private _store: PlaygroundStore<any>;

	get store(): T {
		return this._store as T;
	}

	showMessage(message: string) {
		this.dispatchEvent(
			new CustomEvent('show-message', {
				bubbles: true,
				composed: true,
				detail: { message },
			}),
		);
	}
}
