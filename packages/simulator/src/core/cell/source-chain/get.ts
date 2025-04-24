import {
	ActionHash,
	ChainOp,
	NewEntryAction,
	Record,
	SignedActionHashed,
} from '@holochain/client';
import { HashType, hash, hashAction } from '@darksoil-studio/holochain-utils';

import { areEqual } from '../../../processors/hash.js';
import { CellState } from '../state.js';
import { getDhtOpAction, isWarrantOp } from '../utils.js';

/**
 * Returns the action hashes which don't have their DHTOps in the authoredDHTOps DB
 */
export function getNewActions(state: CellState): Array<ActionHash> {
	const dhtOps = Array.from(state.authoredDHTOps.values());
	const actionHashesAlreadyPublished = dhtOps
		.filter(value => !isWarrantOp(value.op))
		.map(value => (value.op as { ChainOp: ChainOp }).ChainOp)
		.map(dhtOp => hashAction(getDhtOpAction(dhtOp)));

	return state.sourceChain.filter(
		actionHash =>
			!actionHashesAlreadyPublished.find(h => areEqual(h, actionHash)),
	);
}

export function getAllAuthoredActions(
	state: CellState,
): Array<SignedActionHashed> {
	return state.sourceChain.map(actionHash => state.CAS.get(actionHash));
}

export function getSourceChainRecords(
	state: CellState,
	fromIndex: number,
	toIndex: number,
): Record[] {
	const elements: Record[] = [];

	for (let i = fromIndex; i < toIndex; i++) {
		const element = getSourceChainRecord(state, i);
		if (element) elements.push(element);
	}

	return elements;
}

export function getSourceChainRecord(
	state: CellState,
	index: number,
): Record | undefined {
	const actionHash = state.sourceChain[index];
	const signed_action: SignedActionHashed = state.CAS.get(actionHash);

	let entry = undefined;
	const entryHash = (signed_action.hashed.content as NewEntryAction).entry_hash;
	if (entryHash) {
		entry = state.CAS.get(entryHash);
	}

	return {
		entry,
		signed_action,
	};
}
