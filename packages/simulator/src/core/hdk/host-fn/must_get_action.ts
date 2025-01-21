import { ActionHash, SignedActionHashed } from '@holochain/client';

import { GetStrategy } from '../../../types.js';
import { MissingDependenciesError } from '../../cell/workflows/app_validation/types.js';
import { HostFn, HostFnWorkspace } from '../host-fn.js';

export type MustGetActionFn = (args: ActionHash) => Promise<SignedActionHashed>;

export const must_get_action: HostFn<MustGetActionFn> =
	(workspace: HostFnWorkspace): MustGetActionFn =>
	async (hash): Promise<SignedActionHashed> => {
		if (!hash) throw new Error(`Cannot get with undefined hash`);

		const action = await workspace.cascade.retrieve_action(hash, {
			strategy: GetStrategy.Latest,
		});

		if (action) return action;

		throw new MissingDependenciesError([hash]);
	};
