import {
	ActionHash,
	AgentPubKey,
	AnyDhtHash,
	Entry,
	EntryHash,
	Link,
	LinkType,
	NewEntryAction,
	Record,
	RegisterAgentActivity,
	SignedActionHashed,
	WarrantOp,
} from '@holochain/client';
import {
	Details,
	DetailsType,
	EntryDetails,
	RecordDetails,
} from '@darksoil-studio/holochain-core-types';
import { HashType, HoloHashMap, getHashType } from '@darksoil-studio/holochain-utils';

import { areEqual } from '../../../processors/hash.js';
import {
	ChainQueryFilter,
	GetLinksOptions,
	GetOptions,
	GetStrategy,
} from '../../../types.js';
import {
	ActivityRequest,
	AgentActivity,
} from '../../hdk/host-fn/get_agent_activity.js';
import { LinkDetails } from '../../hdk/host-fn/get_link_details.js';
import { ChainFilter } from '../../hdk/host-fn/must_get_agent_activity.js';
import { P2pCell } from '../../network/p2p-cell.js';
import { computeDhtStatus, getLiveLinks } from '../dht/get.js';
import { CellState } from '../state.js';
import { GetEntryResponse, GetRecordResponse } from './types.js';

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
			const response = result as GetEntryResponse;
			const liveActions = response.actions.filter(
				a =>
					!response.deletes.find(d =>
						areEqual(a.hashed.hash, d.hashed.content.deletes_address),
					),
			);
			if (liveActions.length === 0) return undefined;
			const oldestLiveAction = liveActions.sort(
				(a1, a2) => a1.hashed.content.timestamp - a2.hashed.content.timestamp,
			)[0];
			return {
				signed_action: oldestLiveAction,
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
		base_address: AnyDhtHash,
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

	public async dht_get_link_details(
		base_address: AnyDhtHash,
		link_type: LinkType,
		options: GetLinksOptions,
	): Promise<LinkDetails> {
		// TODO: check if we are an authority

		const linksResponses = await this.p2p.get_links(
			base_address,
			link_type,
			options,
		);
		const createLinks = new HoloHashMap<
			ActionHash,
			{ create: SignedActionHashed; deletes: Array<SignedActionHashed> }
		>();

		for (const response of linksResponses) {
			for (const linkAdd of response.link_adds) {
				if (!createLinks.has(linkAdd.hashed.hash)) {
					createLinks.set(linkAdd.hashed.hash, {
						create: linkAdd,
						deletes: [],
					});
				}
			}
		}

		for (const response of linksResponses) {
			for (const linkDelete of response.link_removes) {
				const linkAddHash = linkDelete.hashed.content.link_add_address;
				const existing = createLinks.get(linkAddHash);
				if (existing) {
					createLinks.set(linkAddHash, {
						create: existing.create,
						deletes: [...existing.deletes, linkDelete],
					});
				}
			}
		}

		return Array.from(createLinks.values()).map(({ create, deletes }) => [
			create,
			deletes,
		]);
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

	public async dht_must_get_agent_activity(
		agent: AgentPubKey,
		filter: ChainFilter,
	): Promise<Array<RegisterAgentActivity>> {
		const activities = await this.p2p.must_get_agent_activity(agent, filter);
		const succesful = activities.find(
			a =>
				(
					a as {
						Activity: {
							activity: RegisterAgentActivity[];
							warrants: WarrantOp[];
						};
					}
				).Activity,
		);
		if (succesful) {
			return (
				succesful as {
					Activity: {
						activity: RegisterAgentActivity[];
						warrants: WarrantOp[];
					};
				}
			).Activity.activity;
		}
		throw new Error(
			`Error getting agent activity: ${Object.keys(activities[0])[0]}`,
		);
	}

	async getEntryDetails(
		entryHash: EntryHash,
		options: GetOptions,
	): Promise<EntryDetails | undefined> {
		// TODO: check if we are an authority
		const result = await this.p2p.get(entryHash, options);

		if (!result) return undefined;
		if ((result as GetEntryResponse).actions === undefined)
			throw new Error('Unreachable');

		const getEntryFull = result as GetEntryResponse;

		const allActions = [
			...getEntryFull.deletes,
			...getEntryFull.updates,
			...getEntryFull.actions,
		];

		const { rejected_actions, entry_dht_status } = computeDhtStatus(allActions);

		return {
			entry: getEntryFull.entry,
			actions: getEntryFull.actions,
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
