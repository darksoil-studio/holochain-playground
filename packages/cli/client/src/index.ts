import { watch } from '@darksoil-studio/holochain-signals';
import {
	ConnectedPlaygroundStore,
	sharedStyles,
} from '@holochain-playground/elements';
import '@holochain-playground/elements';
import { mdiMagnify, mdiMenu } from '@mdi/js';
import { SlDrawer } from '@shoelace-style/shoelace';
import '@shoelace-style/shoelace/dist/components/drawer/drawer.js';
import '@shoelace-style/shoelace/dist/components/icon-button/icon-button.js';
import '@shoelace-style/shoelace/dist/components/spinner/spinner.js';
import { DockviewApi, SerializedDockview } from 'dockview-core';
import { LitElement, css, html } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';
import { Socket, io } from 'socket.io-client';

import './dock-view.js';

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
			<connected-playground-context
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
				<div class="column " style="display: flex; flex: 1;">
					<div
						class="row"
						style="padding: 8px; align-items: center; color: white; gap: 12px; background-color: var(--sl-color-primary-500);"
					>
						<select-active-dna> </select-active-dna>
						<div style="flex: 1"></div>
					</div>
					<dock-view
						style="flex: 1"
						@dockview-ready=${(e: CustomEvent) => {
							const dockview: DockviewApi = e.detail.dockview;

							const root = dockview.addGroup();
							const group = dockview.addGroup({
								referenceGroup: root,
								direction: 'right',
							});
							const subgroup = dockview.addGroup({
								referenceGroup: group,
								direction: 'below',
							});
							const subsubgroup = dockview.addGroup({
								referenceGroup: subgroup,
								direction: 'right',
							});
							// const subsubsubgroup = dockview.addGroup({
							// 	referenceGroup: subsubgroup,
							// });

							dockview.addPanel({
								id: 'DHT Entries',
								component: 'dht-entries',
								position: {
									referenceGroup: group,
								},
							});

							dockview.addPanel({
								id: 'DHT Cells',
								component: 'dht-cells',
								position: {
									referenceGroup: subgroup,
								},
							});

							dockview.addPanel({
								id: 'Entry Contents',
								component: 'entry-contents',
								position: {
									referenceGroup: subsubgroup,
								},
							});

							dockview.addPanel({
								id: 'Search Dht Entry',
								component: 'search-dht-entry',
								position: {
									referenceGroup: root,
								},
							});
							dockview.addPanel({
								id: 'Source Chain',
								component: 'source-chain',
								position: {
									referenceGroup: root,
								},
							});

							dockview.addPanel({
								id: 'Conductor hApps',
								component: 'conductor-happs',
								position: {
									referenceGroup: root,
								},
							});
						}}
					>
					</dock-view>
				</div>
			</connected-playground-context>
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
