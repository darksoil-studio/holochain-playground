import {
  Create,
  Entry,
  Record,
  RecordEntry,
  NewEntryAction,
  SignedActionHashed,
  encodeHashToBase64,
} from '@holochain/client';
import {
  getEntryTypeString,
  extractEntry,
} from '@holochain-playground/simulator';
import { decode } from '@msgpack/msgpack';

import { SimulatedCellStore } from '../../store/simulated-playground-store.js';
import { CellStore } from '../../store/playground-store.js';

export function sourceChainNodes(cellStore: CellStore<any>, records: Record[]) {
  const nodes = [];

  for (const record of records) {
    const action: SignedActionHashed = record.signed_action;
    const actionHash = encodeHashToBase64(action.hashed.hash);

    nodes.push({
      data: {
        id: actionHash,
        data: action,
        label: action.hashed.content.type,
      },
      classes: ['action', action.hashed.content.type],
    });

    if ((action.hashed.content as Create).prev_action) {
      const previousActionHash = encodeHashToBase64(
        (action.hashed.content as Create).prev_action
      );
      nodes.push({
        data: {
          id: `${actionHash}->${previousActionHash}`,
          source: actionHash,
          target: previousActionHash,
        },
        classes: ['embedded-reference'],
      });
    }
  }

  for (const record of records) {
    const action: SignedActionHashed = record.signed_action;
    const actionHash = encodeHashToBase64(action.hashed.hash);

    if (extractEntry(record)) {
      const newEntryAction = action.hashed.content as NewEntryAction;
      const entryHash = encodeHashToBase64(newEntryAction.entry_hash);
      const entryNodeId = `${actionHash}:${entryHash}`;

      const entry: Entry = (record.entry as any)?.Present;

      let entryType: string | undefined;

      if (cellStore instanceof SimulatedCellStore) {
        entryType = getEntryTypeString(
          cellStore.dna,
          newEntryAction.entry_type
        );
      } else {
        entryType = entry.entry_type as string;
      }

      let data = entry;

      if (entry.entry_type === 'App') {
        data = {
          ...data,
          entry: decode(entry.entry) as any,
        };
      }

      nodes.push({
        data: {
          id: entryNodeId,
          data,
          label: entryType,
        },
        classes: [entryType, 'entry'],
      });
      nodes.push({
        data: {
          id: `${actionHash}->${entryNodeId}`,
          source: actionHash,
          target: entryNodeId,
        },
        classes: ['embedded-reference'],
      });
    }
  }

  return nodes;
}
