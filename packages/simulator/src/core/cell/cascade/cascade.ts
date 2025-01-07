import {
	ActionHash,
	AgentPubKey,
	AnyDhtHash,
	Entry,
	EntryHash,
	LinkType,
	NewEntryAction,
	Record,
	SignedActionHashed,
} from '@holochain/client';
import {
	Details,
	DetailsType,
	EntryDetails,
	RecordDetails,
} from '@tnesh-stack/core-types';
import { HashType, getHashType } from '@tnesh-stack/utils';

import { areEqual } from '../../../processors/hash.js';
import { GetLinksOptions, GetOptions, GetStrategy } from '../../../types.js';
import {
	ActivityRequest,
	AgentActivity,
	ChainQueryFilter,
} from '../../hdk/host-fn/get_agent_activity.js';
import { P2pCell } from '../../network/p2p-cell.js';
import { computeDhtStatus, getLiveLinks } from '../dht/get.js';
import { CellState } from '../state.js';
import { GetEntryResponse, GetRecordResponse, Link } from './types.js';

// From https://github.com/holochain/holochain/blob/develop/crates/holochain_cascade/src/lib.rs#L1523

// TODO: refactor Cascade when sqlite gets merged

export class Cascade {
	constructor(
		protected state: CellState,
		protected p2p: P2pCell,
	) {}

	// TODO refactor when sqlite gets merged
	public async retrieve_action(
		hash: ActionHash,
		options: GetOptions,
	): Promise<SignedActionHashed | undefined> {
		if (getHashType(hash) !== HashType.ACTION)
			throw new Error(
				`Trying to retrieve a action with a hash of another type`,
			);

		const isPresent = this.state.CAS.get(hash);

		// TODO only return local if GetOptions::content() is given
		if (isPresent && options.strategy === GetStrategy.Contents) {
			const signed_action = this.state.CAS.get(hash);
			return signed_action;
		}

		const result = await this.p2p.get(hash, options);

		if (result && (result as GetRecordResponse).signed_action) {
			return (result as GetRecordResponse).signed_action;
		} else return undefined;
	}

	public async retrieve_entry(
		hash: EntryHash,
		options: GetOptions,
	): Promise<Entry | undefined> {
		const hashType = getHashType(hash);
		if (hashType !== HashType.ENTRY && hashType !== HashType.AGENT)
			throw new Error(`Trying to retrieve a entry with a hash of another type`);

		const isPresent = this.state.CAS.get(hash);

		if (isPresent && options.strategy === GetStrategy.Contents) {
			const entry = this.state.CAS.get(hash);
			return entry;
		}

		const result = await this.p2p.get(hash, options);

		if (result && (result as GetEntryResponse).entry) {
			return (result as GetEntryResponse).entry;
		} else return undefined;
	}

	public async dht_get(
		hash: AnyDhtHash,
		options: GetOptions,
	): Promise<Record | undefined> {
		// TODO rrDHT arcs
		// const authority = new Authority(this.state, this.p2p);

		const isPresent = this.state.CAS.get(hash);

		// TODO only return local if GetOptions::content() is given
		if (isPresent && options.strategy === GetStrategy.Contents) {
			const hashType = getHashType(hash);

			if (hashType === HashType.ENTRY) {
				const entry = this.state.CAS.get(hash);
				const signed_action = Array.from(this.state.CAS.values()).find(
					action =>
						(action as SignedActionHashed).hashed &&
						areEqual(
							(action as SignedActionHashed<NewEntryAction>).hashed.content
								.entry_hash,
							hash,
						),
				);

				return {
					entry,
					signed_action,
				};
			}

			if (hashType === HashType.ACTION) {
				const signed_action = this.state.CAS.get(hash);
				const { entry_hash } = (
					signed_action as SignedActionHashed<NewEntryAction>
				).hashed.content;

				const entry = entry_hash ? this.state.CAS.get(entry_hash) : undefined;
				return {
					entry,
					signed_action,
				};
			}
		}

		const result = await this.p2p.get(hash, options);

		if (!result) return undefined;

		if ((result as GetRecordResponse).signed_action) {
			const maybe_entry = (result as GetRecordResponse).maybe_entry;
			if (maybe_entry)
				return {
					entry: {
						Present: maybe_entry,
					},
					signed_action: (result as GetRecordResponse).signed_action,
				};
			return {
				entry: {
					NotStored: undefined,
				},
				signed_action: (result as GetRecordResponse).signed_action,
			};
		} else {
			return {
				signed_action: (result as GetEntryResponse).live_actions[0],
				entry: {
					Present: (result as GetEntryResponse).entry,
				},
			};
		}
	}

	public async dht_get_details(
		hash: AnyDhtHash,
		options: GetOptions,
	): Promise<Details | undefined> {
		if (getHashType(hash) === HashType.ENTRY) {
			const entryDetails = await this.getEntryDetails(hash, options);

			if (!entryDetails) return undefined;

			return {
				type: DetailsType.Entry,
				content: entryDetails,
			};
		} else if (getHashType(hash) === HashType.ACTION) {
			const recordDetails = await this.getActionDetails(hash, options);

			if (!recordDetails) return undefined;

			return {
				type: DetailsType.Record,
				content: recordDetails,
			};
		}

		return undefined;
	}

	public async dht_get_links(
		base_address: EntryHash,
		link_type: LinkType,
		options: GetLinksOptions,
	): Promise<Link[]> {
		// TODO: check if we are an authority

		const linksResponses = await this.p2p.get_links(
			base_address,
			link_type,
			options,
		);
		return getLiveLinks(linksResponses);
	}

	public async dht_get_agent_activity(
		agent: AgentPubKey,
		query: ChainQueryFilter,
		request: ActivityRequest,
	): Promise<AgentActivity> {
		const activities = await this.p2p.get_agent_activity(agent, query, request);
		// TODO: merge agent activities
		return activities[0];
	}

	async getEntryDetails(
		entryHash: EntryHash,
		options: GetOptions,
	): Promise<EntryDetails | undefined> {
		// TODO: check if we are an authority
		const result = await this.p2p.get(entryHash, options);

		if (!result) return undefined;
		if ((result as GetEntryResponse).live_actions === undefined)
			throw new Error('Unreachable');

		const getEntryFull = result as GetEntryResponse;

		const allActions = [
			...getEntryFull.deletes,
			...getEntryFull.updates,
			...getEntryFull.live_actions,
		];

		const { rejected_actions, entry_dht_status } = computeDhtStatus(allActions);

		return {
			entry: getEntryFull.entry,
			actions: getEntryFull.live_actions,
			deletes: getEntryFull.deletes,
			updates: getEntryFull.updates,
			rejected_actions,
			entry_dht_status,
		};
	}

	async getActionDetails(
		actionHash: ActionHash,
		options: GetOptions,
	): Promise<RecordDetails | undefined> {
		const result = await this.p2p.get(actionHash, options);

		if (!result) return undefined;
		if ((result as GetRecordResponse).validation_status === undefined)
			throw new Error('Unreachable');

		const response = result as GetRecordResponse;

		const record: Record = {
			entry: response.maybe_entry
				? {
						Present: response.maybe_entry,
					}
				: {
						NotApplicable: undefined,
					},
			signed_action: response.signed_action,
		};

		return {
			record,
			deletes: response.deletes,
			updates: response.updates,
			validation_status: response.validation_status,
		};
	}
}
