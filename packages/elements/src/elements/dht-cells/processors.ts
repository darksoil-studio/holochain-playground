import {
	BadAgent,
	Cell,
	getDhtOpAction,
	getDhtOpType,
	isWarrantOp,
	location,
} from '@holochain-playground/simulator';
import {
	ActionHash,
	AgentPubKey,
	CellId,
	ChainOp,
	ChainOpType,
	DhtOp,
	EntryHash,
	NewEntryAction,
	encodeHashToBase64,
} from '@holochain/client';
import {
	CellMap,
	HashType,
	HoloHashMap,
	hash,
	hashAction,
} from '@tnesh-stack/utils';
import isEqual from 'lodash-es/isEqual.js';

import { CellStore } from '../../store/playground-store.js';
import { SimulatedCellStore } from '../../store/simulated-playground-store.js';

export function dhtCellsNodes(
	cells: CellMap<CellStore>,
	badAgents?: CellMap<BadAgent | undefined>,
) {
	const sortedCells = cells
		.entries()
		.sort(
			(a: [CellId, CellStore], b: [CellId, CellStore]) =>
				location(a[0][1]) - location(b[0][1]),
		);
	const cellNodes = sortedCells.map(([cellId, cellStore]) => {
		const simulated = cellStore instanceof SimulatedCellStore;
		const label = simulated
			? `${(cellStore as SimulatedCellStore).conductorStore.name}${
					badAgents?.has(cellId) ? '😈' : ''
				}`
			: `${encodeHashToBase64(cellId[1]).slice(0, 7)}...`;

		return {
			data: {
				id: encodeHashToBase64(cellId[1]),
				label,
			},
			classes: ['cell'],
		};
	});
	return cellNodes;
}

export function simulatedNeighbors(
	cells: CellMap<CellStore>,
	peers: CellMap<AgentPubKey[]>,
	farPeers: CellMap<AgentPubKey[]>,
	badAgents: CellMap<AgentPubKey[]>,
) {
	const normalEdges = allPeersEdges(cells, peers);

	// Add the far peers

	for (const [cellId, info] of farPeers.entries()) {
		for (const farPeer of info) {
			if (doTheyHaveBeef(badAgents, cellId, farPeer)) {
				continue;
			}
			if (!cells.has([cellId[0], farPeer])) {
				continue;
			}
			const pubKey = encodeHashToBase64(cellId[1]);
			normalEdges.push({
				data: {
					id: `${pubKey}->${encodeHashToBase64(farPeer)}`,
					source: pubKey,
					target: encodeHashToBase64(farPeer),
				},
				classes: ['far-neighbor-edge'],
			});
		}
	}

	return normalEdges;
}

export function allPeersEdges(
	cells: CellMap<CellStore>,
	cellsNeighbors: CellMap<Array<AgentPubKey>>,
) {
	// Segmented by originAgentPubKey/targetAgentPubKey
	const visited: HoloHashMap<
		AgentPubKey,
		HoloHashMap<AgentPubKey, boolean>
	> = new HoloHashMap();
	const edges: Array<any> = [];

	const neighborsNotConnected = new CellMap<boolean>();

	for (const [cellId, neighbors] of cellsNeighbors.entries()) {
		const cellAgentPubKey = cellId[1];

		visited.set(cellAgentPubKey, new HoloHashMap());

		for (const cellNeighbor of neighbors) {
			if (
				!(
					visited.has(cellNeighbor) &&
					visited.get(cellNeighbor).has(cellAgentPubKey)
				)
			) {
				const neighborNeighbors = cellsNeighbors.get([cellId[0], cellNeighbor]);
				if (
					neighborNeighbors?.find(
						n => encodeHashToBase64(n) === encodeHashToBase64(cellAgentPubKey),
					)
				) {
					edges.push({
						data: {
							id: `${encodeHashToBase64(cellAgentPubKey)}->${encodeHashToBase64(
								cellNeighbor,
							)}`,
							source: encodeHashToBase64(cellAgentPubKey),
							target: encodeHashToBase64(cellNeighbor),
						},
						classes: ['neighbor-edge'],
					});
				}

				if (!cells.has([cellId[0], cellNeighbor])) {
					neighborsNotConnected.set([cellId[0], cellNeighbor], true);
				}
			}

			visited.get(cellAgentPubKey).set(cellNeighbor, true);
		}
	}

	for (const [cellId, _] of neighborsNotConnected.entries()) {
		edges.push({
			data: {
				id: encodeHashToBase64(cellId[1]),
				label: `${encodeHashToBase64(cellId[1]).slice(
					0,
					7,
				)}... (Not Connected)`,
			},
			classes: ['not-held'],
		});
	}

	return edges;
}

function doTheyHaveBeef(
	badAgents: CellMap<AgentPubKey[]>,
	cellId1: CellId,
	agentPubKey: AgentPubKey,
): boolean {
	const cellId2: CellId = [cellId1[0], agentPubKey];

	return (
		!!badAgents.get(cellId1)?.find(a => isEqual(a, agentPubKey)) ||
		!!badAgents.get(cellId2)?.find(a => isEqual(a, cellId1[1]))
	);
}

export function isHoldingEntry(dhtShard: DhtOp[], entryHash: EntryHash) {
	for (const dhtOp of dhtShard) {
		if (isWarrantOp(dhtOp)) {
			continue;
		}
		const chainOp = (dhtOp as { ChainOp: ChainOp }).ChainOp;
		if (
			getDhtOpType(chainOp) === ChainOpType.StoreEntry &&
			isEqual(entryHash, (getDhtOpAction(chainOp) as NewEntryAction).entry_hash)
		) {
			return true;
		}
	}

	return false;
}

export function isHoldingElement(dhtShard: DhtOp[], actionHash: ActionHash) {
	for (const dhtOp of dhtShard) {
		if (isWarrantOp(dhtOp)) {
			continue;
		}
		const chainOp = (dhtOp as { ChainOp: ChainOp }).ChainOp;
		const dhtOpactionHash = hashAction(getDhtOpAction(chainOp));
		if (
			getDhtOpType(chainOp) === ChainOpType.StoreRecord &&
			isEqual(dhtOpactionHash, actionHash)
		) {
			return true;
		}
	}

	return false;
}
