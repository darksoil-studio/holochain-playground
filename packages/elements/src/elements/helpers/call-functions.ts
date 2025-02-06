import { Dictionary } from '@holochain-playground/simulator';
import '@shoelace-style/shoelace/dist/components/button/button.js';
import '@shoelace-style/shoelace/dist/components/drawer/drawer.js';
import '@shoelace-style/shoelace/dist/components/input/input.js';
import '@shoelace-style/shoelace/dist/components/select/select.js';
import '@shoelace-style/shoelace/dist/components/tab-group/tab-group.js';
import '@shoelace-style/shoelace/dist/components/tab-panel/tab-panel.js';
import '@shoelace-style/shoelace/dist/components/tab/tab.js';
import { LitElement, PropertyValues, TemplateResult, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import isEqual from 'lodash-es/isEqual.js';

import { sharedStyles } from '../utils/shared-styles.js';

export type CallableFnArgument = { name: string; required?: boolean } & (
	| {
			field: 'textfield';
			type: string;
	  }
	| {
			field: 'custom';
			render: (value: any, setArgValue: (value: any) => void) => TemplateResult;
	  }
);

export interface CallableFn {
	name: string;
	args: CallableFnArgument[];
	call: (args: Dictionary<any>) => void;
}

@customElement('call-functions')
export class CallFunctions extends LitElement {
	@property()
	callableFns!: CallableFn[];

	// Segmented by fnName/argName
	_arguments: Dictionary<Dictionary<any>> = {};

	update(changedValues: PropertyValues) {
		super.update(changedValues);
		if (
			changedValues.has('callableFns') &&
			changedValues.get('callableFns') &&
			!isEqual(
				this.callableFns.map(fn => ({
					name: fn.name,
					args: fn.args.map(arg => arg.name),
				})),
				(changedValues.get('callableFns') as Array<CallableFn>).map(fn => ({
					name: fn.name,
					args: fn.args.map(arg => arg.name),
				})),
			)
		) {
			this._arguments = {};
		}
	}

	setArgument(fnName: string, argName: string, value: any) {
		if (!this._arguments[fnName]) this._arguments[fnName] = {};
		this._arguments[fnName][argName] = value;
		this.requestUpdate();
	}

	renderField(callableFn: CallableFn, arg: CallableFnArgument) {
		if (arg.field === 'textfield')
			return html`<sl-input
				style="margin-top: 12px"
				label=${arg.name + ': ' + arg.type}
				.value=${(this._arguments[callableFn.name] &&
					this._arguments[callableFn.name][arg.name]) ||
				''}
				@sl-input=${(e: any) =>
					this.setArgument(callableFn.name, arg.name, e.target.value)}
			></sl-input>`;
		if (arg.field === 'custom')
			return html`<div style="margin-top: 12px;" class="column">
				${arg.render(this._arguments[callableFn.name] || {}, value =>
					this.setArgument(callableFn.name, arg.name, value),
				)}
			</div>`;
	}

	isExecuteDisabled(callableFunction: CallableFn) {
		return callableFunction.args
			.filter(arg => arg.required)
			.some(
				arg =>
					!(
						this._arguments[callableFunction.name] &&
						this._arguments[callableFunction.name][arg.name]
					),
			);
	}

	callFunction(callableFunction: CallableFn) {
		callableFunction.call(this._arguments[callableFunction.name]);
	}

	renderCallableFunction(callableFunction: CallableFn) {
		return html` <div class="column" style="flex: 1;">
			<div class="flex-scrollable-parent">
				<div class="flex-scrollable-container">
					<div class="flex-scrollable-y">
						<div class="column" style="flex: 1; margin: 0 16px;">
							${callableFunction.args.length === 0
								? html`<span class="placeholder" style="margin-top: 28px;"
										>This function has no arguments.</span
									>`
								: callableFunction.args.map(arg =>
										this.renderField(callableFunction, arg),
									)}
						</div>
					</div>
				</div>
			</div>
			<sl-button
				variant="primary"
				style="margin: 0 8px"
				@click=${() => this.callFunction(callableFunction)}
				.disabled=${this.isExecuteDisabled(callableFunction)}
				>Execute</sl-button
			>
		</div>`;
	}
	render() {
		if (Object.keys(this.callableFns).length === 0)
			return html`<div class="fill center-content">
				<span class="placeholder" style="padding: 24px;"
					>There are no functions to call.</span
				>
			</div> `;

		return html`
			<sl-tab-group placement="start" style="flex: 1">
				${this.callableFns.map(
					fn => html`
						<sl-tab slot="nav" .panel=${fn.name}>${fn.name}</sl-tab>
						<sl-tab-panel .name=${fn.name} style="--padding: 0">
							${this.renderCallableFunction(fn)}
						</sl-tab-panel>
					`,
				)}
			</sl-tab-group>
		`;
	}

	static styles = [
		sharedStyles,
		css`
			:host {
				display: flex;
				flex: 1;
			}
		`,
	];
}
