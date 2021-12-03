import { AgentPubKeyB64, Element } from '@holochain-open-dev/core-types';
import {
  AgentPubKey,
  HeaderType,
  NewEntryHeader,
  SignedHeaderHashed,
} from '@holochain/conductor-api';
import { cloneDeep } from 'lodash-es';

import { SimulatedZome } from '../../../dnas/simulated-dna';
import { areEqual } from '../../../processors/hash';
import { GetStrategy } from '../../../types';
import { BadAgentConfig } from '../../bad-agent';
import { buildZomeFunctionContext } from '../../hdk/context';
import { HostFnWorkspace } from '../../hdk/host-fn';
import { Cascade } from '../cascade/cascade';
import { getTipOfChain, valid_cap_grant } from '../source-chain/utils';
import { CellState } from '../state';
import { ValidationOutcome } from '../sys_validate/types';
import {
  run_create_link_validation_callback,
  run_delete_link_validation_callback,
  run_validation_callback_direct,
} from './app_validation';
import { produce_dht_ops_task } from './produce_dht_ops';
import { sys_validate_element } from './sys_validation';
import { Workflow, WorkflowType, Workspace } from './workflows';

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
    cap: Uint8Array
  ) =>
  async (
    workspace: Workspace
  ): Promise<{ result: any; triggers: Array<Workflow<any, any>> }> => {
    if (!valid_cap_grant(workspace.state, zomeName, fnName, provenance, cap))
      throw new Error('Unauthorized Zome Call');

    const currentHeader = getTipOfChain(workspace.state);
    const chain_head_start_len = workspace.state.sourceChain.length;

    const zomeIndex = workspace.dna.zomes.findIndex(
      zome => zome.name === zomeName
    );
    if (zomeIndex < 0)
      throw new Error(`There is no zome with the name ${zomeName} in this DNA`);

    const zome = workspace.dna.zomes[zomeIndex];
    if (!zome.zome_functions[fnName])
      throw new Error(
        `There isn't a function with the name ${fnName} in this zome with the name ${zomeName}`
      );

    const contextState = cloneDeep(workspace.state);

    const hostFnWorkspace: HostFnWorkspace = {
      cascade: new Cascade(workspace.state, workspace.p2p),
      state: contextState,
      dna: workspace.dna,
      p2p: workspace.p2p,
    };
    const zomeFnContext = buildZomeFunctionContext(hostFnWorkspace, zomeIndex);

    const result = await zome.zome_functions[fnName].call(zomeFnContext)(
      payload
    );

    let triggers: Array<Workflow<any, any>> = [];
    if (!areEqual(getTipOfChain(contextState), currentHeader)) {
      // Do validation
      let i = chain_head_start_len;

      const elementsToAppValidate = [];

      while (i < contextState.sourceChain.length) {
        const headerHash = contextState.sourceChain[i];
        const signed_header: SignedHeaderHashed =
          contextState.CAS.get(headerHash);
        const entry_hash = (signed_header.header.content as NewEntryHeader)
          .entry_hash;

        const element: Element = {
          entry: entry_hash ? contextState.CAS.get(entry_hash) : undefined,
          signed_header,
        };

        const depsMissing = await sys_validate_element(
          element,
          { ...workspace, state: contextState },
          workspace.p2p
        );
        if (depsMissing)
          throw new Error(
            `Could not validate a new element due to missing dependencies`
          );

        elementsToAppValidate.push(element);
        i++;
      }

      if (shouldValidateBeforePublishing(workspace.badAgentConfig)) {
        for (const element of elementsToAppValidate) {
          const outcome = await run_app_validation(
            zome,
            element,
            contextState,
            workspace
          );
          if (!outcome.resolved)
            throw new Error(
              'Error creating a new element: missing dependencies'
            );
          if (!outcome.valid)
            throw new Error('Error creating a new element: invalid');
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
  provenance: AgentPubKey
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
        new Uint8Array()
      )(worskpace),
  };
}

function shouldValidateBeforePublishing(
  badAgentConfig?: BadAgentConfig
): boolean {
  if (!badAgentConfig) return true;
  return !badAgentConfig.disable_validation_before_publish;
}

async function run_app_validation(
  zome: SimulatedZome,
  element: Element,
  contextState: CellState,
  workspace: Workspace
): Promise<ValidationOutcome> {
  const header = element.signed_header.header.content;
  if (header.type === HeaderType.CreateLink) {
    const cascade = new Cascade(contextState, workspace.p2p);
    const baseEntry = await cascade.retrieve_entry(header.base_address, {
      strategy: GetStrategy.Contents,
    });
    if (!baseEntry) {
      return {
        resolved: false,
        depsHashes: [header.base_address],
      };
    }
    const targetEntry = await cascade.retrieve_entry(header.target_address, {
      strategy: GetStrategy.Contents,
    });
    if (!targetEntry) {
      return {
        resolved: false,
        depsHashes: [header.target_address],
      };
    }
    return run_create_link_validation_callback(
      zome,
      header,
      baseEntry,
      targetEntry,
      workspace
    );
  } else if (header.type === HeaderType.DeleteLink) {
    return run_delete_link_validation_callback(zome, header, workspace);
  } else if (
    header.type === HeaderType.Create ||
    header.type === HeaderType.Update ||
    header.type === HeaderType.Delete
  ) {
    return run_validation_callback_direct(
      zome,
      workspace.dna,
      element,
      workspace
    );
  }
  return {
    valid: true,
    resolved: true,
  };
}
