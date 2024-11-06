import { ValidationReceipt } from '@tnesh-stack/core-types';
import uniq from 'lodash-es/uniq.js';

import { getBadAgents } from '../../network/utils.js';
import { getIntegratedDhtOpsWithoutReceipt } from '../dht/get.js';
import { putDhtOpToIntegrated, putValidationReceipt } from '../dht/put.js';
import { ValidationStatus } from '../state.js';
import {
	Workflow,
	WorkflowReturn,
	WorkflowType,
	Workspace,
} from './workflows.js';

// From https://github.com/holochain/holochain/blob/develop/crates/holochain/src/core/workflow/integrate_dht_ops_workflow.rs
export const validation_receipt = async (
	workspace: Workspace,
): Promise<WorkflowReturn<void>> => {
	const integratedOpsWithoutReceipt = getIntegratedDhtOpsWithoutReceipt(
		workspace.state,
	);
	const pretendIsValid =
		workspace.badAgentConfig &&
		workspace.badAgentConfig.pretend_invalid_records_are_valid;

	for (const [
		dhtOpHash,
		integratedValue,
	] of integratedOpsWithoutReceipt.entries()) {
		const receipt: ValidationReceipt = {
			dht_op_hash: dhtOpHash,
			validation_status: pretendIsValid
				? ValidationStatus.Valid
				: integratedValue.validation_status,
			validator: workspace.state.agentPubKey,
			when_integrated: Date.now() * 1000,
		};

		putValidationReceipt(dhtOpHash, receipt)(workspace.state);

		const badAgents = getBadAgents(workspace.state);
		const beforeCount = workspace.state.badAgents.length;

		workspace.state.badAgents = uniq([
			...workspace.state.badAgents,
			...badAgents,
		]);

		if (beforeCount !== badAgents.length) {
			workspace.p2p.syncNeighbors();
		}

		integratedValue.send_receipt = false;

		putDhtOpToIntegrated(dhtOpHash, integratedValue)(workspace.state);
	}

	return {
		result: undefined,
		triggers: [],
	};
};

export type ValidationReceiptWorkflow = Workflow<void, void>;

export function validation_receipt_task(): ValidationReceiptWorkflow {
	return {
		type: WorkflowType.VALIDATION_RECEIPT,
		details: undefined,
		task: worskpace => validation_receipt(worskpace),
	};
}
