import {
  AgentPubKey,
  AnyDhtHash,
  CellId,
  DnaHash,
} from '@holochain/conductor-api';

import { Cell } from '../core/cell';
import {
  getClosestNeighbors,
  getFarthestNeighbors,
} from '../core/network/utils';
import { areEqual } from '../processors/hash';
import { CellMap } from '../processors/holo-hash-map';

export class BootstrapService {
  cells: CellMap<Cell> = new CellMap();

  announceCell(cellId: CellId, cell: Cell) {
    this.cells.put(cellId, cell);
  }

  getNeighborhood(
    dnaHash: DnaHash,
    basis_dht_hash: AnyDhtHash,
    numNeighbors: number,
    filteredAgents: AgentPubKey[] = []
  ): Cell[] {
    const dnaCells = this.cells.valuesForDna(dnaHash);

    const cells = dnaCells.filter(
      cell => !filteredAgents.find(fa => areEqual(fa, cell.agentPubKey))
    );

    const neighborsKeys = getClosestNeighbors(
      cells.map(c => c.agentPubKey),
      basis_dht_hash,
      numNeighbors
    );

    return neighborsKeys.map(
      pubKey => dnaCells.find(c => areEqual(pubKey, c.agentPubKey)) as Cell
    );
  }

  getFarKnownPeers(
    dnaHash: DnaHash,
    agentPubKey: AgentPubKey,
    filteredAgents: AgentPubKey[] = []
  ): Cell[] {
    const dnaAgents = this.cells.agentsForDna(dnaHash);

    const cells = dnaAgents.filter(
      peerPubKey =>
        !areEqual(peerPubKey, agentPubKey) &&
        !filteredAgents.find(a => areEqual(peerPubKey, a))
    );

    const farthestKeys = getFarthestNeighbors(cells, agentPubKey);

    return farthestKeys.map(
      pubKey => this.cells.get([dnaHash, pubKey]) as Cell
    );
  }
}
