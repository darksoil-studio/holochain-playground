import {
  Create,
  Entry,
  Record,
  RecordEntry,
  NewEntryAction,
  SignedActionHashed,
} from '@holochain/client';
import { serializeHash } from '@holochain-open-dev/utils';
import { getEntryTypeString, extractEntry } from '@holochain-playground/simulator';

import { SimulatedCellStore } from '../../store/simulated-playground-store';
import { CellStore } from '../../store/playground-store';

export function sourceChainNodes(
  cellStore: CellStore<any>,
  records: Record[]
) {
  const nodes = [];

  for (const record of records) {
    const action: SignedActionHashed = record.signed_action;
    const actionHash = serializeHash(action.hashed.hash);

    nodes.push({
      data: {
        id: actionHash,
        data: action,
        label: action.hashed.content.type,
      },
      classes: ['action', action.hashed.content.type],
    });

    if ((action.hashed.content as Create).prev_action) {
      const previousActionHash = serializeHash(
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
    const actionHash = serializeHash(action.hashed.hash);

    if (record.entry) {
      const newEntryAction = action.hashed.content as NewEntryAction;
      const entryHash = serializeHash(newEntryAction.entry_hash);
      const entryNodeId = `${actionHash}:${entryHash}`;

      const entry: Entry = extractEntry(record);
      console.log("+_+_+_+_+ extracted Entry: ", entry);

      let entryType: string | undefined;

      if (cellStore instanceof SimulatedCellStore) {
        entryType = getEntryTypeString(
          cellStore.dna,
          newEntryAction.entry_type
        );
      } else {
        entryType = newEntryAction.entry_type as string
      }

      nodes.push({
        data: {
          id: entryNodeId,
          data: entry,
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
