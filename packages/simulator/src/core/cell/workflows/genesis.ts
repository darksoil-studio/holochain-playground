import { Entry, CellId, DnaHash, AgentPubKey } from '@holochain/conductor-api';

import {
  buildAgentValidationPkg,
  buildCreate,
  buildDna,
  buildShh,
} from '../source-chain/builder-headers';
import {
  getSourceChainElement,
  getSourceChainElements,
} from '../source-chain/get';
import { putElement } from '../source-chain/put';
import { CellState } from '../state';
import { run_agent_validation_callback } from './app_validation';
import { produce_dht_ops_task } from './produce_dht_ops';
import { Workflow, WorkflowReturn, WorkflowType, Workspace } from './workflows';

export const genesis =
  (agentId: AgentPubKey, dnaHash: DnaHash, membrane_proof: any) =>
  async (worskpace: Workspace): Promise<WorkflowReturn<void>> => {
    const dna = buildDna(dnaHash, agentId);
    putElement({ signed_header: buildShh(dna), entry: undefined })(
      worskpace.state
    );

    const pkg = buildAgentValidationPkg(worskpace.state, membrane_proof);
    putElement({ signed_header: buildShh(pkg), entry: undefined })(
      worskpace.state
    );

    const entry: Entry = {
      content: agentId,
      entry_type: 'Agent',
    };
    const create_agent_pub_key_entry = buildCreate(
      worskpace.state,
      entry,
      'Agent'
    );
    putElement({
      signed_header: buildShh(create_agent_pub_key_entry),
      entry: entry,
    })(worskpace.state);

    if (
      !(
        worskpace.badAgentConfig &&
        worskpace.badAgentConfig.disable_validation_before_publish
      )
    ) {
      const firstElements = getSourceChainElements(worskpace.state, 0, 3);
      const result = await run_agent_validation_callback(
        worskpace,
        firstElements
      );
      if (!result.resolved) throw new Error('Unresolved in agent validate?');
      else if (!result.valid) throw new Error('Agent is invalid in this Dna');
    }

    return {
      result: undefined,
      triggers: [produce_dht_ops_task()],
    };
  };

export type GenesisWorkflow = Workflow<
  { cellId: CellId; membrane_proof: any },
  void
>;

export function genesis_task(
  cellId: CellId,
  membrane_proof: any
): GenesisWorkflow {
  return {
    type: WorkflowType.GENESIS,
    details: {
      cellId,
      membrane_proof,
    },
    task: worskpace => genesis(cellId[1], cellId[0], membrane_proof)(worskpace),
  };
}
