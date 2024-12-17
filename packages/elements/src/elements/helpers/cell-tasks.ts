import {
	CallZomeFnWorkflow,
	Cell,
	Dictionary,
	NetworkRequestInfo,
	Workflow,
	WorkflowType,
	sleep,
	workflowPriority,
} from '@holochain-playground/simulator';
import {
	mdiAlertOutline,
	mdiCallMade,
	mdiCheckCircleOutline,
	mdiCogs,
} from '@mdi/js';
import '@shoelace-style/shoelace/dist/components/card/card.js';
import '@shoelace-style/shoelace/dist/components/icon/icon.js';
import '@shoelace-style/shoelace/dist/components/spinner/spinner.js';
import { wrapPathInSvg } from '@tnesh-stack/elements';
import { css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';

import { MiddlewareController } from '../../base/middleware-controller.js';
import { PlaygroundElement } from '../../base/playground-element.js';
import {
	SimulatedCellStore,
	SimulatedPlaygroundStore,
} from '../../store/simulated-playground-store.js';
import { sharedStyles } from '../utils/shared-styles.js';

@customElement('cell-tasks')
export class CellTasks extends PlaygroundElement<SimulatedPlaygroundStore> {
	/** Public properties */

	@property()
	cell!: Cell;

	@property({ type: Array })
	workflowsToDisplay: WorkflowType[] = [
		WorkflowType.GENESIS,
		WorkflowType.CALL_ZOME,
		WorkflowType.INCOMING_DHT_OPS,
		WorkflowType.INTEGRATE_DHT_OPS,
		WorkflowType.PRODUCE_DHT_OPS,
		WorkflowType.PUBLISH_DHT_OPS,
		WorkflowType.APP_VALIDATION,
		WorkflowType.SYS_VALIDATION,
	];
	@property({ type: Number })
	workflowDelay: number = 1000;

	@property({ type: Boolean, attribute: 'hide-errors' })
	hideErrors = false;

	@property({ type: Boolean, attribute: 'show-zome-fn-success' })
	showZomeFnSuccess = false;

	@property({ type: Boolean })
	stepByStep: boolean = false;

	/** Private properties */

	@state()
	private _callZomeTasks: Array<CallZomeFnWorkflow> = [];
	@state()
	private _runningTasks: Dictionary<number> = {};

	@state()
	private _successes: Array<{ task: CallZomeFnWorkflow; payload: any }> = [];

	@state()
	private _workflowErrors: Array<{ task: Workflow<any, any>; error: any }> = [];
	@state()
	private _networkRequestErrors: Array<{
		networkRequest: NetworkRequestInfo<any, any>;
		error: any;
	}> = [];

	_middlewares = new MiddlewareController(this, () => this.cell, {
		workflow: {
			before: p => this.beforeWorkflow(p),
			success: (p, s) => this.workflowSuccess(p, s),
			error: (p, e) => this.workflowError(p, e),
		},
		networkRequests: {
			error: (n, e) => this.networkRequestError(n, e),
		},
	});

	async beforeWorkflow(task: Workflow<any, any>) {
		const cell = this.cell;
		if (!this.workflowsToDisplay.includes(task.type as WorkflowType)) return;

		if (
			task.type === WorkflowType.APP_VALIDATION &&
			cell.conductor.badAgent &&
			cell.conductor.badAgent.config.pretend_invalid_records_are_valid
		) {
			return;
		}

		if (task.type === WorkflowType.CALL_ZOME) {
			this._callZomeTasks.push(task);
		} else {
			if (!this._runningTasks[task.type]) this._runningTasks[task.type] = 0;

			this._runningTasks[task.type] += 1;
		}
		this.requestUpdate();

		if (this.stepByStep) {
			this.store.paused.pause();
			await this.store.paused.awaitResume();
		} else {
			await sleep(this.workflowDelay);
		}
	}

	async workflowSuccess(task: Workflow<any, any>, result: any) {
		if (task.type === WorkflowType.CALL_ZOME) {
			this._callZomeTasks = this._callZomeTasks.filter(t => t !== task);

			if (this.showZomeFnSuccess) {
				const successInfo = { task, payload: result };
				this._successes.push(successInfo);
				this.requestUpdate();

				if (this.stepByStep) {
					this.store.paused.pause();
					await this.store.paused.awaitResume();
				} else {
					await sleep(this.workflowDelay);
				}
				const index = this._successes.findIndex(e => e === successInfo);
				this._successes.splice(index, 1);
			}
		} else if (this._runningTasks[task.type]) {
			this._runningTasks[task.type] -= 1;
			if (this._runningTasks[task.type] === 0)
				delete this._runningTasks[task.type];
		}
		this.requestUpdate();
	}

	async workflowError(task: Workflow<any, any>, error: any) {
		if (task.type === WorkflowType.CALL_ZOME) {
			this._callZomeTasks = this._callZomeTasks.filter(t => t !== task);
		} else if (this._runningTasks[task.type]) {
			this._runningTasks[task.type] -= 1;
			if (this._runningTasks[task.type] === 0)
				delete this._runningTasks[task.type];
		}

		if (!this.hideErrors) {
			const errorInfo = {
				task,
				error,
			};
			this._workflowErrors.push(errorInfo);

			this.requestUpdate();

			if (this.stepByStep) {
				this.store.paused.pause();
				await this.store.paused.awaitResume();
			} else {
				await sleep(this.workflowDelay);
			}

			const index = this._workflowErrors.findIndex(e => e === errorInfo);
			this._workflowErrors.splice(index, 1);
		}
		this.requestUpdate();
	}

	async networkRequestError(
		networkRequest: NetworkRequestInfo<any, any>,
		error: any,
	) {
		console.error(error);
		if (!this.hideErrors) {
			const errorInfo = {
				networkRequest,
				error,
			};
			this._networkRequestErrors.push(errorInfo);

			this.requestUpdate();

			if (this.stepByStep) {
				this.store.paused.pause();
				await this.store.paused.awaitResume();
			} else {
				await sleep(this.workflowDelay);
			}

			const index = this._networkRequestErrors.findIndex(e => e === errorInfo);
			this._networkRequestErrors.splice(index, 1);
		}
		this.requestUpdate();
	}

	sortTasks(tasks: Array<[string, number]>) {
		return tasks.sort(
			(t1, t2) =>
				workflowPriority(t1[0] as WorkflowType) -
				workflowPriority(t2[0] as WorkflowType),
		);
	}

	showTasks() {
		return (
			Object.keys(this._runningTasks).length !== 0 ||
			this._workflowErrors.length !== 0 ||
			this._successes.length !== 0 ||
			this._callZomeTasks.length !== 0
		);
	}

	renderListItem(
		icon: string,
		primary: string,
		secondary: string,
		color: string = 'inherit',
	) {
		return html`
			<div class="row" style="gap: 8px; align-items: center">
				<sl-icon
					.src=${wrapPathInSvg(icon)}
					style=${styleMap({ color: color })}
				></sl-icon>
				<div class="column" style="gap: 4px">
					<span>${primary}</span>
					<span class="placeholder" style="font-size: 12px">${secondary}</span>
				</div>
			</div>
		`;
	}

	render() {
		if (!this.showTasks()) return html``;
		const orderedTasks = this.sortTasks(Object.entries(this._runningTasks));
		return html`
			<sl-card class="tasks-card"
				><div class="row" style=" align-items: center; gap: 16px">
					<div
						class="row"
						style="max-height: 200px; overflow-y: auto; max-width: 180px;"
					>
						${this._callZomeTasks.map(callZome =>
							this.renderListItem(
								mdiCallMade,
								callZome.details.fnName,
								callZome.details.zome + ' zome',
								'green',
							),
						)}
						${this._workflowErrors.map(errorInfo =>
							this.renderListItem(
								mdiAlertOutline,
								errorInfo.error.message,
								errorInfo.task.type === WorkflowType.CALL_ZOME
									? `${
											(errorInfo.task as CallZomeFnWorkflow).details.fnName
										} in ${(errorInfo.task as CallZomeFnWorkflow).details.zome}`
									: errorInfo.task.type,
								'red',
							),
						)}
						${this._networkRequestErrors.map(errorInfo =>
							this.renderListItem(
								mdiAlertOutline,
								errorInfo.error.message,
								errorInfo.networkRequest.type,
								'red',
							),
						)}
						${this._successes.map(({ task, payload }) =>
							this.renderListItem(
								mdiCheckCircleOutline,
								task.details.fnName,
								'Success',
								'green',
							),
						)}
						${orderedTasks.map(([taskName, taskNumber]) =>
							this.renderListItem(mdiCogs, taskName, 'Cell Workflow'),
						)}
					</div>
					${this.stepByStep ? html`` : html` <sl-spinner></sl-spinner> `}
				</div>
			</sl-card>
		`;
	}

	static get styles() {
		return [
			sharedStyles,
			css`
				.tasks-card {
					width: auto;
					--padding: 8px;
				}
			`,
		];
	}
}
