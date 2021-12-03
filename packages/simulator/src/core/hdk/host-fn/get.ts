import { Element } from '@holochain-open-dev/core-types';
import { AnyDhtHash } from '@holochain/conductor-api';
import { GetOptions, GetStrategy } from '../../../types';
import { HostFn, HostFnWorkspace } from '../host-fn';

export type GetFn = (
  args: AnyDhtHash,
  options?: GetOptions
) => Promise<Element | undefined>;

// Creates a new Create header and its entry in the source chain
export const get: HostFn<GetFn> =
  (workspace: HostFnWorkspace): GetFn =>
  async (hash, options): Promise<Element | undefined> => {
    if (!hash) throw new Error(`Cannot get with undefined hash`);

    options = options || { strategy: GetStrategy.Contents };

    return workspace.cascade.dht_get(hash, options);
  };
