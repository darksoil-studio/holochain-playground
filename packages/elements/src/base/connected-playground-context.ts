import { PropertyValues } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import { ConnectedPlaygroundStore } from '../store/connected-playground-store.js';
import { BasePlaygroundContext } from './base-playground-context.js';

@customElement('connected-playground-context')
export class ConnectedPlaygroundContext extends BasePlaygroundContext<ConnectedPlaygroundStore> {
	@property()
	urls!: string[];

	buildStore() {
		const store = new ConnectedPlaygroundStore();
		store.setConductors(this.urls).then(() => {
			this.dispatchEvent(
				new CustomEvent('playground-ready', {
					bubbles: true,
					composed: true,
					detail: {
						store,
					},
				}),
			);
		});
		return store;
	}

	updated(cv: PropertyValues) {
		super.updated(cv);

		if (this.store && cv.has('urls')) {
			(this.store as ConnectedPlaygroundStore).setConductors(this.urls);
		}
	}
}
