import {
	ActionType,
	AgentPubKey,
	NewEntryAction,
	Record,
	SignedActionHashed,
	encodeHashToBase64,
} from '@holochain/client';
import { cloneDeep } from 'lodash-es';

import { SimulatedZome } from '../../../dnas/simulated-dna.js';
import { areEqual } from '../../../processors/hash.js';
import { GetStrategy } from '../../../types.js';
import { BadAgentConfig } from '../../bad-agent.js';
import { buildZomeFunctionContext } from '../../hdk/context.js';
import { HostFnWorkspace } from '../../hdk/host-fn.js';
import { Cascade } from '../cascade/cascade.js';
import { getTipOfChain, valid_cap_grant } from '../source-chain/utils.js';
import { CellState } from '../state.js';
import { ValidationOutcome } from '../sys_validate/types.js';
import {
	run_create_link_validation_callback,
	run_delete_link_validation_callback,
	run_validation_callback_direct,
} from './app_validation.js';
import { produce_dht_ops_task } from './produce_dht_ops.js';
import { sys_validate_record } from './sys_validation.js';
import { Workflow, WorkflowType, Workspace } from './workflows.js';

/**
 * Calls the zome function of the cell DNA
 * This can only be called in the simulated mode: we can assume that cell.simulatedDna exists
 */
export const callZomeFn =
	(
		zomeName: string,
		fnName: string,
		payload: any,
		provenance: AgentPubKey,
		cap: Uint8Array,
	) =>
	async (
		workspace: Workspace,
	): Promise<{ result: any; triggers: Array<Workflow<any, any>> }> => {
		if (!valid_cap_grant(workspace.state, zomeName, fnName, provenance, cap))
			throw new Error('Unauthorized Zome Call');

		const currentAction = getTipOfChain(workspace.state);
		const chain_head_start_len = workspace.state.sourceChain.length;

		const zomeIndex = workspace.dna.zomes.findIndex(
			zome => zome.name === zomeName,
		);
		if (zomeIndex < 0)
			throw new Error(`There is no zome with the name ${zomeName} in this DNA`);

		const zome = workspace.dna.zomes[zomeIndex];
		if (!zome.zome_functions[fnName])
			throw new Error(
				`There isn't a function with the name ${fnName} in this zome with the name ${zomeName}`,
			);

		const contextState = cloneDeep(workspace.state);

		const hostFnWorkspace: HostFnWorkspace = {
			cascade: new Cascade(workspace.state, workspace.p2p),
			state: contextState,
			dna: workspace.dna,
			p2p: workspace.p2p,
		};
		const zomeFnContext = buildZomeFunctionContext(hostFnWorkspace, zomeIndex);

		const result =
			await zome.zome_functions[fnName].call(zomeFnContext)(payload);

		let triggers: Array<Workflow<any, any>> = [];
		if (!areEqual(getTipOfChain(contextState), currentAction)) {
			// Do validation
			let i = chain_head_start_len;

			const recordsToAppValidate = [];

			while (i < contextState.sourceChain.length) {
				const actionHash = contextState.sourceChain[i];
				const signed_action: SignedActionHashed =
					contextState.CAS.get(actionHash);
				const entry_hash = (signed_action.hashed.content as NewEntryAction)
					.entry_hash;

				const record: Record = {
					entry: entry_hash
						? { Present: contextState.CAS.get(entry_hash) }
						: { NotApplicable: undefined },
					signed_action,
				};

				const depsMissing = await sys_validate_record(
					record,
					{ ...workspace, state: contextState },
					workspace.p2p,
				);
				if (depsMissing)
					throw new Error(
						`Could not validate a new record due to missing dependencies`,
					);

				recordsToAppValidate.push(record);
				i++;
			}

			if (shouldValidateBeforePublishing(workspace.badAgentConfig)) {
				for (const record of recordsToAppValidate) {
					const outcome = await run_app_validation(zome, record, workspace);
					if (!outcome.resolved)
						throw new Error(
							'Error creating a new record: missing dependencies',
						);
					if (!outcome.valid)
						throw new Error('Error creating a new record: invalid');
				}
			}

			triggers.push(produce_dht_ops_task());
		}

		workspace.state.CAS = contextState.CAS;
		workspace.state.sourceChain = contextState.sourceChain;

		return {
			result: cloneDeep(result),
			triggers,
		};
	};

export type CallZomeFnWorkflow = Workflow<
	{ zome: string; fnName: string; payload: any },
	any
>;

export function call_zome_fn_workflow(
	zome: string,
	fnName: string,
	payload: any,
	provenance: AgentPubKey,
): CallZomeFnWorkflow {
	return {
		type: WorkflowType.CALL_ZOME,
		details: {
			fnName,
			payload,
			zome,
		},
		task: worskpace =>
			callZomeFn(
				zome,
				fnName,
				payload,
				provenance,
				new Uint8Array(),
			)(worskpace),
	};
}

function shouldValidateBeforePublishing(
	badAgentConfig?: BadAgentConfig,
): boolean {
	if (!badAgentConfig) return true;
	return !badAgentConfig.disable_validation_before_publish;
}

async function run_app_validation(
	zome: SimulatedZome,
	record: Record,
	workspace: Workspace,
): Promise<ValidationOutcome> {
	const action = record.signed_action.hashed.content;
	if (action.type === ActionType.CreateLink) {
		return run_create_link_validation_callback(zome, action, workspace);
	} else if (action.type === ActionType.DeleteLink) {
		return run_delete_link_validation_callback(zome, action, workspace);
	} else if (
		action.type === ActionType.Create ||
		action.type === ActionType.Update ||
		action.type === ActionType.Delete
	) {
		return run_validation_callback_direct(
			zome,
			workspace.dna,
			record,
			workspace,
		);
	}
	return {
		valid: true,
		resolved: true,
	};
}
