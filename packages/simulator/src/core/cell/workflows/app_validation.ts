import {
	ActionType,
	AgentPubKey,
	AgentValidationPkg,
	AppEntryDef,
	ChainOp,
	ChainOpType,
	CreateLink,
	Delete,
	DeleteLink,
	DhtOp,
	Entry,
	NewEntryAction,
	Record,
	RecordEntry,
	SignedActionHashed,
	Update,
} from '@holochain/client';
import { HashType, hash, hashAction } from '@darksoil-studio/holochain-utils';
import { isEqual } from 'lodash-es';

import {
	EntryDef,
	SimulatedDna,
	SimulatedZome,
} from '../../../dnas/simulated-dna.js';
import { GetStrategy } from '../../../types.js';
import { BadAgentConfig } from '../../bad-agent.js';
import { buildValidationFunctionContext } from '../../hdk/context.js';
import { HostFnWorkspace } from '../../hdk/host-fn.js';
import { Cascade } from '../cascade/cascade.js';
import { getValidationLimboDhtOps } from '../dht/get.js';
import {
	deleteValidationLimboValue,
	putIntegrationLimboValue,
	putValidationLimboValue,
	putValidationReceipt,
} from '../dht/put.js';
import { isPublic } from '../source-chain/utils.js';
import {
	CellState,
	IntegrationLimboValue,
	ValidationLimboStatus,
	ValidationLimboValue,
	ValidationStatus,
} from '../state.js';
import { ValidationOutcome } from '../sys_validate/types.js';
import {
	getDhtOpAction,
	getDhtOpSignature,
	getEntry,
	isWarrantOp,
	recordToDhtOps,
} from '../utils.js';
import {
	MissingDependenciesError,
	Op,
	chainOpToRecord,
} from './app_validation/types.js';
import { integrate_dht_ops_task } from './integrate_dht_ops.js';
import { DepsMissing } from './sys_validation.js';
import {
	Workflow,
	WorkflowReturn,
	WorkflowType,
	Workspace,
	workflowPriority,
} from './workflows.js';

// From https://github.com/holochain/holochain/blob/develop/crates/holochain/src/core/workflow/app_validation_workflow.rs
export const app_validation = async (
	workspace: Workspace,
): Promise<WorkflowReturn<void>> => {
	let workComplete = true;

	const pendingDhtOps = getValidationLimboDhtOps(workspace.state, [
		ValidationLimboStatus.SysValidated,
		ValidationLimboStatus.AwaitingAppDeps,
	]);

	for (const dhtOpHash of pendingDhtOps.keys()) {
		const validationLimboValue = pendingDhtOps.get(dhtOpHash);
		if (isWarrantOp(validationLimboValue.op)) {
			continue;
		}
		const chainOp = (validationLimboValue.op as { ChainOp: ChainOp }).ChainOp;

		deleteValidationLimboValue(dhtOpHash)(workspace.state);

		// If we are a bad agent, we don't validate our stuff
		let outcome: ValidationOutcome = { resolved: true, valid: true };
		if (
			shouldValidate(
				workspace.state.agentPubKey,
				chainOp,
				workspace.badAgentConfig,
			)
		) {
			outcome = await validate_op(
				chainOp,
				validationLimboValue.from_agent,
				workspace,
			);
		}
		if (!outcome.resolved) {
			workComplete = false;

			validationLimboValue.status = ValidationLimboStatus.AwaitingAppDeps;
			putValidationLimboValue(dhtOpHash, validationLimboValue)(workspace.state);
		} else {
			const value: IntegrationLimboValue = {
				op: validationLimboValue.op,
				validation_status: outcome.valid
					? ValidationStatus.Valid
					: ValidationStatus.Rejected,
				send_receipt: outcome.valid ? validationLimboValue.send_receipt : true, // If value is invalid we always need to make a receipt
			};
			putIntegrationLimboValue(dhtOpHash, value)(workspace.state);
		}
	}

	let triggers = [integrate_dht_ops_task()];

	if (!workComplete) {
		triggers.push(app_validation_task());
	}

	return {
		result: undefined,
		triggers,
	};
};

export type AppValidationWorkflow = Workflow<any, any>;

export function app_validation_task(
	agent: boolean = false,
): AppValidationWorkflow {
	return {
		type: agent ? WorkflowType.AGENT_VALIDATION : WorkflowType.APP_VALIDATION,
		details: undefined,
		task: worskpace => app_validation(worskpace),
	};
}

function shouldValidate(
	agentPubKey: AgentPubKey,
	dhtOp: ChainOp,
	badAgentConfig?: BadAgentConfig,
): boolean {
	if (!badAgentConfig) return true;
	return !isEqual(getDhtOpAction(dhtOp).author, agentPubKey);
}

export async function chainOpToOp(
	workspace: Workspace,
	chainOp: ChainOp,
): Promise<Op | DepsMissing> {
	const record = chainOpToRecord(chainOp);
	const entry = getEntry({ ChainOp: chainOp });
	switch (Object.keys(chainOp)[0]) {
		case ChainOpType.StoreRecord:
			return {
				StoreRecord: {
					record,
				},
			};
		case ChainOpType.StoreEntry:
			return {
				StoreEntry: {
					action: record.signed_action as SignedActionHashed<NewEntryAction>,
					entry: entry!,
				},
			};
		case ChainOpType.RegisterUpdatedRecord:
		case ChainOpType.RegisterUpdatedContent:
			return {
				RegisterUpdate: {
					new_entry: entry,
					update: record.signed_action as SignedActionHashed<Update>,
				},
			};
		case ChainOpType.RegisterDeletedEntryAction:
		case ChainOpType.RegisterDeletedBy:
			return {
				RegisterDelete: {
					delete: record.signed_action as SignedActionHashed<Delete>,
				},
			};
		case ChainOpType.RegisterAgentActivity:
			return {
				RegisterAgentActivity: {
					action: record.signed_action,
					cached_entry: undefined, // TODO: fix this
				},
			};
		case ChainOpType.RegisterAddLink:
			return {
				RegisterCreateLink: {
					create_link: record.signed_action as SignedActionHashed<CreateLink>,
				},
			};
		case ChainOpType.RegisterRemoveLink:
			const delete_link =
				record.signed_action as SignedActionHashed<DeleteLink>;
			const cascade = new Cascade(workspace.state, workspace.p2p);
			const create_link = await cascade.retrieve_action(
				delete_link.hashed.content.link_add_address,
				{
					strategy: GetStrategy.Contents,
				},
			);
			if (!create_link)
				return {
					depsHashes: [delete_link.hashed.content.link_add_address],
				};
			return {
				RegisterDeleteLink: {
					delete_link,
					create_link: create_link.hashed.content as CreateLink,
				},
			};
		default:
			throw new Error(`Unknown DhtOp type: ${Object.keys(chainOp)[0]}`);
	}
}
export async function validate_op(
	chainOp: ChainOp,
	from_agent: AgentPubKey | undefined,
	workspace: Workspace,
): Promise<ValidationOutcome> {
	const op = await chainOpToOp(workspace, chainOp);
	if ((op as DepsMissing).depsHashes)
		return {
			resolved: false,
			depsHashes: (op as DepsMissing).depsHashes,
		};
	const record = chainOpToRecord(chainOp);

	const maybeEntryDef = await get_associated_entry_def(
		record,
		workspace.dna,
		workspace,
	);
	if (maybeEntryDef && (maybeEntryDef as DepsMissing).depsHashes)
		return {
			resolved: false,
			depsHashes: (maybeEntryDef as DepsMissing).depsHashes,
		};

	const zomes_to_invoke = await get_zomes_to_invoke(record, workspace);

	if (zomes_to_invoke && (zomes_to_invoke as DepsMissing).depsHashes)
		return {
			resolved: false,
			depsHashes: (zomes_to_invoke as DepsMissing).depsHashes,
		};

	const zomes = zomes_to_invoke as Array<SimulatedZome>;

	return run_validation_callback_inner(zomes, op as Op, workspace);
}

export async function run_validation_callback_direct(
	zome: SimulatedZome,
	dna: SimulatedDna,
	record: Record,
	workspace: Workspace,
): Promise<ValidationOutcome> {
	const ops = recordToDhtOps(record);

	for (const dhtOp of ops) {
		const op = await chainOpToOp(
			workspace,
			(dhtOp as { ChainOp: ChainOp }).ChainOp,
		);
		if ((op as DepsMissing).depsHashes)
			throw new MissingDependenciesError((op as DepsMissing).depsHashes);

		const outcome = await run_validation_callback_inner(
			[zome],
			op as Op,
			workspace,
		);
		if (!outcome.resolved) return outcome;
		if (!outcome.valid) return outcome;
	}
	const maybeEntryDef = await get_associated_entry_def(record, dna, workspace);

	if (maybeEntryDef && (maybeEntryDef as DepsMissing).depsHashes)
		return {
			resolved: false,
			depsHashes: (maybeEntryDef as DepsMissing).depsHashes,
		};

	return {
		resolved: true,
		valid: true,
	};
}

async function get_associated_entry_def(
	record: Record,
	dna: SimulatedDna,
	workspace: Workspace,
): Promise<DepsMissing | EntryDef | undefined> {
	const cascade = new Cascade(workspace.state, workspace.p2p);
	const maybeAppEntryType = await get_app_entry_type(record, cascade);

	if (!maybeAppEntryType) return undefined;
	if ((maybeAppEntryType as DepsMissing).depsHashes)
		return maybeAppEntryType as DepsMissing;

	const appEntryType = maybeAppEntryType as AppEntryDef;
	return dna.zomes[appEntryType.zome_index].entry_defs[
		appEntryType.entry_index
	];
}

async function get_app_entry_type(
	record: Record,
	cascade: Cascade,
): Promise<DepsMissing | AppEntryDef | undefined> {
	if (record.signed_action.hashed.content.type === ActionType.Delete)
		return get_app_entry_type_from_dep(record, cascade);

	const entryType = (record.signed_action.hashed.content as NewEntryAction)
		.entry_type;
	if (!entryType) return undefined;
	if (
		entryType === 'CapGrant' ||
		entryType === 'CapClaim' ||
		entryType === 'Agent'
	)
		return undefined;
	return entryType.App;
}

async function get_app_entry_type_from_dep(
	record: Record,
	cascade: Cascade,
): Promise<DepsMissing | AppEntryDef | undefined> {
	if (record.signed_action.hashed.content.type !== ActionType.Delete)
		return undefined;

	const deletedActionHash = record.signed_action.hashed.content.deletes_address;
	const action = await cascade.retrieve_action(deletedActionHash, {
		strategy: GetStrategy.Contents,
	});

	if (!action) return { depsHashes: [deletedActionHash] };

	const entryType = (action.hashed.content as NewEntryAction).entry_type;
	if (
		!entryType ||
		entryType === 'Agent' ||
		entryType === 'CapClaim' ||
		entryType === 'CapGrant'
	)
		return undefined;
	return entryType.App;
}

async function get_zomes_to_invoke(
	record: Record,
	workspace: Workspace,
): Promise<DepsMissing | Array<SimulatedZome>> {
	const cascade = new Cascade(workspace.state, workspace.p2p);
	const maybeAppEntryType = await get_app_entry_type(record, cascade);

	if (maybeAppEntryType && (maybeAppEntryType as DepsMissing).depsHashes)
		return maybeAppEntryType as DepsMissing;

	if (maybeAppEntryType) {
		// It's a newEntryAction
		return [workspace.dna.zomes[(maybeAppEntryType as AppEntryDef).zome_index]];
	} else {
		const action = record.signed_action.hashed.content;
		if (action.type === ActionType.CreateLink) {
			return [workspace.dna.zomes[action.zome_index]];
		} else if (action.type === ActionType.DeleteLink) {
			const maybeAction = await cascade.retrieve_action(
				action.link_add_address,
				{ strategy: GetStrategy.Contents },
			);

			if (!maybeAction)
				return {
					depsHashes: [action.link_add_address],
				};

			return [
				workspace.dna.zomes[
					(maybeAction.hashed.content as CreateLink).zome_index
				],
			];
		}

		return workspace.dna.zomes;
	}
}

async function run_validation_callback_inner(
	zomes_to_invoke: Array<SimulatedZome>,
	op: Op,
	workspace: Workspace,
): Promise<ValidationOutcome> {
	return invoke_validation_fns(zomes_to_invoke, op, workspace);
}

async function invoke_validation_fns(
	zomes_to_invoke: Array<SimulatedZome>,
	payload: Op,
	workspace: Workspace,
): Promise<ValidationOutcome> {
	const cascade = new Cascade(workspace.state, workspace.p2p);
	const hostFnWorkspace: HostFnWorkspace = {
		cascade,
		state: workspace.state,
		dna: workspace.dna,
		p2p: workspace.p2p,
		conductor_handle: workspace.conductor_handle,
	};

	for (const zome of zomes_to_invoke) {
		if (zome.validate) {
			const context = buildValidationFunctionContext(
				hostFnWorkspace,
				workspace.dna.zomes.findIndex(z => z === zome),
			);

			try {
				const outcome: ValidationOutcome =
					await zome.validate(context)(payload);
				if (!outcome.resolved) return outcome;
				else if (!outcome.valid) return outcome;
			} catch (e) {
				if (e instanceof MissingDependenciesError) {
					return {
						resolved: false,
						depsHashes: e.missingDepsHashes,
					};
				} else throw e;
			}
		}
	}

	return { resolved: true, valid: true };
}

export async function run_agent_validation_callback(
	workspace: Workspace,
	records: Record[],
): Promise<ValidationOutcome> {
	const create_agent_record = records[2];

	const zomes_to_invoke = await get_zomes_to_invoke(
		create_agent_record,
		workspace,
	);

	const ops = recordToDhtOps(create_agent_record);

	for (const dhtOp of ops) {
		const op = await chainOpToOp(
			workspace,
			(dhtOp as { ChainOp: ChainOp }).ChainOp,
		);
		if ((op as DepsMissing).depsHashes)
			throw new MissingDependenciesError((op as DepsMissing).depsHashes);

		const outcome = await run_validation_callback_inner(
			zomes_to_invoke as SimulatedZome[],
			op as Op,
			workspace,
		);
		if (!outcome.resolved) return outcome;
		if (!outcome.valid) return outcome;
	}

	return {
		resolved: true,
		valid: true,
	};
}
