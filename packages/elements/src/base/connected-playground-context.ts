import { PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';

import { ConnectedPlaygroundStore } from '../store/connected-playground-store.js';
import { PlaygroundMode } from '../store/mode.js';
import { BasePlaygroundContext } from './base-playground-context.js';

export class ConnectedPlaygroundContext extends BasePlaygroundContext<
	PlaygroundMode.Connected,
	ConnectedPlaygroundStore
> {
	@property()
	urls: string[];

	async buildStore() {
		return ConnectedPlaygroundStore.create(this.urls);
	}

	updated(cv: PropertyValues) {
		super.updated(cv);

		if (this.store && cv.has('urls')) {
			(this.store as ConnectedPlaygroundStore).setConductors(this.urls);
		}
	}
}
