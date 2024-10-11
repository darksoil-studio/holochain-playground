import { CellMap, HoloHashMap, hashAction } from '@holochain-open-dev/utils';
import {
	SimulatedDna,
	getEntryTypeString,
} from '@holochain-playground/simulator';
import {
	Action,
	ActionHash,
	ActionType,
	AnyDhtHash,
	AppEntryDef,
	CreateLink,
	Delete,
	DeleteLink,
	DhtOp,
	DhtOpType,
	Entry,
	EntryHash,
	HoloHash,
	NewEntryAction,
	Update,
	getDhtOpEntry,
	getDhtOpType,
} from '@holochain/client';

function appendToArray<T>(
	map: HoloHashMap<HoloHash, T[]>,
	key: HoloHash,
	value: T,
) {
	if (!map.has(key)) map.set(key, []);

	const previous_value = map.get(key);
	map.set(key, [...previous_value, value]);
}

export interface DhtSummary {
	actions: HoloHashMap<ActionHash, Action>;
	// Updated action -> action that updates
	actionUpdates: HoloHashMap<ActionHash, ActionHash[]>;
	// Deleted action -> action that deletes
	actionDeletes: HoloHashMap<ActionHash, ActionHash[]>;
	entries: HoloHashMap<EntryHash, any>;
	// Entry hash -> action that created that entry
	actionsByEntry: HoloHashMap<EntryHash, ActionHash[]>;

	links: HoloHashMap<
		AnyDhtHash,
		Array<{
			target_address: EntryHash;
			tag: any;
			add_link_hash: ActionHash;
		}>
	>;
	// Deleted add link -> action that deletes that
	deletedAddLinks: HoloHashMap<ActionHash, ActionHash[]>;
	entryTypes: HoloHashMap<EntryHash, string>;
}

export function getDhtOpAction(op: DhtOp): Action {
	const opType = getDhtOpType(op);
	const action = Object.values(op)[0][1];

	if (opType === DhtOpType.RegisterAddLink) {
		return {
			type: 'CreateLink',
			...action,
		};
	}
	if (
		opType === DhtOpType.RegisterUpdatedContent ||
		opType === DhtOpType.RegisterUpdatedRecord
	) {
		return {
			type: 'Update',
			...action,
		};
	}
	if (
		opType === DhtOpType.RegisterDeletedBy ||
		opType === DhtOpType.RegisterDeletedEntryAction
	) {
		return {
			type: 'Delete',
			...action,
		};
	}

	if (action.author) return action;
	else {
		const actionType = Object.keys(action)[0];
		return {
			type: actionType,
			...action[actionType],
		};
	}
}

export function summarizeDht(
	dhtShards: CellMap<DhtOp[]>,
	simulatedDna?: SimulatedDna,
): DhtSummary {
	// For every action hash, the types of Op that have been visited already
	const visited = new HoloHashMap<ActionHash, string[]>();

	const actions = new HoloHashMap<ActionHash, Action>();
	// Updated action -> action that updates
	const actionUpdates = new HoloHashMap<ActionHash, ActionHash[]>();
	// Deleted action -> action that deletes
	const actionDeletes = new HoloHashMap<ActionHash, ActionHash[]>();
	const entries = new HoloHashMap<EntryHash, any>();
	// Entry hash -> action that created that entry
	const actionsByEntry = new HoloHashMap<EntryHash, ActionHash[]>();
	const entryLinks = new HoloHashMap<
		AnyDhtHash,
		Array<{
			target_address: EntryHash;
			tag: any;
			add_link_hash: ActionHash;
		}>
	>();
	// Deleted add link -> action that deletes that
	const deletedAddLinks = new HoloHashMap<ActionHash, ActionHash[]>();

	const entryTypes = new HoloHashMap<EntryHash, string>();
	for (const shard of dhtShards.values()) {
		for (const dhtOp of shard) {
			const dhtOpType = getDhtOpType(dhtOp);

			const action = getDhtOpAction(dhtOp);

			const actionHash = hashAction(action);

			if (!visited.has(actionHash)) {
				visited.set(actionHash, []);
			}
			if (!visited.get(actionHash).includes(dhtOpType)) {
				visited.set(actionHash, [...visited.get(actionHash), dhtOpType]);

				actions.set(actionHash, action);

				if (dhtOpType === DhtOpType.StoreEntry) {
					const entry_hash = (action as NewEntryAction).entry_hash;
					const entry = getDhtOpEntry(dhtOp);
					entries.set(entry_hash, entry);
					appendToArray(actionsByEntry, entry_hash, actionHash);

					const entryType = simulatedDna
						? getEntryTypeString(
								simulatedDna,
								(action as NewEntryAction).entry_type,
							)
						: getConnectedEntryType(action as NewEntryAction, entry!);
					entryTypes.set(entry_hash, entryType);
				} else if (dhtOpType === DhtOpType.RegisterAddLink) {
					const base_address = (action as CreateLink).base_address;
					const target_address = (action as CreateLink).target_address;
					const tag = (action as CreateLink).tag;
					appendToArray(entryLinks, base_address, {
						tag,
						target_address,
						add_link_hash: actionHash,
					});
				} else if (dhtOpType === DhtOpType.RegisterRemoveLink) {
					const add_link_hash = (action as DeleteLink).link_add_address;
					appendToArray(deletedAddLinks, add_link_hash, actionHash);
				} else if (
					dhtOpType === DhtOpType.RegisterDeletedBy ||
					dhtOpType === DhtOpType.RegisterDeletedEntryAction
				) {
					const deletedAction = (action as Delete).deletes_address;
					appendToArray(actionDeletes, deletedAction, actionHash);
				} else if (
					dhtOpType === DhtOpType.RegisterUpdatedContent ||
					dhtOpType === DhtOpType.RegisterUpdatedRecord
				) {
					const updatedAction = (action as Update).original_action_address;
					appendToArray(actionUpdates, updatedAction, actionHash);
				}
			}
		}
	}

	return {
		actions,
		actionUpdates,
		actionDeletes,
		entries,
		actionsByEntry,
		links: entryLinks,
		deletedAddLinks,
		entryTypes,
	};
}

export function isEntryDeleted(
	summary: DhtSummary,
	entryHash: EntryHash,
): boolean {
	const actions = summary.actionsByEntry.get(entryHash);
	const aliveActions = actions.filter(h => !summary.actionDeletes.has(h));

	return aliveActions.length === 0;
}

function getConnectedEntryType(action: NewEntryAction, entry: Entry): string {
	if (
		entry.entry_type !== 'App' &&
		(entry.entry_type as any) !== 'CounterSign'
	) {
		return entry.entry_type;
	}
	const appEntryType = (
		action.entry_type as {
			App: AppEntryDef;
		}
	).App;

	return `Zome:${appEntryType.zome_index},EntryId:${appEntryType.entry_index}`;
}
