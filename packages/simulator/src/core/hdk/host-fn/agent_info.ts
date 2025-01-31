import { ActionHash, AgentPubKey, Timestamp } from '@holochain/client';

import {
	getCellId,
	getRecord,
	getTipOfChain,
} from '../../cell/source-chain/utils.js';
import { HostFn, HostFnWorkspace } from '../host-fn.js';

export interface AgentInfo {
	agent_initial_pubkey: AgentPubKey;
	agent_latest_pubkey: AgentPubKey;
	chain_head: [ActionHash, number, Timestamp];
}

export type AgentInfoFn = () => Promise<AgentInfo>;

// Creates a new Create action and its entry in the source chain
export const agent_info: HostFn<AgentInfoFn> =
	(workspace: HostFnWorkspace): AgentInfoFn =>
	async (): Promise<AgentInfo> => {
		const cellId = getCellId(workspace.state);
		const agentPubKey = cellId[1];

		const chainTipHash = getTipOfChain(workspace.state);
		const chainTip = getRecord(workspace.state, chainTipHash);

		const content = chainTip.signed_action.hashed.content;

		const sequenceNumber = (content as { action_seq: number }).action_seq || 0;

		return {
			agent_initial_pubkey: agentPubKey,
			agent_latest_pubkey: agentPubKey,
			chain_head: [chainTipHash, sequenceNumber, content.timestamp],
		};
	};
