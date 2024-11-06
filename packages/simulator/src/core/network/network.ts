import { AgentPubKey, DnaHash } from '@holochain/client';
import { CellMap } from '@tnesh-stack/utils';

import { BootstrapService } from '../../bootstrap/bootstrap-service.js';
import { Cell } from '../cell/cell.js';
import { Conductor } from '../conductor.js';
import { P2pCell, P2pCellState } from '../network/p2p-cell.js';
import { KitsuneP2p } from './kitsune_p2p.js';
import { NetworkRequest } from './network-request.js';

export interface NetworkState {
	// P2pCellState by dna hash / agentPubKey
	p2pCellsState: CellMap<P2pCellState>;
}

export class Network {
	// P2pCells contained in this conductor
	p2pCells: CellMap<P2pCell>;

	kitsune: KitsuneP2p;

	constructor(
		state: NetworkState,
		public conductor: Conductor,
		public bootstrapService: BootstrapService,
	) {
		this.p2pCells = new CellMap();
		for (const [cellId, p2pState] of state.p2pCellsState.entries()) {
			this.p2pCells.set(
				cellId,
				new P2pCell(p2pState, conductor.getCell(cellId) as Cell, this),
			);
		}

		this.kitsune = new KitsuneP2p(this);
	}

	getState(): NetworkState {
		const p2pCellsState: CellMap<P2pCellState> = new CellMap();

		for (const [cellId, p2pCell] of this.p2pCells.entries()) {
			p2pCellsState.set(cellId, p2pCell.getState());
		}

		return {
			p2pCellsState,
		};
	}

	getAllP2pCells(): P2pCell[] {
		return this.p2pCells.values();
	}

	createP2pCell(cell: Cell): P2pCell {
		const cellId = cell.cellId;
		const dnaHash = cellId[0];

		const state: P2pCellState = {
			neighbors: [],
			farKnownPeers: [],
			redundancyFactor: 3,
			neighborNumber: 5,
			badAgents: [],
		};

		const p2pCell = new P2pCell(state, cell, this);

		this.p2pCells.set(cellId, p2pCell);

		return p2pCell;
	}

	public sendRequest<T>(
		dna: DnaHash,
		fromAgent: AgentPubKey,
		toAgent: AgentPubKey,
		request: NetworkRequest<T>,
	): Promise<T> {
		const localCell = this.conductor.getCell([dna, toAgent]);

		if (localCell) return request(localCell);

		return request(this.bootstrapService.cells.get([dna, toAgent]) as Cell);
	}
}
