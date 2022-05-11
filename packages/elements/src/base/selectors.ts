import {
  SignedHeaderHashed,
  NewEntryHeader,
  DnaHash,
  AnyDhtHash,
  AgentPubKey,
  HeaderHash,
} from '@holochain/client';

import {
  AgentPubKeyB64,
  DnaHashB64,
  AnyDhtHashB64,
  HeaderHashB64,
} from '@holochain-open-dev/core-types';
import {
  Conductor,
  Cell,
  isHoldingEntry,
  isHoldingElement,
  getHashType,
  HashType,
  HoloHashMap,
} from '@holochain-playground/simulator';
import { cloneDeep } from 'lodash';

export function selectCells(dna: DnaHash, conductor: Conductor): Cell[] {
  return conductor.getCells(dna);
}

export function selectAllCells(dna: DnaHash, conductors: Conductor[]): Cell[] {
  const cells = conductors.map((c) => selectCells(dna, c));
  return [].concat(...cells);
}

export function selectGlobalDHTOpsCount(cells: Cell[]): number {
  let dhtOps = 0;

  for (const cell of cells) {
    dhtOps += Object.keys(cell._state.integratedDHTOps).length;
  }

  return dhtOps;
}

export function selectHoldingCells(hash: AnyDhtHash, cells: Cell[]): Cell[] {
  if (getHashType(hash) === HashType.ENTRY)
    return cells.filter((cell) => isHoldingEntry(cell._state, hash));
  return cells.filter((cell) => isHoldingElement(cell._state, hash));
}

export function selectConductorByAgent(
  agentPubKey: AgentPubKey,
  conductors: Conductor[]
): Conductor | undefined {
  return conductors.find((conductor) =>
    conductor.getAllCells().find((cell) => cell.agentPubKey === agentPubKey)
  );
}

export function selectCell(
  dnaHash: DnaHash,
  agentPubKey: AgentPubKey,
  conductors: Conductor[]
): Cell | undefined {
  for (const conductor of conductors) {
    for (const cell of conductor.getAllCells()) {
      if (cell.agentPubKey === agentPubKey && cell.dnaHash === dnaHash) {
        return cell;
      }
    }
  }

  return undefined;
}

export function selectUniqueDHTOpsCount(cells: Cell[]): number {
  const globalDHTOps = {};

  for (const cell of cells) {
    for (const hash of Object.keys(cell._state.integratedDHTOps)) {
      globalDHTOps[hash] = {};
    }
  }

  return Object.keys(globalDHTOps).length;
}

export function selectFromCAS(hash: AnyDhtHash, cells: Cell[]): any {
  if (!hash) return undefined;

  for (const cell of cells) {
    const entry = cell._state.CAS.get(hash);
    if (entry) {
      return cloneDeep(entry);
    }
  }
  return undefined;
}

export function selectHeaderEntry(headerHash: HeaderHash, cells: Cell[]): any {
  const header: SignedHeaderHashed<NewEntryHeader> = selectFromCAS(
    headerHash,
    cells
  );
  return selectFromCAS(header.header.content.entry_hash, cells);
}

export function selectMedianHoldingDHTOps(cells: Cell[]): number {
  const holdingDHTOps = [];

  for (const cell of cells) {
    holdingDHTOps.push(Object.keys(cell._state.integratedDHTOps).length);
  }

  holdingDHTOps.sort();

  const medianIndex = Math.floor(holdingDHTOps.length / 2);

  return holdingDHTOps.sort((a, b) => a - b)[medianIndex];
}

export function selectAllDNAs(conductors: Conductor[]): DnaHash[] {
  const dnas = new HoloHashMap<boolean>();

  for (const conductor of conductors) {
    for (const cell of conductor.getAllCells()) {
      dnas.put(cell.dnaHash, true);
    }
  }
  return dnas.keys();
}

export function selectRedundancyFactor(cell: Cell): number {
  return cell.p2p.redundancyFactor;
}
