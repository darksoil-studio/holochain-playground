import { EntryHash, Link, LinkType } from '@holochain/client';

import { GetLinksOptions, GetStrategy } from '../../../types.js';
import { HostFn, HostFnWorkspace } from '../host-fn.js';

export type GetLinksFn = (
	base_address: EntryHash,
	link_type: LinkType,
	options?: GetLinksOptions,
) => Promise<Link[] | undefined>;

// Creates a new Create action and its entry in the source chain
export const get_links: HostFn<GetLinksFn> =
	(workspace: HostFnWorkspace): GetLinksFn =>
	async (base_address, link_type: LinkType, options): Promise<Link[]> => {
		if (!base_address) throw new Error(`Cannot get with undefined hash`);

		options = options || { strategy: GetStrategy.Contents };
		return workspace.cascade.dht_get_links(base_address, link_type, options);
	};
