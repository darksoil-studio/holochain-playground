import { provide } from '@lit/context';
import { LitElement, css, html } from 'lit';
import { property, query } from 'lit/decorators.js';

import { sharedStyles } from '../elements/utils/shared-styles.js';
import { ConnectedPlaygroundStore } from '../store/connected-playground-store.js';
import { PlaygroundStore } from '../store/playground-store.js';
import { SimulatedPlaygroundStore } from '../store/simulated-playground-store.js';
import { playgroundContext } from './context.js';

export abstract class BasePlaygroundContext<
	T extends SimulatedPlaygroundStore | ConnectedPlaygroundStore,
> extends LitElement {
	/** Context variables */
	abstract buildStore(): T;

	@provide({ context: playgroundContext })
	store!: SimulatedPlaygroundStore | ConnectedPlaygroundStore;

	firstUpdated() {
		const store = this.buildStore();

		this.store = store;

		this.requestUpdate();
	}

	static get styles() {
		return [
			sharedStyles,
			css`
				:host {
					display: contents;
				}
			`,
		];
	}
}
