import {
	Action,
	ActionHash,
	ActionType,
	AgentPubKey,
	AgentValidationPkg,
	AnyLinkableHash,
	Create,
	CreateLink,
	Delete,
	DeleteLink,
	Dna,
	DnaHash,
	Entry,
	EntryHash,
	EntryType,
	LinkType,
	SignedActionHashed,
	Timestamp,
	Update,
} from '@holochain/client';
import { hashAction } from '@darksoil-studio/holochain-utils';

import { CellState } from '../state.js';
import { hashEntry } from '../utils.js';
import { getAuthor, getNextActionSeq, getTipOfChain } from './utils.js';

export function buildShh(action: Action): SignedActionHashed {
	return {
		hashed: {
			content: action,
			hash: hashAction(action),
		},
		signature: Uint8Array.from([]),
	};
}

export function buildDna(dnaHash: DnaHash, agentId: AgentPubKey): Dna {
	const dna: Dna = {
		author: agentId,
		hash: dnaHash,
		timestamp: Date.now() * 1000,
		type: ActionType.Dna,
	};

	return dna;
}

export function buildAgentValidationPkg(
	state: CellState,
	membrane_proof: any,
): AgentValidationPkg {
	const pkg: AgentValidationPkg = {
		...buildCommon(state),
		membrane_proof,
		type: ActionType.AgentValidationPkg,
	};
	return pkg;
}

export function buildCreate(
	state: CellState,
	entry: Entry,
	entry_type: EntryType,
): Create {
	const entry_hash = hashEntry(entry);
	const create = {
		...buildCommon(state),
		entry_hash,
		entry_type,
		type: ActionType.Create,
		weight: {
			bucket_id: 0,
			units: 0,
			rate_bytes: 0,
		},
	} as Create;
	return create;
}

export function buildCreateLink(
	state: CellState,
	zome_index: number,
	base: AnyLinkableHash,
	target: AnyLinkableHash,
	link_type: LinkType,
	tag: any,
): CreateLink {
	const create_link: CreateLink = {
		...buildCommon(state),
		base_address: base,
		target_address: target,
		tag,
		zome_index,
		link_type,
		type: ActionType.CreateLink,
		weight: {
			bucket_id: 0,
			units: 0,
		},
	};
	return create_link;
}

export function buildUpdate(
	state: CellState,
	entry: Entry,
	entry_type: EntryType,
	original_entry_address: EntryHash,
	original_action_address: ActionHash,
): Update {
	const entry_hash = hashEntry(entry);

	const update: Update = {
		...buildCommon(state),
		entry_hash,
		entry_type,
		original_entry_address,
		original_action_address,

		type: ActionType.Update,
		weight: {
			bucket_id: 0,
			units: 0,
			rate_bytes: 0,
		},
	} as Update;
	return update;
}

export function buildDelete(
	state: CellState,
	deletes_address: ActionHash,
	deletes_entry_address: EntryHash,
): Delete {
	const deleteAction = {
		...buildCommon(state),
		type: ActionType.Delete,
		deletes_address,
		deletes_entry_address,
		weight: {
			bucket_id: 0,
			units: 0,
		},
	} as Delete;
	return deleteAction;
}

export function buildDeleteLink(
	state: CellState,
	base_address: EntryHash,
	link_add_address: ActionHash,
): DeleteLink {
	const deleteAction: DeleteLink = {
		...buildCommon(state),
		type: ActionType.DeleteLink,
		base_address,
		link_add_address,
	};
	return deleteAction;
}

export type MigrationTarget =
	| {
			type: 'Dna';
			content: DnaHash;
	  }
	| {
			type: 'Agent';
			content: AgentPubKey;
	  };
export interface OpenChain {
	type: ActionType.OpenChain;
	author: AgentPubKey;
	timestamp: Timestamp;
	action_seq: number;
	prev_action: ActionHash;
	prev_target: MigrationTarget;
	close_hash: ActionHash;
}

export function buildOpenChain(
	state: CellState,
	prev_target: MigrationTarget,
	close_hash: ActionHash,
): OpenChain {
	const open_chain: OpenChain = {
		type: ActionType.OpenChain,
		...buildCommon(state),
		prev_target,
		close_hash,
	};
	return open_chain;
}

export interface CloseChain {
	type: ActionType.CloseChain;
	author: AgentPubKey;
	timestamp: Timestamp;
	action_seq: number;
	prev_action: ActionHash;
	new_target: MigrationTarget;
}

export function buildCloseChain(
	state: CellState,
	new_target: MigrationTarget,
): CloseChain {
	const close_chain: CloseChain = {
		type: ActionType.CloseChain,
		...buildCommon(state),
		new_target,
	};
	return close_chain;
}

/** Helpers */

function buildCommon(state: CellState) {
	const author = getAuthor(state);
	const action_seq = getNextActionSeq(state);
	const prev_action = getTipOfChain(state);
	const timestamp = Date.now() * 1000;

	return {
		author,
		action_seq,
		prev_action,
		timestamp,
	};
}
