import { sharedStyles } from '@tnesh-stack/elements';
import { DockviewApi, SerializedDockview, createDockview } from 'dockview-core';
// @ts-ignore
import styles from 'dockview-core/dist/styles/dockview.css?raw';
import { LitElement, css, html } from 'lit';
import { unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('dock-view')
export class DockViewEl extends LitElement {
	@property()
	layout: SerializedDockview | undefined;

	dockview!: DockviewApi;

	firstUpdated() {
		this.renderDockview(
			this.shadowRoot!.getElementById('dockview') as HTMLElement,
		);
	}

	renderDockview(el: HTMLElement) {
		this.dockview = createDockview(el, {
			createComponent(options) {
				const element = document.createElement(options.name);
				// element.style.width = '100%';
				element.style.flex = '1';
				// element.style.margin = '16px';
				return {
					element,
					init(parameters) {},
				};
			},
		});
		if (this.layout) {
			this.dockview.fromJSON(this.layout);
		}
		this.dispatchEvent(
			new CustomEvent('dockview-ready', {
				bubbles: true,
				composed: true,
				detail: {
					dockview: this.dockview,
				},
			}),
		);
	}

	render() {
		return html`<div
			id="dockview"
			class="dockview-theme-light"
			style="flex: 1"
		></div>`;
	}

	static styles = [
		css`
			:host {
				display: flex;
			}
			${unsafeCSS(styles)}

			.groupview > .content-container {
				display: flex;
			}
		`,
	];
}

@customElement('dock-view-panel')
export class DockViewPanel extends LitElement {}
