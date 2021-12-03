import { hash, HashType } from '../../../processors/hash';
import { getNewHeaders } from '../source-chain/get';
import { getElement } from '../source-chain/utils';
import { elementToDhtOps } from '../utils';
import { publish_dht_ops_task } from './publish_dht_ops';
import { Workflow, WorkflowReturn, WorkflowType, Workspace } from './workflows';

// From https://github.com/holochain/holochain/blob/develop/crates/holochain/src/core/workflow/produce_dht_ops_workflow.rs
export const produce_dht_ops = async (
  worskpace: Workspace
): Promise<WorkflowReturn<void>> => {
  const newHeaderHashes = getNewHeaders(worskpace.state);

  for (const newHeaderHash of newHeaderHashes) {
    const element = getElement(worskpace.state, newHeaderHash);
    const dhtOps = elementToDhtOps(element);

    for (const dhtOp of dhtOps) {
      const dhtOpHash = hash(dhtOp, HashType.DHTOP);
      const dhtOpValue = {
        op: dhtOp,
        last_publish_time: undefined,
        receipt_count: 0,
      };

      worskpace.state.authoredDHTOps.put(dhtOpHash, dhtOpValue);
    }
  }

  return {
    result: undefined,
    triggers: [publish_dht_ops_task()],
  };
};

export type ProduceDhtOpsWorkflow = Workflow<void, void>;

export function produce_dht_ops_task(): ProduceDhtOpsWorkflow {
  return {
    type: WorkflowType.PRODUCE_DHT_OPS,
    details: undefined,
    task: worskpace => produce_dht_ops(worskpace),
  };
}
