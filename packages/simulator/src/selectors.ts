import {
  DhtOp,
  Entry,
  NewEntryAction,
  SignedActionHashed,
  Record,
} from '@holochain/client';
import { CellState } from './core/cell/state';
import { P2pCellState } from './core/network/p2p-cell';

export function selectSourceChain(cellState: CellState): Record[] {
  const actionHashes = cellState.sourceChain;

  return actionHashes.map(hash => {
    const signed_action: SignedActionHashed = { ...cellState.CAS.get(hash) };

    const entry_hash = (signed_action.hashed.content as NewEntryAction)
      .entry_hash;
    let entry: Entry | undefined;
    if (entry_hash) {
      entry = { ...cellState.CAS.get(entry_hash) };
    }

    return {
      signed_action,
      entry: {
        Present: entry,
      },
    };
  });
}

export function selectDhtShard(cellState: CellState): DhtOp[] {
  return cellState.integratedDHTOps.values().map(v => v.op);
}
