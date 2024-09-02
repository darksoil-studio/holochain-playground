import { ConnectedPlaygroundContext } from '@holochain-playground/elements';
import '@holochain-playground/elements/dist/elements/conductor-admin/index.js';
import '@holochain-playground/elements/dist/elements/dht-cells/index.js';
import '@holochain-playground/elements/dist/elements/dht-entries/index.js';
import '@holochain-playground/elements/dist/elements/entry-contents/index.js';
import '@holochain-playground/elements/dist/elements/source-chain/index.js';
import '@scoped-elements/golden-layout';
import { html } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('connected-playground-golden-layout')
export class ConnectedPlaygroundGoldenLayout extends ConnectedPlaygroundContext {
	render() {
		return html`
			<golden-layout>
				<golden-layout-register component-type="source-chain">
					<template>
						<div
							style="height: 100%; width: 100%; overflow: auto; display: flex;"
						>
							<source-chain style="flex: 1; margin: 8px;"></source-chain>
						</div>
					</template>
				</golden-layout-register>
				<golden-layout-register component-type="dht-cells">
					<template>
						<div
							style="height: 100%; width: 100%; overflow: auto; display: flex;"
						>
							<dht-cells style="flex: 1; margin: 8px;"></dht-cells>
						</div>
					</template>
				</golden-layout-register>
				<golden-layout-register component-type="conductor-admin">
					<template>
						<div
							style="height: 100%; width: 100%; overflow: auto; display: flex;"
						>
							<conductor-admin style="flex: 1; margin: 8px;"></conductor-admin>
						</div>
					</template>
				</golden-layout-register>
				<golden-layout-register component-type="entry-contents">
					<template>
						<div
							style="height: 100%; width: 100%; overflow: auto; display: flex;"
						>
							<entry-contents style="flex: 1; margin: 8px;"></entry-contents>
						</div>
					</template>
				</golden-layout-register>
				<golden-layout-register component-type="dht-entries">
					<template>
						<div
							style="height: 100%; width: 100%; overflow: auto; display: flex;"
						>
							<dht-entries style="flex: 1; margin: 8px;"></dht-entries>
						</div>
					</template>
				</golden-layout-register>
				${super.render()}
			</golden-layout>
		`;
	}
}
