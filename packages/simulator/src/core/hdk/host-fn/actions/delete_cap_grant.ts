import { HeaderHash } from '@holochain/conductor-api';
import { HostFn, HostFnWorkspace } from '../../host-fn';
import { common_delete } from './common/delete';

export type DeleteCapGrantFn = (
  deletes_address: HeaderHash
) => Promise<HeaderHash>;

// Creates a new Create header and its entry in the source chain
export const delete_cap_grant: HostFn<DeleteCapGrantFn> =
  (worskpace: HostFnWorkspace): DeleteCapGrantFn =>
  async (deletes_address): Promise<HeaderHash> => {
    return common_delete(worskpace, deletes_address);
  };
