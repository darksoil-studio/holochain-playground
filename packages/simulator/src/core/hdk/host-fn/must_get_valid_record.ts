import { ActionHash, Record } from '@holochain/client';

import { GetStrategy } from '../../../types.js';
import { MissingDependenciesError } from '../../cell/workflows/app_validation/types.js';
import { HostFn, HostFnWorkspace } from '../host-fn.js';

export type MustGetValidRecordFn = (args: ActionHash) => Promise<Record>;

export const must_get_valid_record: HostFn<MustGetValidRecordFn> =
	(workspace: HostFnWorkspace): MustGetValidRecordFn =>
	async (hash): Promise<Record> => {
		if (!hash) throw new Error(`Cannot get with undefined hash`);

		const record = await workspace.cascade.dht_get(hash, {
			strategy: GetStrategy.Contents,
		});

		if (record) return record;

		throw new MissingDependenciesError([hash]);
	};
