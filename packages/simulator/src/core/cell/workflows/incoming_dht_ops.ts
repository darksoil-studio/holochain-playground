import {
  Dictionary,
  AgentPubKeyB64,
  serializeHash,
} from '@holochain-open-dev/core-types';
import { AgentPubKey, DhtOp } from '@holochain/conductor-api';

import { ValidationLimboValue, ValidationLimboStatus } from '../state';
import { putValidationLimboValue } from '../dht/put';
import { sys_validation_task } from './sys_validation';
import { Workflow, WorkflowReturn, WorkflowType, Workspace } from './workflows';
import { getDhtOpBasis } from '../utils';
import { hasDhtOpBeenProcessed } from '../dht/get';
import { HoloHashMap } from '../../../processors/holo-hash-map';

// From https://github.com/holochain/holochain/blob/develop/crates/holochain/src/core/workflow/incoming_dht_ops_workflow.rs
export const incoming_dht_ops =
  (
    dhtOps: HoloHashMap<DhtOp>,
    request_validation_receipt: boolean,
    from_agent: AgentPubKey | undefined
  ) =>
  async (workspace: Workspace): Promise<WorkflowReturn<void>> => {
    let sysValidate = false;

    for (const [dhtOpHash, dhtOp] of dhtOps.entries()) {
      if (!hasDhtOpBeenProcessed(workspace.state, dhtOpHash)) {
        const basis = getDhtOpBasis(dhtOp);

        const validationLimboValue: ValidationLimboValue = {
          basis,
          from_agent,
          last_try: undefined,
          num_tries: 0,
          op: dhtOp,
          status: ValidationLimboStatus.Pending,
          time_added: Date.now(),
          send_receipt: request_validation_receipt,
        };

        putValidationLimboValue(
          dhtOpHash,
          validationLimboValue
        )(workspace.state);

        sysValidate = true;
      }
    }

    return {
      result: undefined,
      triggers: sysValidate ? [sys_validation_task()] : [],
    };
  };

export type IncomingDhtOpsWorkflow = Workflow<
  { from_agent: AgentPubKey; ops: HoloHashMap<DhtOp> },
  void
>;

export function incoming_dht_ops_task(
  from_agent: AgentPubKey,
  request_validation_receipt: boolean,
  ops: HoloHashMap<DhtOp>
): IncomingDhtOpsWorkflow {
  return {
    type: WorkflowType.INCOMING_DHT_OPS,
    details: {
      from_agent,
      ops,
    },
    task: worskpace =>
      incoming_dht_ops(ops, request_validation_receipt, from_agent)(worskpace),
  };
}
