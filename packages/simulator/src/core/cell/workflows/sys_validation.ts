import {
	Action,
	ActionType,
	AnyDhtHash,
	AppEntryDef,
	Create,
	Entry,
	EntryType,
	NewEntryAction,
	Record,
	Signature,
	Update,
} from '@holochain/client';

import { GetStrategy } from '../../../types.js';
import { P2pCell } from '../../network/p2p-cell.js';
import { Cascade } from '../cascade/cascade.js';
import { getValidationLimboDhtOps } from '../dht/get.js';
import { putValidationLimboValue } from '../dht/put.js';
import { isPublic } from '../source-chain/utils.js';
import { ValidationLimboStatus } from '../state.js';
import {
	author_key_is_valid,
	check_app_entry_type,
	check_entry_hash,
	check_entry_size,
	check_entry_type,
	check_new_entry_action,
	check_not_private,
	check_prev_action,
	check_prev_seq,
	check_prev_timestamp,
	check_update_reference,
	verify_action_signature,
} from '../sys_validate/index.js';
import { extractEntry, getAppEntryType } from '../utils.js';
import { app_validation_task } from './app_validation.js';
import {
	Workflow,
	WorkflowReturn,
	WorkflowType,
	Workspace,
} from './workflows.js';

// From https://github.com/holochain/holochain/blob/develop/crates/holochain/src/core/workflow/sys_validation_workflow.rs
export const sys_validation = async (
	worskpace: Workspace,
): Promise<WorkflowReturn<void>> => {
	let workComplete = true;

	const pendingDhtOps = getValidationLimboDhtOps(worskpace.state, [
		ValidationLimboStatus.Pending,
		ValidationLimboStatus.AwaitingSysDeps,
	]);

	// TODO: actually validate
	for (const [dhtOpHash, limboValue] of pendingDhtOps.entries()) {
		limboValue.status = ValidationLimboStatus.SysValidated;

		putValidationLimboValue(dhtOpHash, limboValue)(worskpace.state);
	}

	return {
		result: undefined,
		triggers: [app_validation_task()],
	};
};

export type SysValidationWorkflow = Workflow<void, void>;

export function sys_validation_task(): SysValidationWorkflow {
	return {
		type: WorkflowType.SYS_VALIDATION,
		details: undefined,
		task: worskpace => sys_validation(worskpace),
	};
}

export async function sys_validate_record(
	record: Record,
	workspace: Workspace,
	network: P2pCell,
): Promise<void | DepsMissing> {
	try {
		const isNotCounterfeit = await counterfeit_check(
			record.signed_action.signature,
			record.signed_action.hashed.content,
		);
		if (!isNotCounterfeit)
			throw new Error(`Trying to validate counterfeited record`);
	} catch (e) {
		throw new Error(`Trying to validate counterfeited record`);
	}

	let maybeDepsMissing = await store_record(
		record.signed_action.hashed.content,
		workspace,
		network,
	);
	if (maybeDepsMissing) return maybeDepsMissing;

	const entry_type = (record.signed_action.hashed.content as NewEntryAction)
		.entry_type;

	if (isPublic(entry_type)) {
		maybeDepsMissing = await store_entry(
			record.signed_action.hashed.content as NewEntryAction,
			extractEntry(record),
			workspace,
			network,
		);
		if (maybeDepsMissing) return maybeDepsMissing;
	}

	// TODO: implement register_* when cache is in place
}

/// Check if the op has valid signature and author.
/// Ops that fail this check should be dropped.
export async function counterfeit_check(
	signature: Signature,
	action: Action,
): Promise<Boolean> {
	return (
		(await verify_action_signature(signature, action)) &&
		(await author_key_is_valid(action.author))
	);
}

export interface DepsMissing {
	depsHashes: Array<AnyDhtHash>;
}

export async function store_record(
	action: Action,
	workspace: Workspace,
	network: P2pCell,
): Promise<void | DepsMissing> {
	check_prev_action(action);

	const prev_action_hash = (action as Create).prev_action;
	if (prev_action_hash) {
		const prev_action = await new Cascade(
			workspace.state,
			workspace.p2p,
		).retrieve_action(prev_action_hash, {
			strategy: GetStrategy.Contents,
		});

		if (!prev_action)
			return {
				depsHashes: [prev_action_hash],
			};

		check_prev_timestamp(action, prev_action.hashed.content);
		check_prev_seq(action, prev_action.hashed.content);
	}
}

export async function store_entry(
	action: NewEntryAction,
	entry: Entry | undefined,
	workspace: Workspace,
	network: P2pCell,
): Promise<void | DepsMissing> {
	if (!entry)
		return {
			depsHashes: [action.entry_hash],
		};
	check_entry_type(action.entry_type, entry);
	const appEntryType = getAppEntryType(action.entry_type);
	if (appEntryType) {
		const entry_def = check_app_entry_type(appEntryType, workspace.dna);
		check_not_private(entry_def);
	}

	check_entry_hash(action.entry_hash, entry);
	check_entry_size(entry);

	if (action.type === ActionType.Update) {
		const signed_action = await new Cascade(
			workspace.state,
			workspace.p2p,
		).retrieve_action(action.original_action_address, {
			strategy: GetStrategy.Contents,
		});
		if (!signed_action) {
			return {
				depsHashes: [action.original_action_address],
			};
		}

		update_check(action, signed_action.hashed.content);
	}
}

function update_check(entry_update: Update, original_action: Action): void {
	check_new_entry_action(original_action);

	if (!(original_action as NewEntryAction).entry_type)
		throw new Error(`Trying to update a action that didn't create any entry`);

	check_update_reference(entry_update, original_action as NewEntryAction);
}
