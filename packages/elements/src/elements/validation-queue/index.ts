import {
	ValidationLimboStatus,
	getDhtOpAction,
	getDhtOpBasis,
} from '@holochain-playground/simulator';
import {
	ChainOp,
	DhtOp,
	WarrantOp,
	encodeHashToBase64,
} from '@holochain/client';
import '@scoped-elements/cytoscape';
import '@shoelace-style/shoelace/dist/components/card/card.js';
import '@shoelace-style/shoelace/dist/components/spinner/spinner.js';
import '@shoelace-style/shoelace/dist/components/tab-group/tab-group.js';
import '@shoelace-style/shoelace/dist/components/tab-panel/tab-panel.js';
import '@shoelace-style/shoelace/dist/components/tab/tab.js';
import { ValidationStatus } from '@tnesh-stack/core-types';
import '@tnesh-stack/elements/dist/elements/display-error.js';
import '@tnesh-stack/elements/dist/elements/holo-identicon.js';
import { joinAsync } from '@tnesh-stack/signals';
import { hashAction } from '@tnesh-stack/utils';
import '@vaadin/grid/vaadin-grid-column.js';
import '@vaadin/grid/vaadin-grid-sort-column.js';
import '@vaadin/grid/vaadin-grid.js';
import { css, html, render } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import { PlaygroundElement } from '../../base/playground-element.js';
import { CellStore } from '../../store/playground-store.js';
import '../helpers/help-button.js';
import { sharedStyles } from '../utils/shared-styles.js';

function getValidationLimboStatus(status: ValidationLimboStatus): string {
	switch (status) {
		case ValidationLimboStatus.Pending:
			return 'Pending';
		case ValidationLimboStatus.AwaitingSysDeps:
			return 'AwaitingSysDeps';
		case ValidationLimboStatus.SysValidated:
			return 'SysValidated';
		case ValidationLimboStatus.AwaitingAppDeps:
			return 'AwaitingAppDeps';
	}
}

function getValidationStatus(status: ValidationStatus): string {
	switch (status) {
		case ValidationStatus.Valid:
			return 'Valid';
		case ValidationStatus.Rejected:
			return 'Rejected';
		case ValidationStatus.Abandoned:
			return 'Abandoned';
	}
}

/**
 * @element validation-queue
 */
@customElement('validation-queue')
export class ValidationQueue extends PlaygroundElement {
	@property({ type: Boolean, attribute: 'hide-header' })
	hideHeader: boolean = false;

	renderValidationLimbo(
		ops: Array<{ op: DhtOp; status: ValidationLimboStatus | undefined }>,
	) {
		const items = ops.map(op => {
			if ((op.op as { WarrantOp: WarrantOp }).WarrantOp) {
				return {
					type: 'Warrant',
					basis: getDhtOpBasis(op.op),
					status:
						op.status !== undefined
							? getValidationLimboStatus(op.status)
							: 'Unknown',
				};
			} else {
				return {
					type: Object.keys((op.op as { ChainOp: ChainOp }).ChainOp)[0],
					basis: getDhtOpBasis(op.op),
					actionHash: hashAction(
						getDhtOpAction((op.op as { ChainOp: ChainOp }).ChainOp),
					),
					status:
						op.status !== undefined
							? getValidationLimboStatus(op.status)
							: 'Unknown',
				};
			}
		});
		return html`
			<vaadin-grid .items=${items} multi-sort>
				<vaadin-grid-sort-column
					path="type"
					header="Type"
					width="12em"
					flex-grow="1"
				></vaadin-grid-sort-column>
				<vaadin-grid-column
					header="Basis"
					width="5em"
					.renderer=${(root: HTMLElement, _: any, model: any) => {
						render(
							html`<holo-identicon .hash=${model.item.basis}>
							</holo-identicon>`,
							root,
						);
					}}
				></vaadin-grid-column>
				<vaadin-grid-column
					header="ActionHash"
					width="5em"
					.renderer=${(root: HTMLElement, _: any, model: any) => {
						render(
							html`<holo-identicon .hash=${model.item.actionHash}>
							</holo-identicon>`,
							root,
						);
					}}
				></vaadin-grid-column>
				<vaadin-grid-sort-column
					path="status"
					header="Status"
					width="8em"
					.textAlign=${'center'}
				></vaadin-grid-sort-column>
			</vaadin-grid>
		`;
	}

	renderIntegrationLimbo(
		ops: Array<{ op: DhtOp; status: ValidationStatus | undefined }>,
	) {
		const items = ops.map(op => {
			if ((op.op as { WarrantOp: WarrantOp }).WarrantOp) {
				return {
					type: 'Warrant',
					basis: getDhtOpBasis(op.op),
					status: op.status ? getValidationStatus(op.status) : 'Unknown',
				};
			} else {
				return {
					type: Object.keys((op.op as { ChainOp: ChainOp }).ChainOp)[0],
					basis: getDhtOpBasis(op.op),
					actionHash: hashAction(
						getDhtOpAction((op.op as { ChainOp: ChainOp }).ChainOp),
					),
					status:
						op.status !== undefined
							? getValidationStatus(op.status)
							: 'Unknown',
				};
			}
		});
		return html`
			<vaadin-grid .items=${items} multi-sort>
				<vaadin-grid-sort-column
					path="type"
					header="Type"
					width="12em"
					flex-grow="1"
				></vaadin-grid-sort-column>
				<vaadin-grid-column
					header="Basis"
					width="5em"
					.renderer=${(root: HTMLElement, _: any, model: any) => {
						render(
							html`<holo-identicon .hash=${model.item.basis}>
							</holo-identicon>`,
							root,
						);
					}}
				></vaadin-grid-column>
				<vaadin-grid-column
					header="ActionHash"
					width="5em"
					.renderer=${(root: HTMLElement, _: any, model: any) => {
						render(
							html`<holo-identicon .hash=${model.item.actionHash}>
							</holo-identicon>`,
							root,
						);
					}}
				></vaadin-grid-column>
				<vaadin-grid-sort-column
					path="status"
					header="Status"
					width="8em"
					.textAlign=${'center'}
				></vaadin-grid-sort-column>
			</vaadin-grid>
		`;
	}

	renderIntegrated(
		ops: Array<{ op: DhtOp; status: ValidationStatus | undefined }>,
	) {
		const items = ops.map(op => {
			if ((op.op as { WarrantOp: WarrantOp }).WarrantOp) {
				return {
					type: 'Warrant',
					basis: getDhtOpBasis(op.op),
					status: op.status ? getValidationStatus(op.status) : 'Unknown',
				};
			} else {
				return {
					type: Object.keys((op.op as { ChainOp: ChainOp }).ChainOp)[0],
					basis: getDhtOpBasis(op.op),
					actionHash: hashAction(
						getDhtOpAction((op.op as { ChainOp: ChainOp }).ChainOp),
					),
					status:
						op.status !== undefined
							? getValidationStatus(op.status)
							: 'Unknown',
				};
			}
		});
		return html`
			<vaadin-grid .items=${items} multi-sort>
				<vaadin-grid-sort-column
					path="type"
					header="Type"
					width="12em"
					flex-grow="1"
				></vaadin-grid-sort-column>
				<vaadin-grid-column
					header="Basis"
					width="5em"
					.renderer=${(root: HTMLElement, _: any, model: any) => {
						render(
							html`<holo-identicon .hash=${model.item.basis}>
							</holo-identicon>`,
							root,
						);
					}}
				></vaadin-grid-column>
				<vaadin-grid-column
					header="ActionHash"
					width="5em"
					.renderer=${(root: HTMLElement, _: any, model: any) => {
						render(
							html`<holo-identicon .hash=${model.item.actionHash}>
							</holo-identicon>`,
							root,
						);
					}}
				></vaadin-grid-column>
				<vaadin-grid-sort-column
					path="status"
					header="Status"
					width="8em"
					.textAlign=${'center'}
				></vaadin-grid-sort-column>
			</vaadin-grid>
		`;
	}

	renderValidationQueue(activeCell: CellStore) {
		const queue = activeCell.validationQueue.get();
		switch (queue.status) {
			case 'pending':
				return html`<div
					class="column"
					style="align-items: center; justify-content: center; flex: 1"
				>
					<sl-spinner></sl-spinner>
				</div> `;
			case 'error':
				return html`
					<div
						class="column"
						style="align-items: center; justify-content: center; flex: 1"
					>
						<display-error
							.error=${queue.error}
							headline="Error getting the validation queue"
						></display-error>
					</div>
				`;
			case 'completed':
				return html`
					<sl-tab-group>
						<sl-tab style="flex: 1" slot="nav" panel="validation_limbo"
							>Validation Limbo (${queue.value.validationLimbo.length})</sl-tab
						>
						<sl-tab style="flex: 1" slot="nav" panel="integration_limbo"
							>Integration Limbo
							(${queue.value.integrationLimbo.length})</sl-tab
						>
						<sl-tab style="flex: 1" slot="nav" panel="integrated"
							>Integrated (${queue.value.integrated.length})</sl-tab
						>

						<sl-tab-panel name="validation_limbo"
							>${this.renderValidationLimbo(
								queue.value.validationLimbo,
							)}</sl-tab-panel
						>
						<sl-tab-panel name="integration_limbo"
							>${this.renderIntegrationLimbo(
								queue.value.integrationLimbo,
							)}</sl-tab-panel
						>
						<sl-tab-panel name="integrated"
							>${this.renderIntegrated(queue.value.integrated)}</sl-tab-panel
						>
					</sl-tab-group>
				`;
		}
	}

	renderHelp() {
		return html` <help-button heading="Validation Queue" class="block-help">
			<span>
				When receiving a publish request for a DhtOp, holochain:
				<ol>
					<li>Adds it to the validation limbo.</li>
					<li>Performs system level validation.</li>
					<li>Performs app level validation.</li>
					<li>Moves it from validation limbo to integration limbo.</li>
					<li>
						Moves it from integration limbo to the integrated shard of the DHT.
					</li>
				</ol>
			</span>
		</help-button>`;
	}

	render() {
		const activeAgent = this.store.activeAgentPubKey.get();
		const activeCell = this.store.activeCell.get();
		return html`
			<div class="column fill">
				${this.hideHeader
					? html``
					: html`
							<div class="block-title row" style="align-items: center">
								<span>Validation Queue</span>${activeAgent
									? html`
											<span class="placeholder row"> , for Agent </span>
											<holo-identicon
												.hash=${activeAgent}
												style="margin-left: 8px; height: 32px"
											></holo-identicon>
										`
									: html``}
								<div style="flex: 1"></div>
								${this.renderHelp()}
							</div>
						`}
				${activeCell.status === 'completed' && activeCell.value
					? html` ${this.renderValidationQueue(activeCell.value)} `
					: html`
							<div style="flex: 1;" class="center-content placeholder">
								<span>Select a cell to inspect its validation queue.</span>
							</div>
						`}
			</div>
		`;
	}

	static get styles() {
		return [
			sharedStyles,
			css`
				:host {
					min-height: 350px;
					min-width: 100px;
					display: flex;
					flex: 1;
				}
				#source-chain-graph {
					width: 100%;
					height: 100%;
				}
			`,
		];
	}
}
