import { AgentPubKey, CapSecret } from '@holochain/conductor-api';
import { HostFn, HostFnWorkspace } from '../host-fn';

export type CallRemoteFn = (args: {
  agent: AgentPubKey;
  zome: string;
  fn_name: string;
  cap_secret: CapSecret | undefined;
  payload: any;
}) => Promise<any>;

// Creates a new Create header and its entry in the source chain
export const call_remote: HostFn<CallRemoteFn> =
  (workspace: HostFnWorkspace): CallRemoteFn =>
  async (args): Promise<any> => {
    return workspace.p2p.call_remote(
      args.agent,
      args.zome,
      args.fn_name,
      args.cap_secret,
      args.payload
    );
  };
