import {
	Action,
	ActionType,
	AnyDhtHash,
	AppEntryDef,
	ChainOp,
	ChainOpType,
	Create,
	CreateLink,
	Delete,
	DeleteLink,
	DhtOp,
	Entry,
	EntryHash,
	EntryType,
	Record,
	Signature,
	Update,
	WarrantOp,
} from '@holochain/client';
import { HashType, hash, hashAction } from '@tnesh-stack/utils';

import { SimulatedDna } from '../../dnas/simulated-dna.js';
import { isPublic } from './source-chain/utils.js';

export function extractEntry(record: Record): Entry | undefined {
	return 'Present' in record.entry ? record.entry.Present : undefined;
}

export function hashEntry(entry: Entry): EntryHash {
	if (entry.entry_type === 'Agent') return entry.entry;
	return hash(entry, HashType.ENTRY);
}

export function getAppEntryType(
	entry_type: EntryType,
): AppEntryDef | undefined {
	return typeof entry_type === 'object' && 'App' in entry_type
		? entry_type.App
		: undefined;
}

export function getEntryTypeString(
	dna: SimulatedDna,
	entryType: EntryType,
): string {
	const appEntryType = getAppEntryType(entryType);

	if (appEntryType) {
		return dna.zomes[appEntryType.zome_index].entry_defs[
			appEntryType.entry_index
		].id;
	}

	return entryType as string;
}

export function getDhtOpBasis(dhtOp: DhtOp): AnyDhtHash {
	if (isWarrantOp(dhtOp)) {
		return getWarrantOpBasis((dhtOp as { WarrantOp: WarrantOp }).WarrantOp);
	}
	return getChainOpBasis((dhtOp as { ChainOp: ChainOp }).ChainOp);
}

export function getWarrantOpBasis(op: WarrantOp): AnyDhtHash {
	// const invalidChainOp = op.warrant.ChainIntegrity.InvalidChainOp;
	// if (invalidChainOp.)
	throw new Error('Unimplemented');
}

export function getChainOpBasis(dhtOp: ChainOp): AnyDhtHash {
	const type = getDhtOpType(dhtOp);
	const action = getDhtOpAction(dhtOp);

	const actionHash = hashAction(action);

	switch (type) {
		case ChainOpType.StoreRecord:
			return actionHash;
		case ChainOpType.StoreEntry:
			return (action as Create).entry_hash;
		case ChainOpType.RegisterUpdatedContent:
			return (action as Update).original_entry_address;
		case ChainOpType.RegisterUpdatedRecord:
			return (action as Update).original_action_address;
		case ChainOpType.RegisterAgentActivity:
			return action.author;
		case ChainOpType.RegisterAddLink:
			return (action as CreateLink).base_address;
		case ChainOpType.RegisterRemoveLink:
			return (action as DeleteLink).base_address;
		case ChainOpType.RegisterDeletedBy:
			return (action as Delete).deletes_address;
		case ChainOpType.RegisterDeletedEntryAction:
			return (action as Delete).deletes_entry_address;
		default:
			return undefined as unknown as AnyDhtHash;
	}
}

export const DHT_SORT_PRIORITY = [
	ChainOpType.RegisterAgentActivity,
	ChainOpType.StoreEntry,
	ChainOpType.StoreRecord,
	ChainOpType.RegisterUpdatedContent,
	ChainOpType.RegisterUpdatedRecord,
	ChainOpType.RegisterDeletedEntryAction,
	ChainOpType.RegisterDeletedBy,
	ChainOpType.RegisterAddLink,
	ChainOpType.RegisterRemoveLink,
];

export function recordToDhtOps(record: Record): DhtOp[] {
	const allDhtOps: DhtOp[] = [];

	// All hdk commands have these two DHT Ops
	allDhtOps.push({
		ChainOp: {
			[ChainOpType.RegisterAgentActivity]: [
				record.signed_action.signature,
				record.signed_action.hashed.content,
			],
		},
	});
	allDhtOps.push({
		ChainOp: {
			[ChainOpType.StoreRecord]: [
				record.signed_action.signature,
				record.signed_action.hashed.content,
				extractEntry(record),
			],
		},
	});

	// Each action derives into different DhtOps

	if (record.signed_action.hashed.content.type === ActionType.Update) {
		allDhtOps.push({
			ChainOp: {
				[ChainOpType.RegisterUpdatedContent]: [
					record.signed_action.signature,
					record.signed_action.hashed.content,
					extractEntry(record),
				],
			},
		});
		allDhtOps.push({
			ChainOp: {
				[ChainOpType.RegisterUpdatedRecord]: [
					record.signed_action.signature,
					record.signed_action.hashed.content,
					extractEntry(record),
				],
			},
		});
		if (isPublic(record.signed_action.hashed.content.entry_type)) {
			allDhtOps.push({
				ChainOp: {
					[ChainOpType.StoreEntry]: [
						record.signed_action.signature,
						record.signed_action.hashed.content,
						extractEntry(record)!,
					],
				},
			});
		}
	} else if (record.signed_action.hashed.content.type === ActionType.Create) {
		if (isPublic(record.signed_action.hashed.content.entry_type)) {
			allDhtOps.push({
				ChainOp: {
					[ChainOpType.StoreEntry]: [
						record.signed_action.signature,
						record.signed_action.hashed.content,
						extractEntry(record)!,
					],
				},
			});
		}
	} else if (record.signed_action.hashed.content.type === ActionType.Delete) {
		allDhtOps.push({
			ChainOp: {
				[ChainOpType.RegisterDeletedBy]: [
					record.signed_action.signature,
					record.signed_action.hashed.content,
				],
			},
		});
		allDhtOps.push({
			ChainOp: {
				[ChainOpType.RegisterDeletedEntryAction]: [
					record.signed_action.signature,
					record.signed_action.hashed.content,
				],
			},
		});
	} else if (
		record.signed_action.hashed.content.type === ActionType.DeleteLink
	) {
		allDhtOps.push({
			ChainOp: {
				[ChainOpType.RegisterRemoveLink]: [
					record.signed_action.signature,
					record.signed_action.hashed.content,
				],
			},
		});
	} else if (
		record.signed_action.hashed.content.type === ActionType.CreateLink
	) {
		allDhtOps.push({
			ChainOp: {
				[ChainOpType.RegisterAddLink]: [
					record.signed_action.signature,
					record.signed_action.hashed.content,
				],
			},
		});
	}

	return allDhtOps;
}

// export function sortDhtOps(dhtOps: DhtOp[]): DhtOp[] {
// 	const prio = (dhtOp: DhtOp) =>
// 		DHT_SORT_PRIORITY.findIndex(type => type === getDhtOpType(dhtOp));
// 	return dhtOps.sort((dhtA: DhtOp, dhtB: DhtOp) => prio(dhtA) - prio(dhtB));
// }

export function getEntry(dhtOp: DhtOp): Entry | undefined {
	if (isWarrantOp(dhtOp)) return undefined;

	const chainOp = (dhtOp as { ChainOp: ChainOp }).ChainOp;

	const type = getDhtOpType(chainOp);
	if (type === ChainOpType.StoreEntry) return getDhtOpEntry(chainOp);
	else if (type === ChainOpType.StoreRecord) return getDhtOpEntry(chainOp);
	return undefined;
}

export function isWarrantOp(op: DhtOp): boolean {
	if ((op as { ChainOp: ChainOp }).ChainOp) {
		return false;
	}
	if ((op as { WarrantOp: WarrantOp }).WarrantOp) {
		return true;
	}
	throw new Error(`Invalid DhtOp shape: ${JSON.stringify(op)}`);
}

export function getDhtOpType(op: ChainOp): ChainOpType {
	return Object.keys(op)[0] as ChainOpType;
}

export function getDhtOpAction(op: ChainOp): Action {
	const opType = getDhtOpType(op);

	const action = Object.values(op)[0][1];

	if (opType === ChainOpType.RegisterAddLink) {
		return {
			type: 'CreateLink',
			...action,
		};
	}
	if (
		opType === ChainOpType.RegisterUpdatedContent ||
		opType === ChainOpType.RegisterUpdatedRecord
	) {
		return {
			type: 'Update',
			...action,
		};
	}
	if (
		opType === ChainOpType.RegisterDeletedBy ||
		opType === ChainOpType.RegisterDeletedEntryAction
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

export function getDhtOpEntry(op: ChainOp): Entry | undefined {
	return Object.values(op)[0][2];
}

export function getDhtOpSignature(op: ChainOp): Signature {
	return Object.values(op)[0][1];
}
