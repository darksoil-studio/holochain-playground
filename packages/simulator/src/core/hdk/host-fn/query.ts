import { NewEntryAction, Record } from '@holochain/client';
import isEqual from 'lodash-es/isEqual.js';

import { areEqual } from '../../../processors/hash.js';
import { ChainQueryFilter } from '../../../types.js';
import { getAllAuthoredActions } from '../../cell/source-chain/get.js';
import { HostFn, HostFnWorkspace } from '../host-fn.js';

export type QueryFn = (filter: ChainQueryFilter) => Promise<Array<Record>>;

// Creates a new Create action and its entry in the source chain
export const query: HostFn<QueryFn> =
	(workspace: HostFnWorkspace): QueryFn =>
	async (filter): Promise<Array<Record>> => {
		let actions = getAllAuthoredActions(workspace.state);

		// TODO: filter by sequence_range

		if (filter.action_type) {
			actions = actions.filter(action => {
				const actionType = action.hashed.content.type;
				return filter.action_type!.find(
					wantedActionType => wantedActionType === actionType,
				);
			});
		}

		if (filter.entry_hashes) {
			actions = actions.filter(action => {
				const entryHash = (action.hashed.content as NewEntryAction).entry_hash;
				if (!entryHash) return false;
				return filter.entry_hashes!.find(wantedEntryHash =>
					areEqual(wantedEntryHash, entryHash),
				);
			});
		}

		if (filter.entry_type) {
			actions = actions.filter(action => {
				const entryType = (action.hashed.content as NewEntryAction).entry_type;
				if (!entryType) return false;
				return filter.entry_type!.find(wantedEntryType =>
					isEqual(wantedEntryType, entryType),
				);
			});
		}

		const records = actions.map(action => {
			let entry = undefined;

			if (filter.include_entries) {
				if ((action.hashed.content as NewEntryAction).entry_hash) {
					entry = workspace.state.CAS.get(
						(action.hashed.content as NewEntryAction).entry_hash,
					);
				}
			}

			return {
				signed_action: action,
				entry,
			};
		});
		const sortedRecords = records.sort((r1, r2) => {
			const t1 = r1.signed_action.hashed.content.timestamp;
			const t2 = r2.signed_action.hashed.content.timestamp;
			return filter.order_descending ? t2 - t1 : t1 - t2;
		});

		return sortedRecords;
	};
