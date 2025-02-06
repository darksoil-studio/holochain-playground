import {
	ValidationLimboStatus,
	areEqual,
	getDhtOpAction,
	getDhtOpBasis,
} from '@holochain-playground/simulator';
import {
	Action,
	ActionHashB64,
	AnyDhtHashB64,
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
import { PropertyValues, css, html, render } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import { PlaygroundElement } from '../../base/playground-element.js';
import { CellStore } from '../../store/playground-store.js';
import '../helpers/help-button.js';
import { sharedStyles } from '../utils/shared-styles.js';
import './vaadin-grid-template-renderer-column.js';

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

	@property({ type: Boolean, attribute: 'hide-validation-limbo' })
	hideValidationLimbo: boolean = false;

	@property({ type: Boolean, attribute: 'hide-integration-limbo' })
	hideIntegrationLimbo: boolean = false;

	@property({ type: Boolean, attribute: 'hide-integrated' })
	hideIntegrated: boolean = false;

	@property({ type: Boolean, attribute: 'filter-basis-by-active-dht-hash' })
	filterBasisByActiveDhtHash: boolean = false;

	renderGrid(
		items: Array<{
			type: string;
			basis: AnyDhtHashB64;
			actionHash?: ActionHashB64;
			status: string;
		}>,
	) {
		const selectedDhtHash = this.store.activeDhtHash.get();
		const hashB64 = selectedDhtHash
			? encodeHashToBase64(selectedDhtHash)
			: undefined;
		const filteredItems = this.filterBasisByActiveDhtHash
			? items.filter(i => i.basis === hashB64)
			: items;
		return html`
			<vaadin-grid
				.items=${filteredItems}
				.cellPartNameGenerator=${(column: any, model: any) => {
					if (this.filterBasisByActiveDhtHash) return '';
					if (!hashB64) return '';
					if (hashB64 === model.item.basis) return 'basis';
					if (hashB64 === model.item.actionHash) return 'action';
				}}
			>
				<vaadin-grid-sort-column
					path="type"
					header="Type"
					flex-grow="1"
				></vaadin-grid-sort-column>
				<vaadin-grid-template-renderer-column
					header="Basis"
					.textAlign=${'center'}
					width="5em"
					flex-grow="0"
					.autoWidth=${true}
					.getId=${(item: any) => `${item.type}${item.actionHash}`}
					.templateRenderer=${(item: any) =>
						html`<holo-identicon
							style="height: 32px; justify-self: center"
							hash="${item.basis}"
						></holo-identicon>`}
				></vaadin-grid-template-renderer-column>
				<vaadin-grid-template-renderer-column
					header="Action"
					width="5em"
					flex-grow="0"
					.autoWidth=${true}
					.getId=${(item: any) => `${item.type}${item.actionHash}`}
					.templateRenderer=${(item: any) =>
						html`<holo-identicon
							style="height: 32px;; justify-self: center"
							hash="${item.actionHash}"
						></holo-identicon>`}
				></vaadin-grid-template-renderer-column>
				<vaadin-grid-sort-column
					path="status"
					header="Status"
					width="12em"
					flex-grow="0"
					.textAlign=${'center'}
				></vaadin-grid-sort-column>
			</vaadin-grid>
		`;
	}

	renderValidationLimbo(
		ops: Array<{ op: DhtOp; status: ValidationLimboStatus | undefined }>,
	) {
		const items = ops.map(op => {
			if ((op.op as { WarrantOp: WarrantOp }).WarrantOp) {
				return {
					type: 'Warrant',
					basis: encodeHashToBase64(getDhtOpBasis(op.op)),
					status:
						op.status !== undefined
							? getValidationLimboStatus(op.status)
							: 'Unknown',
				};
			} else {
				return {
					type: Object.keys((op.op as { ChainOp: ChainOp }).ChainOp)[0],
					basis: encodeHashToBase64(getDhtOpBasis(op.op)),
					actionHash: encodeHashToBase64(
						hashAction(getDhtOpAction((op.op as { ChainOp: ChainOp }).ChainOp)),
					),
					status:
						op.status !== undefined
							? getValidationLimboStatus(op.status)
							: 'Unknown',
				};
			}
		});
		return this.renderGrid(items);
	}

	renderIntegrationLimbo(
		ops: Array<{ op: DhtOp; status: ValidationStatus | undefined }>,
	) {
		const items = ops.map(op => {
			if ((op.op as { WarrantOp: WarrantOp }).WarrantOp) {
				return {
					type: 'Warrant',
					basis: encodeHashToBase64(getDhtOpBasis(op.op)),
					status: op.status ? getValidationStatus(op.status) : 'Unknown',
				};
			} else {
				return {
					type: Object.keys((op.op as { ChainOp: ChainOp }).ChainOp)[0],
					basis: encodeHashToBase64(getDhtOpBasis(op.op)),
					actionHash: encodeHashToBase64(
						hashAction(getDhtOpAction((op.op as { ChainOp: ChainOp }).ChainOp)),
					),
					status:
						op.status !== undefined
							? getValidationStatus(op.status)
							: 'Unknown',
				};
			}
		});
		return this.renderGrid(items);
	}

	renderIntegrated(
		ops: Array<{ op: DhtOp; status: ValidationStatus | undefined }>,
	) {
		const items = ops.map(op => {
			if ((op.op as { WarrantOp: WarrantOp }).WarrantOp) {
				return {
					type: 'Warrant',
					basis: encodeHashToBase64(getDhtOpBasis(op.op)),
					status: op.status ? getValidationStatus(op.status) : 'Unknown',
				};
			} else {
				return {
					type: Object.keys((op.op as { ChainOp: ChainOp }).ChainOp)[0],
					basis: encodeHashToBase64(getDhtOpBasis(op.op)),
					actionHash: encodeHashToBase64(
						hashAction(getDhtOpAction((op.op as { ChainOp: ChainOp }).ChainOp)),
					),
					status:
						op.status !== undefined
							? getValidationStatus(op.status)
							: 'Unknown',
				};
			}
		});
		return this.renderGrid(items);
	}

	renderTabs(
		validationLimbo: Array<{
			op: DhtOp;
			status: ValidationLimboStatus | undefined;
		}>,
		integrationLimbo: Array<{
			op: DhtOp;
			status: ValidationStatus | undefined;
		}>,
		integrated: Array<{ op: DhtOp; status: ValidationStatus | undefined }>,
	) {
		if (this.hideIntegrationLimbo && this.hideIntegrated)
			return this.renderValidationLimbo(validationLimbo);
		if (this.hideValidationLimbo && this.hideIntegrationLimbo)
			return this.renderIntegrated(integrated);
		if (this.hideValidationLimbo && this.hideIntegrated)
			return this.renderIntegrationLimbo(integrationLimbo);

		return html`
			<sl-tab-group>
				${this.hideValidationLimbo
					? html``
					: html`
							<sl-tab
								style="flex: 1; text-align: center"
								slot="nav"
								panel="validation_limbo"
								>Validation Limbo (${validationLimbo.length})</sl-tab
							>
						`}
				${this.hideIntegrationLimbo
					? html``
					: html`
							<sl-tab
								style="flex: 1; text-align: center"
								slot="nav"
								panel="integration_limbo"
								>Integration Limbo (${integrationLimbo.length})</sl-tab
							>
						`}
				${this.hideIntegrated
					? html``
					: html`
							<sl-tab
								style="flex: 1; text-align: center"
								slot="nav"
								panel="integrated"
								>Integrated (${integrated.length})</sl-tab
							>
						`}

				<sl-tab-panel name="validation_limbo"
					>${this.renderValidationLimbo(validationLimbo)}</sl-tab-panel
				>
				<sl-tab-panel name="integration_limbo"
					>${this.renderIntegrationLimbo(integrationLimbo)}</sl-tab-panel
				>
				<sl-tab-panel name="integrated"
					>${this.renderIntegrated(integrated)}</sl-tab-panel
				>
			</sl-tab-group>
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
				return this.renderTabs(
					queue.value.validationLimbo,
					queue.value.integrationLimbo,
					queue.value.integrated,
				);
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
				vaadin-grid::part(basis) {
					background-color: yellow;
				}
				vaadin-grid::part(action) {
					background-color: lightgrey;
				}
				vaadin-grid::part(body-row) {
					height: 46px;
				}
			`,
		];
	}
}
