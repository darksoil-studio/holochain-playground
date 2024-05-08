import { provide } from '@lit/context';
import { ScopedElementsMixin } from '@open-wc/scoped-elements';
import {
	CircularProgress,
	IconButton,
	Snackbar,
} from '@scoped-elements/material-web';
import { LitElement, css, html } from 'lit';
import { property, query } from 'lit/decorators.js';

import { sharedStyles } from '../elements/utils/shared-styles.js';
import { ConnectedPlaygroundStore } from '../store/connected-playground-store.js';
import { PlaygroundStore } from '../store/playground-store.js';
import { SimulatedPlaygroundStore } from '../store/simulated-playground-store.js';
import { playgroundContext } from './context.js';

export abstract class BasePlaygroundContext<
	T extends SimulatedPlaygroundStore | ConnectedPlaygroundStore,
> extends ScopedElementsMixin(LitElement) {
	@query('#snackbar')
	private snackbar!: Snackbar;

	@property({ type: String })
	private message: string | undefined;

	/** Context variables */
	abstract buildStore(): T;

	@provide({ context: playgroundContext })
	store!: SimulatedPlaygroundStore | ConnectedPlaygroundStore;

	firstUpdated() {
		const store = this.buildStore();

		this.store = store;

		this.addEventListener('show-message', (e: Event) => {
			this.showMessage((e as CustomEvent).detail.message);
		});

		this.requestUpdate();
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
			<slot></slot>
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
			sharedStyles,
			css`
				:host {
					display: contents;
				}
			`,
		];
	}
}
