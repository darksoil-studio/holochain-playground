import { Details } from '@holochain-open-dev/core-types';
import { AnyDhtHash } from '@holochain/conductor-api';

import { GetOptions, GetStrategy } from '../../../types';
import { HostFn, HostFnWorkspace } from '../host-fn';

export type GetDetailsFn = (
  args: AnyDhtHash,
  options?: GetOptions
) => Promise<Details | undefined>;

// Creates a new Create header and its entry in the source chain
export const get_details: HostFn<GetDetailsFn> =
  (workspace: HostFnWorkspace): GetDetailsFn =>
  async (hash, options): Promise<Details | undefined> => {
    if (!hash) throw new Error(`Cannot get with undefined hash`);

    options = options || { strategy: GetStrategy.Contents };

    return workspace.cascade.dht_get_details(hash, options);
  };
