import { Record } from '@holochain/client';

import { CellState } from '../state';
import { extractEntry, hashEntry } from '../utils';

export const putRecord =
  (record: Record) =>
  (state: CellState): void => {
    // Put action in CAS
    const actionHash = record.signed_action.hashed.hash;
    state.CAS.put(actionHash, record.signed_action);

    // Put entry in CAS if it exist
    if (record.entry) {
      const entryHash = hashEntry(extractEntry(record));
      state.CAS.put(entryHash, extractEntry(record));
    }

    state.sourceChain.push(actionHash);
  };
