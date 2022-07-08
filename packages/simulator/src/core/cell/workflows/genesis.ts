import { Entry, CellId, DnaHash, AgentPubKey } from '@holochain/client';

import {
  buildAgentValidationPkg,
  buildCreate,
  buildDna,
  buildShh,
} from '../source-chain/builder-actions';
import {
  getSourceChainRecord,
  getSourceChainRecords,
} from '../source-chain/get';
import { putRecord } from '../source-chain/put';
import { CellState } from '../state';
import { run_agent_validation_callback } from './app_validation';
import { produce_dht_ops_task } from './produce_dht_ops';
import { Workflow, WorkflowReturn, WorkflowType, Workspace } from './workflows';

export const genesis =
  (agentId: AgentPubKey, dnaHash: DnaHash, membrane_proof: any) =>
  async (worskpace: Workspace): Promise<WorkflowReturn<void>> => {
    const dna = buildDna(dnaHash, agentId);
    putRecord({ signed_action: buildShh(dna), entry: undefined })(
      worskpace.state
    );

    const pkg = buildAgentValidationPkg(worskpace.state, membrane_proof);
    putRecord({ signed_action: buildShh(pkg), entry: undefined })(
      worskpace.state
    );

    const entry: Entry = {
      entry: agentId,
      entry_type: 'Agent',
    };
    const create_agent_pub_key_entry = buildCreate(
      worskpace.state,
      entry,
      'Agent'
    );
    putRecord({
      signed_action: buildShh(create_agent_pub_key_entry),
      entry: {
        Present: entry
      },
    })(worskpace.state);

    if (
      !(
        worskpace.badAgentConfig &&
        worskpace.badAgentConfig.disable_validation_before_publish
      )
    ) {
      const firstRecords = getSourceChainRecords(worskpace.state, 0, 3);
      const result = await run_agent_validation_callback(
        worskpace,
        firstRecords
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
