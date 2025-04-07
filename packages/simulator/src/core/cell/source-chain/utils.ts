import {
	ActionHash,
	ActionType,
	AgentPubKey,
	AppEntryDef,
	CapSecret,
	CellId,
	Delete,
	DhtOp,
	Dna,
	DnaHash,
	Entry,
	EntryType,
	GrantedFunctionsType,
	NewEntryAction,
	Record,
	RecordEntry,
	SignedActionHashed,
	Update,
	ZomeCallCapGrant,
} from '@holochain/client';
import { DhtOpHash } from '@tnesh-stack/core-types';
import { HoloHashMap } from '@tnesh-stack/utils';

import { areEqual } from '../../../processors/hash.js';
import { CellState } from '../state.js';
import { getAllAuthoredActions } from './get.js';

export function getTipOfChain(cellState: CellState): ActionHash {
	return cellState.sourceChain[cellState.sourceChain.length - 1];
}

export function getAuthor(cellState: CellState): AgentPubKey {
	return getActionAt(cellState, 0).hashed.content.author;
}

export function getDnaHash(state: CellState): DnaHash {
	const firstActionHash = state.sourceChain[0];

	const dna: SignedActionHashed<Dna> = state.CAS.get(firstActionHash);
	return dna.hashed.content.hash;
}

export function getActionAt(
	cellState: CellState,
	index: number,
): SignedActionHashed {
	const actionHash = cellState.sourceChain[index];
	return cellState.CAS.get(actionHash);
}

export function getNextActionSeq(cellState: CellState): number {
	return cellState.sourceChain.length;
}
export function isPublic(entry_type: EntryType): boolean {
	return (
		entry_type === 'Agent' ||
		(typeof entry_type === 'object' &&
			'App' in (entry_type as any) &&
			'Public' === ((entry_type as any).App as AppEntryDef).visibility)
	);
}

export function getRecord(state: CellState, actionHash: ActionHash): Record {
	const signed_action: SignedActionHashed = state.CAS.get(actionHash);

	let entry: RecordEntry;
	if (
		signed_action.hashed.content.type == ActionType.Create ||
		signed_action.hashed.content.type == ActionType.Update
	) {
		const entry_type = signed_action.hashed.content.entry_type;
		if (isPublic(entry_type)) {
			entry = {
				Present: state.CAS.get(signed_action.hashed.content.entry_hash),
			};
		} else {
			entry = {
				Hidden: undefined,
			};
		}
	} else {
		entry = {
			NotApplicable: undefined,
		};
	}
	return { signed_action, entry };
}

export function getCellId(state: CellState): CellId {
	const author = getAuthor(state);
	const dna = getDnaHash(state);
	return [dna, author];
}

export function getNonPublishedDhtOps(
	state: CellState,
): HoloHashMap<DhtOpHash, DhtOp> {
	const nonPublishedDhtOps: HoloHashMap<DhtOpHash, DhtOp> = new HoloHashMap();
	for (const dhtOpHash of state.authoredDHTOps.keys()) {
		const authoredValue = state.authoredDHTOps.get(dhtOpHash);
		if (authoredValue.last_publish_time === undefined) {
			nonPublishedDhtOps.set(dhtOpHash, authoredValue.op);
		}
	}

	return nonPublishedDhtOps;
}

export function valid_cap_grant(
	state: CellState,
	zome: string,
	fnName: string,
	provenance: AgentPubKey,
	secret: CapSecret | undefined,
): boolean {
	if (areEqual(provenance, getCellId(state)[1])) return true;

	const aliveCapGrantsActions: HoloHashMap<
		ActionHash,
		SignedActionHashed<NewEntryAction>
	> = new HoloHashMap();

	const allActions = getAllAuthoredActions(state);

	for (const action of allActions) {
		if (isCapGrant(action)) {
			aliveCapGrantsActions.set(
				action.hashed.hash,
				action as SignedActionHashed<NewEntryAction>,
			);
		}
	}

	for (const action of allActions) {
		const actionContent = action.hashed.content;
		if (
			(actionContent as Update).original_action_address &&
			aliveCapGrantsActions.has(
				(actionContent as Update).original_action_address,
			)
		) {
			aliveCapGrantsActions.delete(
				(actionContent as Update).original_action_address,
			);
		}
		if (
			(actionContent as Delete).deletes_address &&
			aliveCapGrantsActions.has((actionContent as Delete).deletes_address)
		) {
			aliveCapGrantsActions.delete((actionContent as Delete).deletes_address);
		}
	}

	const aliveCapGrants: Array<ZomeCallCapGrant> = Array.from(
		aliveCapGrantsActions.values(),
	).map(
		sah =>
			(state.CAS.get(sah.hashed.content.entry_hash) as Entry)
				.entry as ZomeCallCapGrant,
	);

	return !!aliveCapGrants.find(capGrant =>
		isCapGrantValid(capGrant, zome, fnName, provenance, secret),
	);
}

function isCapGrantValid(
	capGrant: ZomeCallCapGrant,
	zome: string,
	fnName: string,
	check_agent: AgentPubKey,
	check_secret: CapSecret | undefined,
): boolean {
	if (capGrant.functions.type === 'all') return true;

	if (
		!capGrant.functions.value.find(
			([zome_name, fn_name]) => fn_name === fnName && zome_name === zome,
		)
	)
		return false;

	if (capGrant.access.type === 'assigned') {
		return !!capGrant.access.value.assignees.find(a =>
			areEqual(a, check_agent),
		);
	} else if (capGrant.access.type === 'transferable') {
		return capGrant.access.value.secret === check_secret;
	} else {
		return true;
	}
}

function isCapGrant(action: SignedActionHashed): boolean {
	const content = action.hashed.content;
	return !!(
		(content as NewEntryAction).entry_hash &&
		(content as NewEntryAction).entry_type === 'CapGrant'
	);
}
