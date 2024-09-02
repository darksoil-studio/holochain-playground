import { wrapPathInSvg } from '@holochain-open-dev/elements';
import { watch } from '@holochain-open-dev/signals';
import {
	ConnectedPlaygroundStore,
	sharedStyles,
} from '@holochain-playground/elements';
import '@holochain-playground/golden-layout/dist/connected/connected-playground-golden-layout-menu.js';
import '@holochain-playground/golden-layout/dist/connected/connected-playground-golden-layout.js';
import { mdiMenu } from '@mdi/js';
import '@scoped-elements/golden-layout';
import { SlDrawer } from '@shoelace-style/shoelace';
import '@shoelace-style/shoelace/dist/components/drawer/drawer.js';
import '@shoelace-style/shoelace/dist/components/icon-button/icon-button.js';
import '@shoelace-style/shoelace/dist/components/spinner/spinner.js';
import { LitElement, css, html } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';
import { Socket, io } from 'socket.io-client';

export const socket: Socket = io();

@customElement('holochain-playground')
export class HolochainPlayground extends LitElement {
	@query('sl-drawer')
	drawer!: SlDrawer;

	@state()
	urls: string[] = [];

	ready = false;

	async firstUpdated() {
		socket.on('urls-updated', (response: { urls: string[] }) => {
			this.urls = response.urls;
		});
	}

	render() {
		if (this.urls.length === 0)
			return html`
				<div
					style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center"
				>
					<sl-spinner></sl-spinner>
					<span style="margin-top: 16px;">Connecting to conductors... </span
					><span style="margin-top: 16px; width: 600px;"
						>If this doesn't work, check that the holochain-playground command
						is being run in a folder with <b>.hc_live_*</b> files, or with some
						URLs as arguments, like
						<b>holochain-playground ws://localhost:8888</b>.</span
					><span style="margin-top: 16px; width: 600px;"
						>See the documentation at
						<a href="https://www.npmjs.com/package/@holochain-playground/cli"
							>https://www.npmjs.com/package/@holochain-playground/cli</a
						>.</span
					>
				</div>
			`;

		return html`
			<connected-playground-golden-layout
				id="context"
				style="flex: 1;"
				.urls=${this.urls}
				@playground-ready=${(e: any) => {
					const store = e.detail.store as ConnectedPlaygroundStore;

					const conductors = store.conductors.get();
					if (!conductors || conductors.length === 0) return;
					const unsubs = watch(conductors[0].cells, cells => {
						if (
							cells.status === 'completed' &&
							!this.ready &&
							cells.value.entries().length > 0
						) {
							this.ready = true;
							store.activeDna.set(cells.value.entries()[0][0][0]);
							if (this.urls.length === 1) {
								store.activeAgentPubKey.set(cells.value.entries()[0][0][1]);
							}
							unsubs();
						}
					});
				}}
			>
				<sl-drawer label="Blocks" style="flex:1;">
					<div class="column" style="gap: 12px">
						<span>Drag-and-drop items </span>

						<connected-playground-golden-layout-menu></connected-playground-golden-layout-menu>
					</div>
					<div class="column" style="display: flex; flex: 1">
						<div class="row" style="align-items: center; gap: 12px">
							<sl-icon-button
								slot="navigationIcon"
								@click=${() => {
									this.drawer.show();
								}}
								.src=${wrapPathInSvg(mdiMenu)}
								icon="menu"
							></sl-icon-button>
							<div>Holochain Playground</div>
						</div>
						<golden-layout-root style="flex: 1; margin-top: 66px;">
							<golden-layout-row>
								<golden-layout-component
									component-type="source-chain"
									width="30"
								></golden-layout-component>
								<golden-layout-column>
									<golden-layout-component
										component-type="dht-entries"
									></golden-layout-component>

									<golden-layout-row>
										<golden-layout-component
											component-type="dht-cells"
											height="40"
										></golden-layout-component>

										<golden-layout-stack>
											<golden-layout-component
												component-type="entry-contents"
											></golden-layout-component>
											<golden-layout-component
												component-type="conductor-admin"
											></golden-layout-component>
										</golden-layout-stack>
									</golden-layout-row>
								</golden-layout-column>
							</golden-layout-row>
						</golden-layout-root>
					</div>
				</sl-drawer>
			</connected-playground-golden-layout>
		`;
	}

	static get styles() {
		return [
			css`
				:host {
					display: flex;
				}
			`,
			sharedStyles,
		];
	}
}
