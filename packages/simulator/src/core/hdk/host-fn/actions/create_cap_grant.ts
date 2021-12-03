import {
  Entry,
  ZomeCallCapGrant,
  CapSecret,
  AgentPubKey,
  HeaderHash,
} from '@holochain/conductor-api';
import { HostFn, HostFnWorkspace } from '../../host-fn';
import { common_create } from './common/create';

export type CreateCapGrantFn = (
  cap_grant: ZomeCallCapGrant
) => Promise<HeaderHash>;

// Creates a new Create header and its entry in the source chain
export const create_cap_grant: HostFn<CreateCapGrantFn> =
  (worskpace: HostFnWorkspace): CreateCapGrantFn =>
  async (cap_grant: ZomeCallCapGrant): Promise<HeaderHash> => {
    if (
      (
        cap_grant.access as {
          Assigned: {
            secret: CapSecret;
            assignees: AgentPubKey[];
          };
        }
      ).Assigned.assignees.find(a => !!a && !ArrayBuffer.isView(a))
    ) {
      throw new Error('Tried to assign a capability to an invalid agent');
    }

    const entry: Entry = { entry_type: 'CapGrant', content: cap_grant };

    return common_create(worskpace, entry, 'CapGrant');
  };
