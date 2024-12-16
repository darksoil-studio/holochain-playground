import {
	ActionType,
	AgentPubKey,
	AgentValidationPkg,
	AppEntryDef,
	ChainOp,
	CreateLink,
	DeleteLink,
	DhtOp,
	Entry,
	NewEntryAction,
	Record,
	RecordEntry,
} from '@holochain/client';
import { HashType, hash, hashAction } from '@tnesh-stack/utils';
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
} from '../utils.js';
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

	if (!workComplete) triggers.push(app_validation_task());

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

export async function validate_op(
	op: ChainOp,
	from_agent: AgentPubKey | undefined,
	workspace: Workspace,
): Promise<ValidationOutcome> {
	const record = dht_ops_to_record(op);

	const entry_type = (record.signed_action.hashed.content as NewEntryAction)
		.entry_type;
	if (entry_type === 'CapClaim' || entry_type === 'CapGrant')
		return {
			valid: true,
			resolved: true,
		};

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

	const action = record.signed_action.hashed.content;
	if (action.type === ActionType.DeleteLink) {
		return run_delete_link_validation_callback(zomes[0], action, workspace);
	} else if (action.type === ActionType.CreateLink) {
		return run_create_link_validation_callback(zomes[0], action, workspace);
	} else {
		return run_validation_callback_inner(
			zomes,
			record,
			maybeEntryDef as EntryDef,
			workspace,
		);
	}
}

function dht_ops_to_record(op: ChainOp): Record {
	const action = getDhtOpAction(op);
	const actionHash = hashAction(action);
	let entry: RecordEntry = {
		NotApplicable: undefined,
	};
	if ((action as NewEntryAction).entry_hash) {
		const e = getEntry({ ChainOp: op });
		const publicEntryType = isPublic((action as NewEntryAction).entry_type);
		entry = e
			? {
					Present: e,
				}
			: publicEntryType
				? {
						NotStored: undefined,
					}
				: {
						Hidden: undefined,
					};
	}

	return {
		entry,
		signed_action: {
			hashed: {
				content: action,
				hash: actionHash,
			},
			signature: getDhtOpSignature(op),
		},
	};
}

export async function run_validation_callback_direct(
	zome: SimulatedZome,
	dna: SimulatedDna,
	record: Record,
	workspace: Workspace,
): Promise<ValidationOutcome> {
	const maybeEntryDef = await get_associated_entry_def(record, dna, workspace);

	if (maybeEntryDef && (maybeEntryDef as DepsMissing).depsHashes)
		return {
			resolved: false,
			depsHashes: (maybeEntryDef as DepsMissing).depsHashes,
		};

	// TODO: implement validation package

	return run_validation_callback_inner(
		[zome],
		record,
		maybeEntryDef as EntryDef | undefined,
		workspace,
	);
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
	record: Record,
	entry_def: EntryDef | undefined,
	workspace: Workspace,
): Promise<ValidationOutcome> {
	const fnsToCall = get_record_validate_functions_to_invoke(record, entry_def);

	return invoke_validation_fns(
		zomes_to_invoke,
		fnsToCall,
		{ record },
		workspace,
	);
}

async function invoke_validation_fns(
	zomes_to_invoke: Array<SimulatedZome>,
	fnsToCall: string[],
	payload: any,
	workspace: Workspace,
): Promise<ValidationOutcome> {
	const cascade = new Cascade(workspace.state, workspace.p2p);
	const hostFnWorkspace: HostFnWorkspace = {
		cascade,
		state: workspace.state,
		dna: workspace.dna,
		p2p: workspace.p2p,
	};

	for (const zome of zomes_to_invoke) {
		for (const validateFn of fnsToCall) {
			if (zome.validation_functions[validateFn]) {
				const context = buildValidationFunctionContext(
					hostFnWorkspace,
					workspace.dna.zomes.findIndex(z => z === zome),
				);

				const outcome: ValidationOutcome =
					await zome.validation_functions[validateFn](context)(payload);
				if (!outcome.resolved) return outcome;
				else if (!outcome.valid) return outcome;
			}
		}
	}

	return { resolved: true, valid: true };
}

export async function run_agent_validation_callback(
	workspace: Workspace,
	records: Record[],
) {
	const create_agent_record = records[2];
	const fnsToCall = ['validate_create_agent'];

	const zomes_to_invoke = await get_zomes_to_invoke(
		create_agent_record,
		workspace,
	);

	const membrane_proof = (
		records[1].signed_action.hashed.content as AgentValidationPkg
	).membrane_proof;

	return invoke_validation_fns(
		zomes_to_invoke as SimulatedZome[],
		fnsToCall,
		{
			record: records[2],
			membrane_proof,
			agent_pub_key: create_agent_record.signed_action.hashed.content.author,
		},
		workspace,
	);
}

export async function run_create_link_validation_callback(
	zome: SimulatedZome,
	create_link: CreateLink,
	workspace: Workspace,
): Promise<ValidationOutcome> {
	const validateCreateLink = 'validate_create_link';

	if (zome.validation_functions[validateCreateLink]) {
		const hostFnWorkspace: HostFnWorkspace = {
			cascade: new Cascade(workspace.state, workspace.p2p),
			state: workspace.state,
			dna: workspace.dna,
			p2p: workspace.p2p,
		};
		const context = buildValidationFunctionContext(
			hostFnWorkspace,
			workspace.dna.zomes.findIndex(z => z === zome),
		);

		const outcome: ValidationOutcome = await zome.validation_functions[
			validateCreateLink
		](context)({ create_link });

		return outcome;
	}

	return {
		resolved: true,
		valid: true,
	};
}

export async function run_delete_link_validation_callback(
	zome: SimulatedZome,
	delete_link: DeleteLink,
	workspace: Workspace,
): Promise<ValidationOutcome> {
	const validateCreateLink = 'validate_delete_link';

	if (zome.validation_functions[validateCreateLink]) {
		const hostFnWorkspace: HostFnWorkspace = {
			cascade: new Cascade(workspace.state, workspace.p2p),
			state: workspace.state,
			dna: workspace.dna,
			p2p: workspace.p2p,
		};
		const context = buildValidationFunctionContext(
			hostFnWorkspace,
			workspace.dna.zomes.findIndex(z => z === zome),
		);

		const outcome: ValidationOutcome = await zome.validation_functions[
			validateCreateLink
		](context)({ delete_link });

		return outcome;
	}

	return {
		resolved: true,
		valid: true,
	};
}

function get_record_validate_functions_to_invoke(
	record: Record,
	maybeEntryDef: EntryDef | undefined,
): Array<string> {
	const fnsComponents = ['validate'];

	const action = record.signed_action.hashed.content;

	if (action.type === ActionType.Create) fnsComponents.push('create');
	if (action.type === ActionType.Update) fnsComponents.push('update');
	if (action.type === ActionType.Delete) fnsComponents.push('delete');

	const entry_type = (action as NewEntryAction).entry_type;
	if (entry_type) {
		// if (entry_type === 'Agent') fnsComponents.push('agent');
		if ((entry_type as { App: AppEntryDef }).App) {
			fnsComponents.push('entry');
			if (maybeEntryDef) fnsComponents.push(maybeEntryDef.id);
		}
	}

	return unpackValidateFnsComponents(fnsComponents);
}

function unpackValidateFnsComponents(
	fnsComponents: Array<string>,
): Array<string> {
	const validateFunctions = [fnsComponents[0]];

	for (let i = 1; i < fnsComponents.length; i++) {
		validateFunctions.push(`${validateFunctions[i - 1]}_${fnsComponents[i]}`);
	}
	return validateFunctions;
}
