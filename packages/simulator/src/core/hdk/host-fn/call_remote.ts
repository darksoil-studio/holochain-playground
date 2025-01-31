import { AgentPubKey, CapSecret } from '@holochain/client';

import { HostFn, HostFnWorkspace } from '../host-fn.js';

export type CallRemoteFn = (args: {
	agent: AgentPubKey;
	zome: string;
	fn_name: string;
	cap_secret: CapSecret | undefined;
	payload: any;
}) => Promise<any>;

// Creates a new Create action and its entry in the source chain
export const call_remote: HostFn<CallRemoteFn> =
	(workspace: HostFnWorkspace): CallRemoteFn =>
	async (args): Promise<any> => {
		return workspace.p2p.call_remote(
			args.agent,
			args.zome,
			args.fn_name,
			args.cap_secret,
			args.payload,
		);
	};
