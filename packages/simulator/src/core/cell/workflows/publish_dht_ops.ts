import { DhtOp } from '@holochain/conductor-api';
import { HoloHashMap } from '../../../processors/holo-hash-map';

import { getNonPublishedDhtOps } from '../source-chain/utils';
import { getDhtOpBasis } from '../utils';
import { Workflow, WorkflowReturn, WorkflowType, Workspace } from './workflows';

// From https://github.com/holochain/holochain/blob/develop/crates/holochain/src/core/workflow/publish_dht_ops_workflow.rs
export const publish_dht_ops = async (
  workspace: Workspace
): Promise<WorkflowReturn<void>> => {
  let workCompleted = true;
  const dhtOps = getNonPublishedDhtOps(workspace.state);

  const dhtOpsByBasis: HoloHashMap<HoloHashMap<DhtOp>> = new HoloHashMap();

  for (const [dhtOpHash, dhtOp] of dhtOps.entries()) {
    const basis = getDhtOpBasis(dhtOp);

    if (!dhtOpsByBasis.has(basis)) dhtOpsByBasis.put(basis, new HoloHashMap());

    dhtOpsByBasis.get(basis).put(dhtOpHash, dhtOp);
  }

  const promises = dhtOpsByBasis.entries().map(async ([basis, dhtOps]) => {
    try {
      // Publish the operations
      await workspace.p2p.publish(basis, dhtOps);

      for (const dhtOpHash of dhtOps.keys()) {
        workspace.state.authoredDHTOps.get(dhtOpHash).last_publish_time =
          Date.now() * 1000;
      }
    } catch (e) {
      workCompleted = false;
    }
  });

  await Promise.all(promises);

  const triggers = [];

  if (!workCompleted) {
    triggers.push(publish_dht_ops_task());
  }

  return {
    result: undefined,
    triggers,
  };
};

export type PublishDhtOpsWorkflow = Workflow<void, void>;

export function publish_dht_ops_task(): PublishDhtOpsWorkflow {
  return {
    type: WorkflowType.PUBLISH_DHT_OPS,
    details: undefined,
    task: worskpace => publish_dht_ops(worskpace),
  };
}
