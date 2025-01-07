import {
	ActionHash,
	AgentPubKey,
	AnyDhtHash,
	Record,
	Warrant,
	encodeHashToBase64,
} from '@holochain/client';

import { GetOptions, GetStrategy } from '../../../types.js';
import { ChainStatus, HighestObserved } from '../../cell/state/metadata.js';
import { HostFn, HostFnWorkspace } from '../host-fn.js';

// TODO: implement
export interface ChainQueryFilter {}

// TODO: implement
export interface ActivityRequest {}

export interface AgentActivity {
	valid_activity: Array<[number, ActionHash]>;
	rejected_activity: Array<[number, ActionHash]>;
	status: ChainStatus;
	highest_observed: HighestObserved | undefined;
	warrants: Array<Warrant>;
}

export type GetAgentActivityFn = (
	agent: AgentPubKey,
	query: ChainQueryFilter,
	request: ActivityRequest,
) => Promise<AgentActivity>;

export const get_agent_activity: HostFn<GetAgentActivityFn> =
	(workspace: HostFnWorkspace): GetAgentActivityFn =>
	async (agent, query, request): Promise<AgentActivity> => {
		if (!agent)
			throw new Error(`Cannot get_agent_activity with undefined agent`);

		return workspace.cascade.dht_get_agent_activity(agent, query, request);
	};
