import {
	ActionHash,
	AgentPubKey,
	AnyDhtHash,
	Record,
	RegisterAgentActivity,
	Warrant,
	encodeHashToBase64,
} from '@holochain/client';

import { ChainQueryFilter, GetOptions, GetStrategy } from '../../../types.js';
import { ChainStatus, HighestObserved } from '../../cell/state/metadata.js';
import { HostFn, HostFnWorkspace } from '../host-fn.js';

export type ChainFilters =
	| {
			ToGenesis: void;
	  }
	| {
			Take: number;
	  }
	| {
			Until: Array<ActionHash>;
	  }
	| {
			Both: [number, Array<ActionHash>];
	  };

export interface ChainFilter {
	chain_top: ActionHash;
	filters: Array<ChainFilters>;
	include_chached_entries: boolean;
}

export type MustGetAgentActivityFn = (
	agent: AgentPubKey,
	filter: ChainFilter,
) => Promise<Array<RegisterAgentActivity>>;

export const must_get_agent_activity: HostFn<MustGetAgentActivityFn> =
	(workspace: HostFnWorkspace): MustGetAgentActivityFn =>
	async (agent, filter): Promise<Array<RegisterAgentActivity>> => {
		if (!agent)
			throw new Error(`Cannot get_agent_activity with undefined agent`);

		return workspace.cascade.dht_must_get_agent_activity(agent, filter);
	};
