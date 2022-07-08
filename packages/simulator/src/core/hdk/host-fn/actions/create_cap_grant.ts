import {
  Entry,
  ZomeCallCapGrant,
  CapSecret,
  AgentPubKey,
  ActionHash,
} from '@holochain/client';
import { HostFn, HostFnWorkspace } from '../../host-fn';
import { common_create } from './common/create';

export type CreateCapGrantFn = (
  cap_grant: ZomeCallCapGrant
) => Promise<ActionHash>;

// Creates a new Create action and its entry in the source chain
export const create_cap_grant: HostFn<CreateCapGrantFn> =
  (worskpace: HostFnWorkspace): CreateCapGrantFn =>
  async (cap_grant: ZomeCallCapGrant): Promise<ActionHash> => {
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

    const entry: Entry = { entry_type: 'CapGrant', entry: cap_grant };

    return common_create(worskpace, entry, 'CapGrant');
  };
