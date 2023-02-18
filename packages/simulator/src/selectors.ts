import {
  DhtOp,
  Entry,
  NewEntryAction,
  SignedActionHashed,
  Record,
} from '@holochain/client';
import { CellState } from './core/cell/state.js';

export function selectSourceChain(cellState: CellState): Record[] {
  const actionHashes = cellState.sourceChain;

  return actionHashes.map((hash) => {
    const signed_action: SignedActionHashed = { ...cellState.CAS.get(hash) };

    const { entry_hash } = signed_action.hashed.content as NewEntryAction;
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
  return Array.from(cellState.integratedDHTOps.values()).map((v) => v.op);
}
