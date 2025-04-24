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
} from '@darksoil-studio/holochain-utils';
import isEqual from 'lodash-es/isEqual.js';

import { CellStore } from '../../store/playground-store.js';
import { SimulatedCellStore } from '../../store/simulated-playground-store.js';

export function stringifyCellId(cellId: CellId): string {
	return `${encodeHashToBase64(cellId[0])}/${encodeHashToBase64(cellId[1])}`;
}

export function dhtCellsNodes(
	cells: CellMap<CellStore>,
	badAgents?: CellMap<BadAgent | undefined>,
) {
	const sortedCells = cells
		.entries()
		.sort(
			(a: [CellId, CellStore], b: [CellId, CellStore]) =>
				location(b[0][1]) - location(a[0][1]),
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
				id: stringifyCellId(cellId),
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
	const visitedFarPeers: HoloHashMap<
		AgentPubKey,
		HoloHashMap<AgentPubKey, boolean>
	> = new HoloHashMap();

	for (const [cellId, info] of farPeers.entries()) {
		for (const farPeer of info) {
			if (doTheyHaveBeef(badAgents, cellId, farPeer)) {
				continue;
			}
			if (!cells.has([cellId[0], farPeer])) {
				continue;
			}
			if (visitedFarPeers.get(farPeer)?.get(cellId[1])) {
				continue;
			}
			if (!visitedFarPeers.get(cellId[1])) {
				visitedFarPeers.set(cellId[1], new HoloHashMap());
			}
			visitedFarPeers.get(cellId[1]).set(farPeer, true);
			const myCellIdStr = stringifyCellId(cellId);
			const farPeerCellIdStr = stringifyCellId([cellId[0], farPeer]);
			normalEdges.push({
				data: {
					id: `${myCellIdStr}->${farPeerCellIdStr}`,
					source: myCellIdStr,
					target: farPeerCellIdStr,
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
				const neighborNotConnected = !cells.has([cellId[0], cellNeighbor]);
				const neighborNeighbors = cellsNeighbors.get([cellId[0], cellNeighbor]);
				if (
					neighborNotConnected ||
					neighborNeighbors?.find(
						n => encodeHashToBase64(n) === encodeHashToBase64(cellAgentPubKey),
					)
				) {
					const cellIdStr = stringifyCellId(cellId);
					const cellNeighborStr = stringifyCellId([cellId[0], cellNeighbor]);
					edges.push({
						data: {
							id: `${cellIdStr}->${cellNeighborStr}`,
							source: cellIdStr,
							target: cellNeighborStr,
						},
						classes: ['neighbor-edge'],
					});
				}

				if (neighborNotConnected) {
					neighborsNotConnected.set([cellId[0], cellNeighbor], true);
				}
			}

			visited.get(cellAgentPubKey).set(cellNeighbor, true);
		}
	}

	for (const [cellId, _] of neighborsNotConnected.entries()) {
		const cellIdStr = stringifyCellId(cellId);
		edges.push({
			data: {
				id: cellIdStr,
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

export function isHoldingRecord(dhtShard: DhtOp[], actionHash: ActionHash) {
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
