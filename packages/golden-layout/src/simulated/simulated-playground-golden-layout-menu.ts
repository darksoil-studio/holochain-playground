import { sharedStyles } from '@holochain-playground/elements';
import '@scoped-elements/golden-layout';
import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';

import { GOLDEN_LAYOUT_COMPONENTS } from './components.js';

@customElement('simulated-playground-golden-layout-menu')
export class SimulatedPlaygroundGoldenLayoutMenu extends LitElement {
	renderItem(label: string, componentType: string) {
		return html`
			<golden-layout-drag-source component-type="${componentType}">
				<span>${label}</span>
			</golden-layout-drag-source>
		`;
	}

	render() {
		return html`
			<div class="column" style="gap: 12px">
				${GOLDEN_LAYOUT_COMPONENTS.map(component =>
					this.renderItem(component.name, component.tag),
				)}
			</div>
		`;
	}

	static styles = sharedStyles;
}
