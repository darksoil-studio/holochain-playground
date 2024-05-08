import { SignalWatcher } from '@holochain-open-dev/signals';
import { consume } from '@lit/context';
import { ScopedElementsMixin } from '@open-wc/scoped-elements';
import { LitElement } from 'lit';
import { state } from 'lit/decorators.js';

import { ConnectedPlaygroundStore } from '../store/connected-playground-store.js';
import { SimulatedPlaygroundStore } from '../store/simulated-playground-store.js';
import { playgroundContext } from './context.js';

export class PlaygroundElement<
	T extends ConnectedPlaygroundStore | SimulatedPlaygroundStore =
		| ConnectedPlaygroundStore
		| SimulatedPlaygroundStore,
> extends SignalWatcher(ScopedElementsMixin(LitElement)) {
	@consume({ context: playgroundContext, subscribe: true })
	@state()
	private _store!: ConnectedPlaygroundStore | SimulatedPlaygroundStore;

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
