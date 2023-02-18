import { ActionHash } from '@holochain/client';
import { HostFn, HostFnWorkspace } from '../../host-fn.js';
import { common_delete } from './common/delete.js';

export type DeleteCapGrantFn = (
  deletes_address: ActionHash
) => Promise<ActionHash>;

// Creates a new Create action and its entry in the source chain
export const delete_cap_grant: HostFn<DeleteCapGrantFn> =
  (worskpace: HostFnWorkspace): DeleteCapGrantFn =>
  async (deletes_address): Promise<ActionHash> => {
    return common_delete(worskpace, deletes_address);
  };
