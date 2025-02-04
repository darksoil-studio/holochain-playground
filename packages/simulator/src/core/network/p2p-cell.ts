import {
	AgentPubKey,
	AnyDhtHash,
	CapSecret,
	CellId,
	DhtOp,
	EntryHash,
	LinkType,
	RegisterAgentActivity,
	encodeHashToBase64,
} from '@holochain/client';
import { DhtOpHash } from '@tnesh-stack/core-types';
import { HoloHashMap } from '@tnesh-stack/utils';
import { isEqual } from 'lodash-es';

import { sleep } from '../../executor/delay-middleware.js';
import { MiddlewareExecutor } from '../../executor/middleware-executor.js';
import { areEqual, location } from '../../processors/hash.js';
import { ChainQueryFilter, GetLinksOptions, GetOptions } from '../../types.js';
import {
	GetEntryResponse,
	GetLinksResponse,
	GetRecordResponse,
} from '../cell/cascade/types.js';
import { Cell } from '../cell/cell.js';
import {
	MustGetAgentActivityResponse,
	getSourceChainRecords,
} from '../cell/index.js';
import {
	ActivityRequest,
	AgentActivity,
} from '../hdk/host-fn/get_agent_activity.js';
import { ChainFilter } from '../hdk/host-fn/must_get_agent_activity.js';
import { Connection } from './connection.js';
import { DhtArc } from './dht_arc.js';
import { SimpleBloomMod } from './gossip/bloom/index.js';
import { GossipData } from './gossip/types.js';
import {
	NetworkRequest,
	NetworkRequestInfo,
	NetworkRequestType,
} from './network-request.js';
import { Network } from './network.js';

export type P2pCellState = {
	neighbors: AgentPubKey[];
	farKnownPeers: AgentPubKey[];
	badAgents: AgentPubKey[];
	redundancyFactor: number;
	neighborNumber: number;
};

// From: https://github.com/holochain/holochain/blob/develop/crates/holochain_p2p/src/lib.rs
export class P2pCell {
	farKnownPeers: AgentPubKey[];

	storageArc: DhtArc;

	neighborNumber: number;

	redundancyFactor = 3;

	_gossipLoop!: SimpleBloomMod;

	networkRequestsExecutor = new MiddlewareExecutor<
		NetworkRequestInfo<any, any>
	>();

	neighborConnections: HoloHashMap<AgentPubKey, Connection | undefined> =
		new HoloHashMap();

	constructor(
		state: P2pCellState,
		public cell: Cell,
		protected network: Network,
	) {
		this.farKnownPeers = state.farKnownPeers;
		this.redundancyFactor = state.redundancyFactor;
		this.neighborNumber = state.neighborNumber;

		// TODO: try to connect with already known neighbors

		this.storageArc = {
			center_loc: location(this.cellId[1]),
			half_length: 2 ** 33,
		};
	}

	getState(): P2pCellState {
		return {
			badAgents: this.badAgents,
			neighbors: this.neighbors,
			farKnownPeers: this.farKnownPeers,
			redundancyFactor: this.redundancyFactor,
			neighborNumber: this.neighborNumber,
		};
	}

	get cellId(): CellId {
		return this.cell.cellId;
	}

	get badAgents() {
		if (
			this.cell.conductor.badAgent &&
			this.cell.conductor.badAgent.config.pretend_invalid_records_are_valid
		)
			return [];

		return this.cell._state.badAgents;
	}

	/** P2p actions */
	joining!: Promise<void>;
	joined = false;
	async join(containerCell: Cell): Promise<void> {
		this.joining = new Promise(async resolve => {
			this._gossipLoop = new SimpleBloomMod(this);
			this.network.bootstrapService.announceCell(this.cellId, containerCell);
			await this.syncNeighbors();
			resolve();
		});
		await this.joining;
		this.joined = true;
	}

	async leave(): Promise<void> {
		this.network.bootstrapService.removeCell(this.cellId);
		this._gossipLoop.gossip_on = false;

		for (const peer of Array.from(this.neighborConnections.keys())) {
			if (this.neighborConnections.has(peer)) {
				const connection = this.neighborConnections.get(peer) as Connection;
				connection.close();

				this.neighborConnections.delete(peer);

				connection
					.getPeer(this.cell.agentPubKey)
					.p2p.handleLeave(this.cell.agentPubKey);
			}
		}
	}

	async publish(
		dht_hash: AnyDhtHash,
		ops: HoloHashMap<DhtOpHash, DhtOp>,
	): Promise<void> {
		await this.joining;
		if (this.neighbors.length > 0) {
			// In the case of a failed join by a bad actor,
			// publishing makes the page freeze
			await this.network.kitsune.rpc_multi(
				this.cellId[0],
				this.cellId[1],
				dht_hash,
				this.redundancyFactor,
				this.badAgents,
				(cell: Cell) =>
					this._executeNetworkRequest(
						cell,
						NetworkRequestType.PUBLISH_REQUEST,
						{ dhtOps: ops },
						(cell: Cell) => cell.handle_publish(this.cellId[1], true, ops),
					),
			);
		} else {
			// If we don't have neighbors, at least handle the publish ourselves
			this._executeNetworkRequest(
				this.cell,
				NetworkRequestType.PUBLISH_REQUEST,
				{ dhtOps: ops },
				(cell: Cell) => cell.handle_publish(this.cellId[1], true, ops),
			);
		}
	}

	async get(
		dht_hash: AnyDhtHash,
		options: GetOptions,
	): Promise<GetRecordResponse | GetEntryResponse | undefined> {
		const gets = await this.network.kitsune.rpc_multi(
			this.cellId[0],
			this.cellId[1],
			dht_hash,
			1, // TODO: what about this?
			this.badAgents,
			(cell: Cell) =>
				this._executeNetworkRequest(
					cell,
					NetworkRequestType.GET_REQUEST,
					{ hash: dht_hash, options },
					(cell: Cell) => cell.handle_get(dht_hash, options),
				),
		);

		return gets.find(get => !!get);
	}

	async get_links(
		base_address: EntryHash,
		link_type: LinkType,
		options: GetLinksOptions,
	): Promise<GetLinksResponse[]> {
		return this.network.kitsune.rpc_multi(
			this.cellId[0],
			this.cellId[1],
			base_address,
			1, // TODO: what about this?
			this.badAgents,
			(cell: Cell) =>
				this._executeNetworkRequest(
					cell,
					NetworkRequestType.GET_REQUEST,
					{ hash: base_address, options },
					(cell: Cell) =>
						cell.handle_get_links(base_address, link_type, options),
				),
		);
	}

	async get_agent_activity(
		agent: AgentPubKey,
		query: ChainQueryFilter,
		request: ActivityRequest,
	): Promise<AgentActivity[]> {
		return this.network.kitsune.rpc_multi(
			this.cellId[0],
			this.cellId[1],
			agent,
			1, // TODO: what about this?
			this.badAgents,
			(cell: Cell) =>
				this._executeNetworkRequest(
					cell,
					NetworkRequestType.GET_REQUEST,
					{ agent },
					(cell: Cell) => cell.handle_get_agent_activity(agent, query, request),
				),
		);
	}

	async must_get_agent_activity(
		agent: AgentPubKey,
		filter: ChainFilter,
	): Promise<Array<MustGetAgentActivityResponse>> {
		return this.network.kitsune.rpc_multi(
			this.cellId[0],
			this.cellId[1],
			agent,
			1, // TODO: what about this?
			this.badAgents,
			(cell: Cell) =>
				this._executeNetworkRequest(
					cell,
					NetworkRequestType.GET_REQUEST,
					{ agent },
					(cell: Cell) => cell.handle_must_get_agent_activity(agent, filter),
				),
		);
	}

	async call_remote(
		agent: AgentPubKey,
		zome: string,
		fnName: string,
		cap: CapSecret | undefined,
		payload: any,
	): Promise<any> {
		return this.network.kitsune.rpc_single(
			this.cellId[0],
			this.cellId[1],
			agent,
			(cell: Cell) =>
				this._executeNetworkRequest(
					cell,
					NetworkRequestType.CALL_REMOTE,
					{},
					(cell: Cell) =>
						cell.handle_call_remote(this.cellId[1], zome, fnName, cap, payload),
				),
		);
	}

	/** Neighbor handling */

	public get neighbors(): Array<AgentPubKey> {
		return Array.from(this.neighborConnections.keys());
	}

	async connectWith(peer: Cell): Promise<Connection> {
		if (this.neighborConnections.get(peer.agentPubKey))
			return this.neighborConnections.get(peer.agentPubKey) as Connection;

		return new Connection(this.cell, peer);
	}

	async check_agent_valid(peer: Cell): Promise<void> {
		const peerFirst3Records = getSourceChainRecords(peer._state, 0, 3);

		try {
			await this.cell.handle_check_agent(peerFirst3Records);
		} catch (e) {
			if (!this.cell._state.badAgents.find(a => areEqual(a, peer.agentPubKey)))
				this.cell._state.badAgents.push(peer.agentPubKey);

			// throw new Error('Invalid agent');
		}
	}

	handleOpenNeighborConnection(from: Cell, connection: Connection) {
		this.neighborConnections.set(from.agentPubKey, connection);
	}

	handleLeave(peer: AgentPubKey) {
		if (this.neighborConnections.has(peer)) {
			this.handleCloseNeighborConnection(peer);
		}
		this.farKnownPeers = this.farKnownPeers.filter(
			n => n.toString() !== peer.toString(),
		);
		setTimeout(() => {
			this.syncNeighbors();
		}, 10);
	}

	handleCloseNeighborConnection(peer: AgentPubKey) {
		this.neighborConnections.delete(peer);

		this.syncNeighbors();
	}

	connecting: HoloHashMap<AgentPubKey, Promise<void>> = new HoloHashMap();

	async openNeighborConnection(withPeer: Cell): Promise<Connection> {
		if (!this.neighborConnections.has(withPeer.agentPubKey)) {
			if (this.connecting.has(withPeer.agentPubKey)) {
				await this.connecting.get(withPeer.agentPubKey);
			} else if (withPeer.p2p.connecting.has(this.cellId[1])) {
				await withPeer.p2p.connecting.get(withPeer.agentPubKey);
			} else {
				const connectTask = async () => {
					// Try to connect: can fail due to validation
					await this._executeNetworkRequest(
						withPeer,
						NetworkRequestType.CONNECT,
						{},
						peer => Promise.all([withPeer.p2p.check_agent_valid(this.cell)]),
					);

					const connection = await this.connectWith(withPeer);
					this.neighborConnections.set(withPeer.agentPubKey, connection);

					withPeer.p2p.handleOpenNeighborConnection(this.cell, connection);
				};

				const promise = connectTask();
				this.connecting.set(withPeer.agentPubKey, promise);
				await promise;
				this.connecting.delete(withPeer.agentPubKey);
			}
		}
		return this.neighborConnections.get(withPeer.agentPubKey) as Connection;
	}

	disconnectAndForgetNeighbor(withPeer: AgentPubKey) {
		this.closeNeighborConnection(withPeer);

		this.farKnownPeers = this.farKnownPeers.filter(
			n => n.toString() !== withPeer.toString(),
		);
	}

	closeNeighborConnection(withPeer: AgentPubKey) {
		if (this.neighborConnections.has(withPeer)) {
			const connection = this.neighborConnections.get(withPeer) as Connection;
			connection.close();

			this.neighborConnections.delete(withPeer);

			const peerp2p = connection.getPeer(this.cellId[1]).p2p;
			if (peerp2p) peerp2p.handleCloseNeighborConnection(this.cell.agentPubKey);
		}
	}

	async syncNeighbors() {
		const dnaHash = this.cellId[0];
		const myPubKey = this.cellId[1];

		const badAgents = this.badAgents;

		for (const badAgent of badAgents) {
			if (this.neighborConnections.get(badAgent)) {
				this.disconnectAndForgetNeighbor(badAgent);
			}
		}

		const neighbors = this.network.bootstrapService
			.getNeighborhood(dnaHash, myPubKey, this.neighborNumber, badAgents)
			.filter(cell => !areEqual(cell.agentPubKey, myPubKey))
			.filter(neighbor => {
				const theirNeighborhood = this.network.bootstrapService.getNeighborhood(
					dnaHash,
					neighbor.agentPubKey,
					this.neighborNumber,
					badAgents,
				);
				return theirNeighborhood.find(cell =>
					areEqual(cell.agentPubKey, myPubKey),
				);
			});

		this.farKnownPeers = this.network.bootstrapService
			.getFarKnownPeers(dnaHash, myPubKey, badAgents)
			.map(p => p.agentPubKey)
			.filter(a => !neighbors.find(cell => areEqual(cell.agentPubKey, a)));

		const newNeighbors = neighbors.filter(
			cell => !this.neighbors.find(a => areEqual(a, cell.agentPubKey)),
		);

		const neighborsToForget = this.neighbors.filter(
			n => !neighbors.find(c => areEqual(c.agentPubKey, n)),
		);

		neighborsToForget.forEach(n => this.closeNeighborConnection(n));

		const promises = newNeighbors.map(async neighbor => {
			try {
				if (!neighbor._state.badAgents.find(a => areEqual(a, this.cellId[1])))
					await this.openNeighborConnection(neighbor);
			} catch (e) {
				// Couldn't open connection
			}
		});

		await Promise.all(promises);

		if (
			Array.from(this.neighborConnections.keys()).length <
				this.neighborNumber / 2 &&
			this.network.bootstrapService.cells.agentsForDna(dnaHash).length >
				this.neighborNumber / 2
		) {
			setTimeout(() => this.syncNeighbors(), 400);
		}
	}

	// TODO: fix when sharding is implemented
	shouldWeHold(dhtOpBasis: AnyDhtHash): boolean {
		const neighbors = this.network.bootstrapService.getNeighborhood(
			this.cellId[0],
			dhtOpBasis,
			this.redundancyFactor + 1,
			this.badAgents,
		);

		const index = neighbors.findIndex(cell =>
			areEqual(cell.agentPubKey, this.cellId[1]),
		);

		return index >= 0 && index < this.redundancyFactor;
	}

	/** Gossip */

	public async outgoing_gossip(
		to_agent: AgentPubKey,
		gossips: GossipData,
		warrant: boolean = false,
	): Promise<void> {
		// TODO: remove peer discovery?
		if (!this.network.bootstrapService.cells.get([this.cellId[0], to_agent]))
			return;
		await this.network.kitsune.rpc_single(
			this.cellId[0],
			this.cellId[1],
			to_agent,
			(cell: Cell) =>
				this._executeNetworkRequest(
					cell,
					warrant ? NetworkRequestType.WARRANT : NetworkRequestType.GOSSIP,
					{},
					(cell: Cell) => cell.handle_gossip(this.cellId[1], gossips),
				),
		);
	}

	/** Executors */

	private async _executeNetworkRequest<R, T extends NetworkRequestType, D>(
		toCell: Cell,
		type: T,
		details: D,
		request: NetworkRequest<R>,
	): Promise<R> {
		const networkRequest: NetworkRequestInfo<T, D> = {
			fromAgent: this.cellId[1],
			toAgent: toCell.agentPubKey,
			dnaHash: this.cellId[0],
			type,
			details,
		};
		const connection = await this.connectWith(toCell);

		const result = await this.networkRequestsExecutor.execute(
			() => connection.sendRequest(this.cellId[1], request),
			networkRequest,
		);

		return result;
	}
}
