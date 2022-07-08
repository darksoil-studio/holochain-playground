import { Dictionary } from '@holochain-open-dev/core-types';
import {
  Cell,
  sleep,
  Workflow,
  WorkflowType,
  workflowPriority,
  CallZomeFnWorkflow,
  NetworkRequestInfo,
  CellMap,
} from '@holochain-playground/simulator';
import { css, html } from 'lit';
import { styleMap } from 'lit-html/directives/style-map.js';
import { property, state } from 'lit/decorators.js';
import { CellId } from '@holochain/client';
import { StoreSubscriber } from 'lit-svelte-stores';

import {
  Card,
  Icon,
  LinearProgress,
  List,
  ListItem,
} from '@scoped-elements/material-web';

import { PlaygroundElement } from '../../base/playground-element';
import { sharedStyles } from '../utils/shared-styles';
import {
  SimulatedCellStore,
  SimulatedPlaygroundStore,
} from '../../store/simulated-playground-store';
import { MiddlewareController } from '../../base/middleware-controller';

export class CellTasks extends PlaygroundElement<SimulatedPlaygroundStore> {
  /** Public properties */

  @property()
  cell: Cell;

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
      before: (p) => this.beforeWorkflow(p),
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
      this._callZomeTasks = this._callZomeTasks.filter((t) => t !== task);

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
        const index = this._successes.findIndex((e) => e === successInfo);
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
      this._callZomeTasks = this._callZomeTasks.filter((t) => t !== task);
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

      const index = this._workflowErrors.findIndex((e) => e === errorInfo);
      this._workflowErrors.splice(index, 1);
    }
    this.requestUpdate();
  }

  async networkRequestError(
    networkRequest: NetworkRequestInfo<any, any>,
    error: any
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

      const index = this._networkRequestErrors.findIndex(
        (e) => e === errorInfo
      );
      this._networkRequestErrors.splice(index, 1);
    }
    this.requestUpdate();
  }

  sortTasks(tasks: Array<[string, number]>) {
    return tasks.sort(
      (t1, t2) =>
        workflowPriority(t1[0] as WorkflowType) -
        workflowPriority(t2[0] as WorkflowType)
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
    color: string = 'inherit'
  ) {
    return html`
      <mwc-list-item
        twoline
        graphic="icon"
        style="--mdc-list-item-graphic-margin: 4px;"
      >
        <mwc-icon slot="graphic" style=${styleMap({ color: color })}
          >${icon}</mwc-icon
        >
        <span>${primary}</span>
        <span slot="secondary">${secondary}</span>
      </mwc-list-item>
    `;
  }

  render() {
    if (!this.showTasks()) return html``;
    const orderedTasks = this.sortTasks(Object.entries(this._runningTasks));
    return html`
      <mwc-card class="tasks-card">
        <mwc-list style="max-height: 300px; overflow-y: auto; width: 200px;">
          ${this._callZomeTasks.map((callZome) =>
            this.renderListItem(
              'call_made',
              callZome.details.fnName,
              callZome.details.zome + ' zome',
              'green'
            )
          )}
          ${this._workflowErrors.map((errorInfo) =>
            this.renderListItem(
              'error_outline',
              errorInfo.error.message,
              errorInfo.task.type === WorkflowType.CALL_ZOME
                ? `${
                    (errorInfo.task as CallZomeFnWorkflow).details.fnName
                  } in ${(errorInfo.task as CallZomeFnWorkflow).details.zome}`
                : errorInfo.task.type,
              'red'
            )
          )}
          ${this._networkRequestErrors.map((errorInfo) =>
            this.renderListItem(
              'error_outline',
              errorInfo.error.message,
              errorInfo.networkRequest.type,
              'red'
            )
          )}
          ${this._successes.map(({ task, payload }) =>
            this.renderListItem(
              'check_circle_outline',
              task.details.fnName,
              'Success',
              'green'
            )
          )}
          ${orderedTasks.map(([taskName, taskNumber]) =>
            this.renderListItem(
              'miscellaneous_services',
              taskName,
              'Cell Workflow'
            )
          )}
        </mwc-list>
        ${this.stepByStep
          ? html``
          : html` <mwc-linear-progress indeterminate></mwc-linear-progress> `}
      </mwc-card>
    `;
  }

  static get styles() {
    return [
      sharedStyles,
      css`
        .tasks-card {
          width: auto;
        }
      `,
    ];
  }

  static get scopedElements() {
    return {
      'mwc-card': Card,
      'mwc-list': List,
      'mwc-icon': Icon,
      'mwc-list-item': ListItem,
      'mwc-linear-progress': LinearProgress,
    };
  }
}
