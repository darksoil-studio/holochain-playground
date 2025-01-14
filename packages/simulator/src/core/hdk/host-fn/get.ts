import { AnyDhtHash, Record, encodeHashToBase64 } from '@holochain/client';

import { GetOptions, GetStrategy } from '../../../types.js';
import { HostFn, HostFnWorkspace } from '../host-fn.js';

export type GetFn = (
	args: AnyDhtHash,
	options?: GetOptions,
) => Promise<Record | undefined>;

// Creates a new Create action and its entry in the source chain
export const get: HostFn<GetFn> =
	(workspace: HostFnWorkspace): GetFn =>
	async (hash, options): Promise<Record | undefined> => {
		if (!hash) throw new Error(`Cannot get with undefined hash`);

		options = options || { strategy: GetStrategy.Contents };
		return workspace.cascade.dht_get(hash, options);
	};
