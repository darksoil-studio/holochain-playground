import {
	ActionHash,
	AgentPubKey,
	AnyLinkableHash,
	DnaHash,
	LinkType,
	OpenChain as NativeOpenChain,
	Record,
} from '@holochain/client';

import {
	MigrationTarget,
	buildCreateLink,
	buildOpenChain,
	buildShh,
} from '../../../cell/source-chain/builder-actions.js';
import { putRecord } from '../../../cell/source-chain/put.js';
import { HostFn, HostFnWorkspace } from '../../host-fn.js';

export type OpenChainFn = (args: {
	prev_target: MigrationTarget;
	close_hash: ActionHash;
}) => Promise<ActionHash>;

// Creates a new CreateLink action in the source chain
export const open_chain: HostFn<OpenChainFn> =
	(worskpace: HostFnWorkspace, zome_index: number): OpenChainFn =>
	async (args): Promise<ActionHash> => {
		const openChain = buildOpenChain(
			worskpace.state,
			args.prev_target,
			args.close_hash,
		);

		const record: Record = {
			signed_action: buildShh(openChain as unknown as NativeOpenChain),
			entry: { NotApplicable: undefined },
		};
		putRecord(record)(worskpace.state);
		return record.signed_action.hashed.hash;
	};
