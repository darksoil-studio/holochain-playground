import { AgentPubKey } from '@holochain/client';
import { getCellId } from '../../cell/source-chain/utils.js';
import { HostFn, HostFnWorkspace } from '../host-fn.js';

export interface AgentInfo {
  agent_initial_pubkey: AgentPubKey;
  agent_latest_pubkey: AgentPubKey;
}

export type AgentInfoFn = () => Promise<AgentInfo>;

// Creates a new Create action and its entry in the source chain
export const agent_info: HostFn<AgentInfoFn> =
  (worskpace: HostFnWorkspace): AgentInfoFn =>
  async (): Promise<AgentInfo> => {
    const cellId = getCellId(worskpace.state);
    const agentPubKey = cellId[1];

    return {
      agent_initial_pubkey: agentPubKey,
      agent_latest_pubkey: agentPubKey,
    };
  };
