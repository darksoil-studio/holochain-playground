import {
	ActionHash,
	AgentPubKey,
	AnyLinkableHash,
	DnaHash,
	LinkType,
	CloseChain as NativeCloseChain,
	Record,
} from '@holochain/client';

import {
	MigrationTarget,
	buildCloseChain,
	buildCreateLink,
	buildShh,
} from '../../../cell/source-chain/builder-actions.js';
import { putRecord } from '../../../cell/source-chain/put.js';
import { HostFn, HostFnWorkspace } from '../../host-fn.js';

export type CloseChainFn = (args: {
	new_target: MigrationTarget;
}) => Promise<ActionHash>;

// Creates a new CreateLink action in the source chain
export const close_chain: HostFn<CloseChainFn> =
	(worskpace: HostFnWorkspace, zome_index: number): CloseChainFn =>
	async (args): Promise<ActionHash> => {
		const closeChain = buildCloseChain(worskpace.state, args.new_target);

		const record: Record = {
			signed_action: buildShh(closeChain as unknown as NativeCloseChain),
			entry: { NotApplicable: undefined },
		};
		putRecord(record)(worskpace.state);
		return record.signed_action.hashed.hash;
	};
