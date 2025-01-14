import {
	AnyDhtHash,
	Link,
	LinkType,
	SignedActionHashed,
} from '@holochain/client';

import { GetLinksOptions, GetStrategy } from '../../../types.js';
import { HostFn, HostFnWorkspace } from '../host-fn.js';

export type LinkDetails = Array<
	[SignedActionHashed, Array<SignedActionHashed>]
>;

export type GetLinkDetailsFn = (
	base_address: AnyDhtHash,
	link_type: LinkType,
	options?: GetLinksOptions,
) => Promise<LinkDetails>;

export const get_link_details: HostFn<GetLinkDetailsFn> =
	(workspace: HostFnWorkspace): GetLinkDetailsFn =>
	async (base_address, link_type: LinkType, options): Promise<LinkDetails> => {
		if (!base_address) throw new Error(`Cannot get with undefined hash`);

		options = options || { strategy: GetStrategy.Contents };
		return workspace.cascade.dht_get_link_details(
			base_address,
			link_type,
			options,
		);
	};
