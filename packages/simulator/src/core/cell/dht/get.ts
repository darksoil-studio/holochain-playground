import {
	ActionHash,
	ActionType,
	AgentPubKey,
	EntryHash as AnyDhtHash,
	ChainOp,
	ChainOpType,
	Create,
	CreateLink,
	Delete,
	DeleteLink,
	Link,
	LinkType,
	NewEntryAction,
	RegisterAgentActivity,
	SignedActionHashed,
	Update,
	WarrantOp,
	encodeHashToBase64,
} from '@holochain/client';
import {
	DhtOpHash,
	EntryDetails,
	EntryDhtStatus,
	ValidationReceipt,
} from '@darksoil-studio/holochain-core-types';
import { HoloHashMap, hashAction } from '@darksoil-studio/holochain-utils';
import { HashType, hash } from '@darksoil-studio/holochain-utils';
import { isEqual, uniqWith } from 'lodash-es';

import { areEqual } from '../../../processors/hash.js';
import { ChainQueryFilter } from '../../../types.js';
import {
	ActivityRequest,
	AgentActivity,
} from '../../hdk/host-fn/get_agent_activity.js';
import { ChainFilter } from '../../hdk/host-fn/must_get_agent_activity.js';
import { GetLinksResponse } from '../cascade/types.js';
import { DepsMissing } from '../index.js';
import {
	CellState,
	IntegratedDhtOpsValue,
	IntegrationLimboValue,
	ValidationLimboStatus,
	ValidationLimboValue,
} from '../state.js';
import {
	ChainStatus,
	HighestObserved,
	LinkMetaVal,
	getSysMetaValActionHash,
} from '../state/metadata.js';
import { getDhtOpAction, getDhtOpType, isWarrantOp } from '../utils.js';
import { MissingDependenciesError } from '../workflows/app_validation/types.js';

export function getValidationLimboDhtOps(
	state: CellState,
	statuses: ValidationLimboStatus[],
): HoloHashMap<DhtOpHash, ValidationLimboValue> {
	const pendingDhtOps: HoloHashMap<DhtOpHash, ValidationLimboValue> =
		new HoloHashMap();

	for (const [dhtOpHash, limboValue] of state.validationLimbo.entries()) {
		if (statuses.includes(limboValue.status)) {
			pendingDhtOps.set(dhtOpHash, limboValue);
		}
	}

	return pendingDhtOps;
}

export const getValidationReceipts =
	(dhtOpHash: DhtOpHash) =>
	(state: CellState): ValidationReceipt[] => {
		return state.validationReceipts.has(dhtOpHash)
			? Array.from(state.validationReceipts.get(dhtOpHash).values())
			: [];
	};

export function pullAllIntegrationLimboDhtOps(
	state: CellState,
): HoloHashMap<DhtOpHash, IntegrationLimboValue> {
	const dhtOps = state.integrationLimbo;

	state.integrationLimbo = new HoloHashMap();

	return dhtOps;
}

export function getActionsForEntry(
	state: CellState,
	entryHash: AnyDhtHash,
): SignedActionHashed[] {
	const entryMetadata = state.metadata.system_meta.get(entryHash);
	if (!entryMetadata) return [];

	return entryMetadata
		.map(h => {
			const hash = getSysMetaValActionHash(h);
			if (hash) {
				return state.CAS.get(hash);
			}
			return undefined;
		})
		.filter(action => !!action);
}

export function getEntryDhtStatus(
	state: CellState,
	entryHash: AnyDhtHash,
): EntryDhtStatus | undefined {
	const meta = state.metadata.misc_meta.get(entryHash);

	return meta
		? (
				meta as {
					EntryStatus: EntryDhtStatus;
				}
			).EntryStatus
		: undefined;
}

export function getEntryDetails(
	state: CellState,
	entry_hash: AnyDhtHash,
): EntryDetails {
	const entry = state.CAS.get(entry_hash);
	const allActions = getActionsForEntry(state, entry_hash);
	const dhtStatus = getEntryDhtStatus(state, entry_hash);

	const createActions: HoloHashMap<
		ActionHash,
		SignedActionHashed<Create>
	> = new HoloHashMap();
	const updates: HoloHashMap<
		ActionHash,
		SignedActionHashed<Update>
	> = new HoloHashMap();
	const deletes: HoloHashMap<
		ActionHash,
		SignedActionHashed<Delete>
	> = new HoloHashMap();

	for (const action of allActions) {
		const actionContent = (action as SignedActionHashed).hashed.content;

		if (
			(actionContent as Update).original_entry_address &&
			areEqual((actionContent as Update).original_entry_address, entry_hash)
		) {
			updates.set(action.hashed.hash, action as SignedActionHashed<Update>);
		} else if (
			(actionContent as Create).entry_hash &&
			areEqual((actionContent as Create).entry_hash, entry_hash)
		) {
			createActions.set(
				action.hashed.hash,
				action as SignedActionHashed<Create>,
			);
		} else if (
			areEqual((actionContent as Delete).deletes_entry_address, entry_hash)
		) {
			deletes.set(action.hashed.hash, action as SignedActionHashed<Delete>);
		}
	}

	return {
		entry,
		actions: Array.from(createActions.values()),
		entry_dht_status: dhtStatus as EntryDhtStatus,
		updates: Array.from(updates.values()),
		deletes: Array.from(deletes.values()),
		rejected_actions: [], // TODO: after validation is implemented
	};
}

export function getActionModifiers(
	state: CellState,
	actionHash: ActionHash,
): {
	updates: SignedActionHashed<Update>[];
	deletes: SignedActionHashed<Delete>[];
} {
	const allModifiers = state.metadata.system_meta.get(actionHash);
	if (!allModifiers)
		return {
			updates: [],
			deletes: [],
		};

	const updates = allModifiers
		.filter(m => (m as { Update: ActionHash }).Update)
		.map(m => state.CAS.get((m as { Update: ActionHash }).Update));
	const deletes = allModifiers
		.filter(m => (m as { Delete: ActionHash }).Delete)
		.map(m => state.CAS.get((m as { Delete: ActionHash }).Delete));

	return {
		updates,
		deletes,
	};
}

export function getAllHeldEntries(state: CellState): AnyDhtHash[] {
	const newEntryActions = Array.from(state.integratedDHTOps.values())
		.filter(dhtOpValue => !isWarrantOp(dhtOpValue.op))
		.map(dhtOpValue => (dhtOpValue.op as { ChainOp: ChainOp }).ChainOp)
		.filter(chainOp => getDhtOpType(chainOp) === ChainOpType.StoreEntry)
		.map(chainOp => getDhtOpAction(chainOp));

	const allEntryHashes = newEntryActions.map(
		h => (h as NewEntryAction).entry_hash,
	);

	return uniqWith(allEntryHashes, areEqual);
}

export function getAllHeldActions(state: CellState): ActionHash[] {
	const actions = Array.from(state.integratedDHTOps.values())
		.filter(dhtOpValue => !isWarrantOp(dhtOpValue.op))
		.map(dhtOpValue => (dhtOpValue.op as { ChainOp: ChainOp }).ChainOp)
		.filter(chainOp => getDhtOpType(chainOp) === ChainOpType.StoreRecord)
		.map(chainOp => getDhtOpAction(chainOp));

	const allActionHashes = actions.map(h => hashAction(h));

	return uniqWith(allActionHashes, areEqual);
}

export function getAllAuthoredEntries(state: CellState): AnyDhtHash[] {
	const allActions = Array.from(state.authoredDHTOps.values())
		.filter(dhtOpValue => !isWarrantOp(dhtOpValue.op))
		.map(dhtOpValue => (dhtOpValue.op as { ChainOp: ChainOp }).ChainOp)
		.map(chainOp => getDhtOpAction(chainOp));

	const newEntryActions: NewEntryAction[] = allActions.filter(
		h => (h as NewEntryAction).entry_hash,
	) as NewEntryAction[];

	return newEntryActions.map(h => h.entry_hash);
}

export function isHoldingEntry(
	state: CellState,
	entryHash: AnyDhtHash,
): boolean {
	return state.metadata.system_meta.get(entryHash) !== undefined;
}

export function isHoldingRecord(
	state: CellState,
	actionHash: ActionHash,
): boolean {
	return state.metadata.misc_meta.get(actionHash) === 'StoreRecord';
}

export function isHoldingDhtOp(
	state: CellState,
	dhtOpHash: DhtOpHash,
): boolean {
	return !!state.integratedDHTOps.get(dhtOpHash);
}

export interface EntryDHTInfo {
	details: EntryDetails;
	links: LinkMetaVal[];
}

// export function getDhtShard(
//   state: CellState
// ): HoloHashMap<AnyDhtHash, EntryDHTInfo> {
//   const heldEntries = getAllHeldEntries(state);

//   const dhtShard: HoloHashMap<AnyDhtHash, EntryDHTInfo> = new HoloHashMap();

//   for (const entryHash of heldEntries) {
//     dhtShard.set(entryHash, {
//       details: getEntryDetails(state, entryHash),
//       links: getCreateLinksForHash(state, entryHash),
//     });
//   }

//   return dhtShard;
// }

export function getLinksForHash(
	state: CellState,
	baseHash: AnyDhtHash,
	link_type: LinkType,
): GetLinksResponse {
	const linkMetaVals = getCreateLinksForHash(state, baseHash, link_type);

	const link_adds: SignedActionHashed<CreateLink>[] = [];
	const link_removes: SignedActionHashed<DeleteLink>[] = [];

	for (const value of linkMetaVals) {
		const action = state.CAS.get(value.link_add_hash);

		if (action) {
			link_adds.push(action);
		}

		const removes = getRemovesOnLinkAdd(state, value.link_add_hash);
		for (const remove of removes) {
			const removeAction = state.CAS.get(remove);
			link_removes.push(removeAction);
		}
	}

	return {
		link_adds,
		link_removes,
	};
}

export type MustGetAgentActivityResponse =
	| {
			Activity: {
				activity: Array<RegisterAgentActivity>;
				warrants: Array<WarrantOp>;
			};
	  }
	| {
			IncompleteChain: void;
	  }
	| {
			ChainTopNotFound: ActionHash;
	  }
	| {
			EmptyRange: void;
	  };

export function mustGetAgentActivity(
	state: CellState,
	agent: AgentPubKey,
	filter: ChainFilter,
): MustGetAgentActivityResponse {
	const agentActivity = state.metadata.activity.get(agent) || [];

	const chainTop: SignedActionHashed = state.CAS.get(filter.chain_top);

	if (
		!agentActivity.find(actionHash => areEqual(actionHash, filter.chain_top)) ||
		!chainTop
	) {
		return {
			ChainTopNotFound: filter.chain_top,
		};
	}

	const activity: RegisterAgentActivity[] = [
		{
			action: chainTop,
		},
	];

	const getNextActionHash = () => {
		const firstAction = activity[0].action.hashed.content;

		const prevHash = (firstAction as { prev_action: ActionHash }).prev_action;

		const takeFilters = filter.filters
			.map(f => (f as { Take: number }).Take)
			.filter(n => n !== undefined);
		if (takeFilters.find(n => n >= activity.length)) return undefined;

		const untilFilters = filter.filters
			.map(f => (f as { Until: ActionHash[] }).Until)
			.filter(n => n !== undefined);
		if (untilFilters.find(hashes => hashes.find(h => areEqual(h, prevHash))))
			return undefined;

		const bothFilters = filter.filters
			.map(f => (f as { Both: [number, ActionHash[]] }).Both)
			.filter(n => n !== undefined);
		if (
			bothFilters.find(
				([n, hashes]) =>
					n >= activity.length || hashes.find(h => areEqual(h, prevHash)),
			)
		)
			return undefined;

		return prevHash;
	};

	let nextActionHash: ActionHash | undefined = getNextActionHash();

	while (nextActionHash) {
		const action: SignedActionHashed = state.CAS.get(filter.chain_top);
		if (!action)
			return {
				IncompleteChain: undefined,
			};
		activity.unshift({
			action,
		});
		nextActionHash = getNextActionHash();
	}

	return {
		Activity: {
			activity,
			warrants: [], // TODO: implement warrants
		},
	};
}

export function getAgentActivity(
	state: CellState,
	agent: AgentPubKey,
	filter: ChainQueryFilter, // TODO: use this
	request: ActivityRequest,
): AgentActivity {
	const miscMeta = state.metadata.misc_meta.get(agent);

	const status = (miscMeta as { ChainStatus: ChainStatus }).ChainStatus;

	const activity = state.metadata.activity.get(agent) || [];

	let actions: SignedActionHashed[] = activity.map(actionHash =>
		state.CAS.get(actionHash),
	);

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

	const valid_activity = actions.map(action => {
		const content = action.hashed.content;
		const sequenceNumber = (content as { action_seq: number }).action_seq || 0;

		return [sequenceNumber, action.hashed.hash] as [number, ActionHash];
	});

	const highest_observed: HighestObserved | undefined =
		valid_activity.length > 0
			? {
					hash: [valid_activity[valid_activity.length - 1][1]],
					action_seq: valid_activity.length - 1,
				}
			: undefined;
	return {
		highest_observed,
		rejected_activity: [], // TODO: fix this
		status,
		valid_activity,
		warrants: [], // TODO: fix this
	};
}

export function getCreateLinksForHash(
	state: CellState,
	hash: AnyDhtHash,
	link_type: LinkType,
): LinkMetaVal[] {
	return state.metadata.link_meta
		.filter(
			({ key, value }) =>
				areEqual(key.base, hash) && key.link_type === link_type,
		)
		.map(({ key, value }) => value);
}

export function getRemovesOnLinkAdd(
	state: CellState,
	link_add_hash: ActionHash,
): ActionHash[] {
	const metadata = state.metadata.system_meta.get(link_add_hash);
	if (!metadata) return [];

	const removes: ActionHash[] = [];
	for (const val of metadata) {
		if ((val as { DeleteLink: ActionHash }).DeleteLink) {
			removes.push((val as { DeleteLink: ActionHash }).DeleteLink);
		}
	}
	return removes;
}

export function getLiveLinks(
	getLinksResponses: Array<GetLinksResponse>,
): Array<Link> {
	// Map and flatten adds
	const linkAdds: HoloHashMap<ActionHash, CreateLink | undefined> =
		new HoloHashMap();
	for (const responses of getLinksResponses) {
		for (const linkAdd of responses.link_adds) {
			linkAdds.set(linkAdd.hashed.hash, linkAdd.hashed.content);
		}
	}

	for (const responses of getLinksResponses) {
		for (const linkRemove of responses.link_removes) {
			const removedAddress = linkRemove.hashed.content.link_add_address;

			linkAdds.delete(removedAddress);
		}
	}

	const resultingLinks: Link[] = [];

	for (const [linkHash, liveLink] of Array.from(linkAdds.entries())) {
		if (liveLink)
			resultingLinks.push({
				base: liveLink.base_address,
				target: liveLink.target_address,
				tag: liveLink.tag,
				author: liveLink.author,
				create_link_hash: linkHash,
				link_type: liveLink.link_type,
				timestamp: liveLink.timestamp,
				zome_index: liveLink.zome_index,
			});
	}

	return resultingLinks;
}

export function computeDhtStatus(allActionsForEntry: SignedActionHashed[]): {
	entry_dht_status: EntryDhtStatus;
	rejected_actions: SignedActionHashed[];
} {
	const aliveActions: HoloHashMap<ActionHash, SignedActionHashed | undefined> =
		new HoloHashMap();
	const rejected_actions: SignedActionHashed[] = [];

	for (const action of allActionsForEntry) {
		if (action.hashed.content.type === ActionType.Create) {
			aliveActions.set(action.hashed.hash, action);
		}
	}

	for (const action of allActionsForEntry) {
		if (
			action.hashed.content.type === ActionType.Update ||
			action.hashed.content.type === ActionType.Delete
		) {
			if (aliveActions.has(action.hashed.hash))
				rejected_actions.push(
					aliveActions.get(action.hashed.hash) as SignedActionHashed,
				);
			aliveActions.delete(action.hashed.hash);
		}
	}

	const isSomeActionAlive = Array.from(aliveActions.values()).some(
		action => action !== undefined,
	);

	// TODO: add more cases
	const entry_dht_status = isSomeActionAlive
		? EntryDhtStatus.Live
		: EntryDhtStatus.Dead;

	return {
		entry_dht_status,
		rejected_actions,
	};
}

export function hasDhtOpBeenProcessed(
	state: CellState,
	dhtOpHash: DhtOpHash,
): boolean {
	return (
		state.integrationLimbo.has(dhtOpHash) ||
		state.integratedDHTOps.has(dhtOpHash) ||
		state.validationLimbo.has(dhtOpHash)
	);
}

export function getIntegratedDhtOpsWithoutReceipt(
	state: CellState,
): HoloHashMap<DhtOpHash, IntegratedDhtOpsValue> {
	const needReceipt: HoloHashMap<DhtOpHash, IntegratedDhtOpsValue> =
		new HoloHashMap();

	for (const [dhtOpHash, integratedValue] of state.integratedDHTOps.entries()) {
		if (integratedValue.send_receipt) {
			needReceipt.set(dhtOpHash, integratedValue);
		}
	}
	return needReceipt;
}
