import { Element } from '@holochain-open-dev/core-types';
import {
  AgentPubKey,
  DhtOp,
  Entry,
  NewEntryHeader,
  SignedHeaderHashed,
} from '@holochain/conductor-api';
import { CellState } from './core/cell/state';
import { P2pCellState } from './core/network/p2p-cell';

export function selectSourceChain(cellState: CellState): Element[] {
  const headerHashes = cellState.sourceChain;

  return headerHashes.map(hash => {
    const signed_header: SignedHeaderHashed = { ...cellState.CAS.get(hash) };

    const entry_hash = (signed_header.header.content as NewEntryHeader)
      .entry_hash;
    let entry: Entry | undefined;
    if (entry_hash) {
      entry = { ...cellState.CAS.get(entry_hash) };
    }

    return {
      signed_header,
      entry,
    };
  });
}

export function selectDhtShard(cellState: CellState): DhtOp[] {
  return cellState.integratedDHTOps.values().map(v => v.op);
}
