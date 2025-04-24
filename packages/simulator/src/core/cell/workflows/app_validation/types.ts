import {
	AnyDhtHash,
	ChainOp,
	ChainOpType,
	CreateLink,
	Delete,
	DeleteLink,
	Entry,
	NewEntryAction,
	Record,
	RecordEntry,
	SignedActionHashed,
	Update,
	encodeHashToBase64,
} from '@holochain/client';
import { hashAction } from '@darksoil-studio/holochain-utils';

import { isPublic } from '../../source-chain/utils';
import { getDhtOpAction, getDhtOpSignature, getEntry } from '../../utils';

export class MissingDependenciesError extends Error {
	constructor(public missingDepsHashes: AnyDhtHash[]) {
		super(
			`Missing depencencies: ${missingDepsHashes.map(encodeHashToBase64).join(',')}`,
		);
	}
}
export function chainOpToRecord(op: ChainOp): Record {
	const action = getDhtOpAction(op);
	const actionHash = hashAction(action);
	let entry: RecordEntry = {
		NotApplicable: undefined,
	};
	if ((action as NewEntryAction).entry_hash) {
		const e = getEntry({ ChainOp: op });
		const publicEntryType = isPublic((action as NewEntryAction).entry_type);
		entry = e
			? {
					Present: e,
				}
			: publicEntryType
				? {
						NotStored: undefined,
					}
				: {
						Hidden: undefined,
					};
	}

	return {
		entry,
		signed_action: {
			hashed: {
				content: action,
				hash: actionHash,
			},
			signature: getDhtOpSignature(op),
		},
	};
}

export type Op =
	| {
			StoreRecord: StoreRecord;
	  }
	| {
			StoreEntry: StoreEntry;
	  }
	| {
			RegisterUpdate: RegisterUpdate;
	  }
	| {
			RegisterDelete: RegisterDelete;
	  }
	| {
			RegisterAgentActivity: RegisterAgentActivity;
	  }
	| {
			RegisterCreateLink: RegisterCreateLink;
	  }
	| {
			RegisterDeleteLink: RegisterDeleteLink;
	  };
export interface StoreRecord {
	record: Record;
}
export interface StoreEntry {
	action: SignedActionHashed<NewEntryAction>;
	entry: Entry;
}

export interface RegisterUpdate {
	update: SignedActionHashed<Update>;
	new_entry: Entry | undefined;
}

export interface RegisterDelete {
	delete: SignedActionHashed<Delete>;
}

export interface RegisterAgentActivity {
	action: SignedActionHashed;
	cached_entry: Entry | undefined;
}
export interface RegisterCreateLink {
	create_link: SignedActionHashed<CreateLink>;
}
export interface RegisterDeleteLink {
	delete_link: SignedActionHashed<DeleteLink>;
	create_link: CreateLink;
}
