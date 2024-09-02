import { wrapPathInSvg } from '@holochain-open-dev/elements';
import { sharedStyles } from '@holochain-playground/elements';
import '@holochain-playground/golden-layout/dist/simulated/simulated-playground-golden-layout-menu.js';
import '@holochain-playground/golden-layout/dist/simulated/simulated-playground-golden-layout.js';
import { mdiMenu } from '@mdi/js';
import '@scoped-elements/golden-layout';
import { SlDrawer } from '@shoelace-style/shoelace';
import '@shoelace-style/shoelace/dist/components/drawer/drawer.js';
import '@shoelace-style/shoelace/dist/components/icon-button/icon-button.js';
import { LitElement, css, html } from 'lit';
import { customElement, query } from 'lit/decorators.js';

@customElement('holochain-playground')
export class HolochainPlayground extends LitElement {
	@query('sl-drawer')
	drawer!: SlDrawer;

	render() {
		return html`
			<simulated-holochain-playground-golden-layout style="flex: 1;">
				<sl-drawer label="Blocks" style="flex:1;">
					<div class="column" style="gap: 12px">
						<span slot="subtitle">Drag-and-drop items </span>

						<simulated-holochain-playground-golden-layout-menu></simulated-holochain-playground-golden-layout-menu>
					</div>
				</sl-drawer>
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
								component-type="dht-cells"
							></golden-layout-component>
							<golden-layout-column>
								<golden-layout-row>
									<golden-layout-component
										component-type="call-zome-fns"
									></golden-layout-component>
									<golden-layout-stack>
										<golden-layout-component
											component-type="entry-contents"
										></golden-layout-component>
									</golden-layout-stack>
								</golden-layout-row>
								<golden-layout-stack>
									<golden-layout-component
										component-type="dht-entries"
									></golden-layout-component>
									<golden-layout-component
										component-type="source-chain"
									></golden-layout-component>
								</golden-layout-stack>
							</golden-layout-column>
						</golden-layout-row>
					</golden-layout-root>
				</div>
			</simulated-holochain-playground-golden-layout>
		`;
	}

	static styles = [
		css`
			:host {
				display: flex;
			}
		`,
		sharedStyles,
	];
}
