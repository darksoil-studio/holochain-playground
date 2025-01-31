import { PolylitMixin } from '@vaadin/component-base/src/polylit-mixin.js';
import * as c from '@vaadin/grid/src/vaadin-grid-column-mixin.js';
import { LitElement, TemplateResult, html, render } from 'lit';
import { customElement, property } from 'lit/decorators.js';

// @ts-ignore
const mixin = c.GridColumnMixin as any;

// @ts-ignore
@customElement('vaadin-grid-template-renderer-column')
export class VaadinGridTemplateRendererColumn extends mixin(
	PolylitMixin(LitElement),
) {
	@property({})
	getId!: (item: any) => string;

	@property({})
	templateRenderer!: (item: any) => TemplateResult;

	renderer = (root: HTMLElement, _: any, model: any) => {
		const id = this.getId(model.item);
		if (!this.instances[id]) {
			const div = document.createElement('div');
			render(this.templateRenderer(model.item), div);
			this.instances[id] = div;
		}
		if (root.firstChild !== this.instances[id]) {
			root.innerHTML = '';
			root.appendChild(this.instances[id]);
		}
	};

	instances: { [key: string]: HTMLElement } = {};
}
