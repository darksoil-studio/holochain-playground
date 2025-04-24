import { HashType, hash } from '@darksoil-studio/holochain-utils';

import { getNewActions } from '../source-chain/get.js';
import { getRecord } from '../source-chain/utils.js';
import { recordToDhtOps } from '../utils.js';
import { publish_dht_ops_task } from './publish_dht_ops.js';
import {
	Workflow,
	WorkflowReturn,
	WorkflowType,
	Workspace,
} from './workflows.js';

// From https://github.com/holochain/holochain/blob/develop/crates/holochain/src/core/workflow/produce_dht_ops_workflow.rs
export const produce_dht_ops = async (
	worskpace: Workspace,
): Promise<WorkflowReturn<void>> => {
	const newActionHashes = getNewActions(worskpace.state);

	for (const newActionHash of newActionHashes) {
		const record = getRecord(worskpace.state, newActionHash);
		const dhtOps = recordToDhtOps(record);

		for (const dhtOp of dhtOps) {
			const dhtOpHash = hash(dhtOp, HashType.DHTOP);
			const dhtOpValue = {
				op: dhtOp,
				last_publish_time: undefined,
				receipt_count: 0,
			};

			worskpace.state.authoredDHTOps.set(dhtOpHash, dhtOpValue);
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
