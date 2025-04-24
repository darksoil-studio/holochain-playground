import {
	DhtOp,
	Entry,
	NewEntryAction,
	Record,
	SignedActionHashed,
} from '@holochain/client';
import { ValidationStatus } from '@darksoil-studio/holochain-core-types';

import { isPublic } from './core/cell/index.js';
import { CellState } from './core/cell/state.js';

export function selectSourceChain(cellState: CellState): Record[] {
	const actionHashes = cellState.sourceChain;

	return actionHashes.map(hash => {
		const signed_action: SignedActionHashed = { ...cellState.CAS.get(hash) };

		const newEntryAction = signed_action.hashed.content as NewEntryAction;
		const { entry_hash } = newEntryAction;
		let entry: Entry | undefined;
		if (entry_hash) {
			const storedEntry = cellState.CAS.get(entry_hash);
			if (storedEntry) {
				entry = { ...storedEntry };
			}
		}

		const publicEntryType = isPublic(newEntryAction.entry_type);
		return {
			signed_action,
			entry: entry
				? {
						Present: entry,
					}
				: publicEntryType
					? {
							NotStored: undefined,
						}
					: {
							Hidden: undefined,
						},
		};
	});
}
