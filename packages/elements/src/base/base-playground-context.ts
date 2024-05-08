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
import { PlaygroundMode } from '../store/mode.js';
import { PlaygroundStore } from '../store/playground-store.js';
import { playgroundContext } from './context.js';

export abstract class BasePlaygroundContext<
	T extends PlaygroundMode,
	S extends PlaygroundStore<T>,
> extends ScopedElementsMixin(LitElement) {
	@query('#snackbar')
	private snackbar: Snackbar;

	@property({ type: String })
	private message: string | undefined;

	/** Context variables */
	abstract buildStore(): Promise<S>;

	@provide({ context: playgroundContext })
	store!: PlaygroundStore<any>;

	async firstUpdated() {
		const store = await this.buildStore();

		this.store = store;

		this.dispatchEvent(
			new CustomEvent('playground-ready', {
				bubbles: true,
				composed: true,
				detail: { store },
			}),
		);

		this.addEventListener('show-message', (e: CustomEvent) => {
			this.showMessage(e.detail.message);
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
