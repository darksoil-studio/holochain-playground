import {
	ActionHash,
	AgentPubKey,
	Create,
	Delete,
	Entry,
	EntryHash,
	EntryType,
	LinkType,
	NewEntryAction,
	SignedActionHashed,
	Update,
} from '@holochain/client';

import { GetLinksOptions, GetOptions } from '../../../types.js';
import {
	ActivityRequest,
	AgentActivity,
	ChainQueryFilter,
} from '../../hdk/host-fn/get_agent_activity.js';
import { P2pCell } from '../../network/p2p-cell.js';
import {
	getActionModifiers,
	getActionsForEntry,
	getAgentActivity,
	getEntryDetails,
	getLinksForHash,
} from '../dht/get.js';
import { CellState, ValidationStatus } from '../state.js';
import {
	GetEntryResponse,
	GetLinksResponse,
	GetRecordResponse,
} from './types.js';

// From https://github.com/holochain/holochain/blob/develop/crates/holochain_cascade/src/authority.rs
export class Authority {
	constructor(
		protected state: CellState,
		protected p2p: P2pCell,
	) {}

	public async handle_get_entry(
		entry_hash: EntryHash,
		options: GetOptions,
	): Promise<GetEntryResponse | undefined> {
		const entry = this.state.CAS.get(entry_hash);
		if (!entry) return undefined;

		const allActions = getActionsForEntry(this.state, entry_hash);

		const entryDetails = getEntryDetails(this.state, entry_hash);

		const createAction = allActions.find(
			action => (action.hashed.content as Create).entry_type,
		);
		let entry_type: EntryType | undefined = undefined;
		if (createAction)
			entry_type = (createAction.hashed.content as Create).entry_type;

		return {
			entry,
			entry_type: entry_type as EntryType,
			deletes: entryDetails.deletes as SignedActionHashed<Delete>[],
			updates: entryDetails.updates as SignedActionHashed<Update>[],
			actions: entryDetails.actions as SignedActionHashed<Create>[],
		};
	}

	public async handle_get_record(
		action_hash: ActionHash,
		options: GetOptions,
	): Promise<GetRecordResponse | undefined> {
		if (this.state.metadata.misc_meta.get(action_hash) !== 'StoreRecord') {
			return undefined;
		}

		const action = this.state.CAS.get(action_hash) as SignedActionHashed;
		let maybe_entry: Entry | undefined = undefined;
		let validation_status: ValidationStatus = ValidationStatus.Valid;

		if (action) {
			if (
				(action as SignedActionHashed<NewEntryAction>).hashed.content.entry_hash
			) {
				const entryHash = (action as SignedActionHashed<NewEntryAction>).hashed
					.content.entry_hash;
				maybe_entry = this.state.CAS.get(entryHash);
			}
		} else {
			validation_status = ValidationStatus.Rejected;
		}

		const modifiers = getActionModifiers(this.state, action_hash);

		return {
			deletes: modifiers.deletes,
			updates: modifiers.updates,
			signed_action: action,
			validation_status,
			maybe_entry,
		};
	}

	public async handle_get_links(
		base_address: EntryHash,
		link_type: LinkType,
		options: GetLinksOptions,
	): Promise<GetLinksResponse> {
		return getLinksForHash(this.state, base_address, link_type);
	}

	public async handle_get_agent_activity(
		agent: AgentPubKey,
		query: ChainQueryFilter,
		request: ActivityRequest,
	): Promise<AgentActivity> {
		return getAgentActivity(this.state, agent, query, request);
	}
}
