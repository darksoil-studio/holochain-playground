import {
	AgentPubKey,
	AnyDhtHash,
	CapSecret,
	CellId,
	DhtOp,
	EntryHash,
	LinkType,
} from '@holochain/client';
import { DhtOpHash } from '@tnesh-stack/core-types';
import { HoloHashMap } from '@tnesh-stack/utils';
import { isEqual } from 'lodash-es';

import { MiddlewareExecutor } from '../../executor/middleware-executor.js';
import { areEqual, location } from '../../processors/hash.js';
import { GetLinksOptions, GetOptions } from '../../types.js';
import {
	GetEntryResponse,
	GetLinksResponse,
	GetRecordResponse,
} from '../cell/cascade/types.js';
import { Cell } from '../cell/cell.js';
import { getSourceChainRecords } from '../cell/index.js';
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

	async join(containerCell: Cell): Promise<void> {
		this.network.bootstrapService.announceCell(this.cellId, containerCell);
		this._gossipLoop = new SimpleBloomMod(this);

		await this.syncNeighbors();
	}

	async leave(): Promise<void> {}

	async publish(
		dht_hash: AnyDhtHash,
		ops: HoloHashMap<DhtOpHash, DhtOp>,
	): Promise<void> {
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

			throw new Error('Invalid agent');
		}
	}

	handleOpenNeighborConnection(from: Cell, connection: Connection) {
		this.neighborConnections.set(from.agentPubKey, connection);
	}

	handleCloseNeighborConnection(from: Cell) {
		this.neighborConnections.delete(from.agentPubKey);

		this.syncNeighbors();
	}

	async openNeighborConnection(withPeer: Cell): Promise<Connection> {
		if (!this.neighborConnections.has(withPeer.agentPubKey)) {
			// Try to connect: can fail due to validation
			// TODO: uncomment
			/*       await this._executeNetworkRequest(
        withPeer,
        NetworkRequestType.CONNECT,
        {},
        peer =>
          Promise.all([
            this.check_agent_valid(withPeer),
            withPeer.p2p.check_agent_valid(this.cell),
          ])
      );
 */
			const connection = await this.connectWith(withPeer);
			this.neighborConnections.set(withPeer.agentPubKey, connection);

			withPeer.p2p.handleOpenNeighborConnection(this.cell, connection);
		}
		return this.neighborConnections.get(withPeer.agentPubKey) as Connection;
	}

	closeNeighborConnection(withPeer: AgentPubKey) {
		if (this.neighborConnections.has(withPeer)) {
			const connection = this.neighborConnections.get(withPeer) as Connection;
			connection.close();

			this.neighborConnections.delete(withPeer);

			connection
				.getPeer(this.cellId[1])
				.p2p.handleCloseNeighborConnection(this.cell);
		}
	}

	async syncNeighbors() {
		const dnaHash = this.cellId[0];
		const myPubKey = this.cellId[1];

		const badAgents = this.badAgents;

		for (const badAgent of badAgents) {
			if (this.neighborConnections.get(badAgent)) {
				this.closeNeighborConnection(badAgent);
			}
		}

		this.farKnownPeers = this.network.bootstrapService
			.getFarKnownPeers(dnaHash, myPubKey, badAgents)
			.map(p => p.agentPubKey);

		const neighbors = this.network.bootstrapService
			.getNeighborhood(dnaHash, myPubKey, this.neighborNumber, badAgents)
			.filter(cell => !isEqual(cell.agentPubKey, myPubKey));

		const newNeighbors = neighbors.filter(
			cell => !this.neighbors.find(a => areEqual(a, cell.agentPubKey)),
		);

		const neighborsToForget = this.neighbors.filter(
			n => !neighbors.find(c => areEqual(c.agentPubKey, n)),
		);

		neighborsToForget.forEach(n => this.closeNeighborConnection(n));

		const promises = newNeighbors.map(async neighbor => {
			try {
				await this.openNeighborConnection(neighbor);
			} catch (e) {
				// Couldn't open connection
			}
		});

		await Promise.all(promises);

		if (
			Array.from(this.neighborConnections.keys()).length < this.neighborNumber
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
