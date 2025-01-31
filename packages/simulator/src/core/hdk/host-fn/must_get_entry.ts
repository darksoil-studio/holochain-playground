import {
	AnyDhtHash,
	Entry,
	EntryHash,
	HoloHashed,
	Record,
	encodeHashToBase64,
} from '@holochain/client';

import { GetStrategy } from '../../../types.js';
import { MissingDependenciesError } from '../../cell/workflows/app_validation/types.js';
import { HostFn, HostFnWorkspace } from '../host-fn.js';

export type MustGetEntryFn = (args: EntryHash) => Promise<HoloHashed<Entry>>;

export const must_get_entry: HostFn<MustGetEntryFn> =
	(workspace: HostFnWorkspace): MustGetEntryFn =>
	async (hash): Promise<HoloHashed<Entry>> => {
		if (!hash) throw new Error(`Cannot get with undefined hash`);

		const entry = await workspace.cascade.retrieve_entry(hash, {
			strategy: GetStrategy.Latest,
		});

		if (entry)
			return {
				content: entry,
				hash,
			};

		throw new MissingDependenciesError([hash]);
	};
