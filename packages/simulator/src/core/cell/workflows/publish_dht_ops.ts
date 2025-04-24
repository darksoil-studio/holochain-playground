import { DhtOp, HoloHash } from '@holochain/client';
import { DhtOpHash } from '@darksoil-studio/holochain-core-types';
import { HoloHashMap } from '@darksoil-studio/holochain-utils';

import { getNonPublishedDhtOps } from '../source-chain/utils.js';
import { getDhtOpBasis } from '../utils.js';
import {
	Workflow,
	WorkflowReturn,
	WorkflowType,
	Workspace,
} from './workflows.js';

// From https://github.com/holochain/holochain/blob/develop/crates/holochain/src/core/workflow/publish_dht_ops_workflow.rs
export const publish_dht_ops = async (
	workspace: Workspace,
): Promise<WorkflowReturn<void>> => {
	let workCompleted = true;
	const dhtOps = getNonPublishedDhtOps(workspace.state);

	const dhtOpsByBasis: HoloHashMap<
		HoloHash,
		HoloHashMap<DhtOpHash, DhtOp>
	> = new HoloHashMap();

	for (const [dhtOpHash, dhtOp] of dhtOps.entries()) {
		const basis = getDhtOpBasis(dhtOp);

		if (!dhtOpsByBasis.has(basis)) dhtOpsByBasis.set(basis, new HoloHashMap());

		dhtOpsByBasis.get(basis).set(dhtOpHash, dhtOp);
	}

	const promises = Array.from(dhtOpsByBasis.entries()).map(
		async ([basis, dhtOps]) => {
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
		},
	);

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
