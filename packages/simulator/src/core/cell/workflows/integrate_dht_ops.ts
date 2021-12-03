import { IntegratedDhtOpsValue, ValidationStatus } from '../state';
import { pullAllIntegrationLimboDhtOps } from '../dht/get';
import {
  putDhtOpData,
  putDhtOpMetadata,
  putDhtOpToIntegrated,
} from '../dht/put';
import { Workflow, WorkflowReturn, WorkflowType, Workspace } from './workflows';
import { validation_receipt_task } from './validation_receipt';

// From https://github.com/holochain/holochain/blob/develop/crates/holochain/src/core/workflow/integrate_dht_ops_workflow.rs
export const integrate_dht_ops = async (
  worskpace: Workspace
): Promise<WorkflowReturn<void>> => {
  const opsToIntegrate = pullAllIntegrationLimboDhtOps(worskpace.state);
  let workComplete = opsToIntegrate.keys().length === 0;

  for (const [dhtOpHash, integrationLimboValue] of opsToIntegrate.entries()) {
    const dhtOp = integrationLimboValue.op;

    if (integrationLimboValue.validation_status === ValidationStatus.Valid) {
      putDhtOpData(dhtOp)(worskpace.state);
      putDhtOpMetadata(dhtOp)(worskpace.state);
    } else if (
      integrationLimboValue.validation_status === ValidationStatus.Rejected
    ) {
      putDhtOpData(dhtOp)(worskpace.state);
    }

    const value: IntegratedDhtOpsValue = {
      op: dhtOp,
      validation_status: integrationLimboValue.validation_status,
      when_integrated: Date.now(),
      send_receipt: integrationLimboValue.send_receipt,
    };

    putDhtOpToIntegrated(dhtOpHash, value)(worskpace.state);
  }
  const triggers = [];

  if (!workComplete) {
    triggers.push(integrate_dht_ops_task());
    triggers.push(validation_receipt_task());
  }

  return {
    result: undefined,
    triggers,
  };
};

export type IntegrateDhtOpsWorkflow = Workflow<void, void>;

export function integrate_dht_ops_task(): IntegrateDhtOpsWorkflow {
  return {
    type: WorkflowType.INTEGRATE_DHT_OPS,
    details: undefined,
    task: worskpace => integrate_dht_ops(worskpace),
  };
}
