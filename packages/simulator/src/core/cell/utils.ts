import {
  Create,
  CreateLink,
  Delete,
  DeleteLink,
  ActionType,
  Update,
  AnyDhtHash,
  AppEntryDef,
  DhtOp,
  DhtOpType,
  Entry,
  EntryHash,
  EntryType,
  getDhtOpType,
  getDhtOpEntry,
  getDhtOpAction,
  Record,
} from '@holochain/client';
import { hash, HashType } from '@holochain-open-dev/utils';

import { SimulatedDna } from '../../dnas/simulated-dna';
import { isPublic } from './source-chain/utils';

export function extractEntry(record: Record): Entry | undefined {
  return 'Present' in record.entry ? record.entry.Present : undefined;
}

export function hashEntry(entry: Entry): EntryHash {
  if (entry.entry_type === 'Agent') return entry.entry;
  return hash(entry.entry, HashType.ENTRY);
}

export function getAppEntryType(
  entry_type: EntryType
): AppEntryDef | undefined {
  return typeof entry_type === 'object' && 'App' in entry_type
    ? entry_type.App
    : undefined;
}

export function getEntryTypeString(
  dna: SimulatedDna,
  entryType: EntryType
): string {
  const appEntryType = getAppEntryType(entryType);

  if (appEntryType) {
    return dna.zomes[appEntryType.zome_index].entry_defs[
      appEntryType.entry_index
    ].id;
  }

  return entryType as string;
}

export function getDhtOpBasis(dhtOp: DhtOp): AnyDhtHash {
  const type = getDhtOpType(dhtOp);
  const action = getDhtOpAction(dhtOp);
  const actionHash = hash(action, HashType.ACTION);

  switch (type) {
    case DhtOpType.StoreRecord:
      return actionHash;
    case DhtOpType.StoreEntry:
      return (action as Create).entry_hash;
    case DhtOpType.RegisterUpdatedContent:
      return (action as Update).original_entry_address;
    case DhtOpType.RegisterUpdatedRecord:
      return (action as Update).original_action_address;
    case DhtOpType.RegisterAgentActivity:
      return action.author;
    case DhtOpType.RegisterAddLink:
      return (action as CreateLink).base_address;
    case DhtOpType.RegisterRemoveLink:
      return (action as DeleteLink).base_address;
    case DhtOpType.RegisterDeletedBy:
      return (action as Delete).deletes_address;
    case DhtOpType.RegisterDeletedEntryAction:
      return (action as Delete).deletes_entry_address;
    default:
      return undefined as unknown as AnyDhtHash;
  }
}

export const DHT_SORT_PRIORITY = [
  DhtOpType.RegisterAgentActivity,
  DhtOpType.StoreEntry,
  DhtOpType.StoreRecord,
  DhtOpType.RegisterUpdatedContent,
  DhtOpType.RegisterUpdatedRecord,
  DhtOpType.RegisterDeletedEntryAction,
  DhtOpType.RegisterDeletedBy,
  DhtOpType.RegisterAddLink,
  DhtOpType.RegisterRemoveLink,
];

export function recordToDhtOps(record: Record): DhtOp[] {
  const allDhtOps: DhtOp[] = [];

  // All hdk commands have these two DHT Ops
  allDhtOps.push({
    [DhtOpType.RegisterAgentActivity]: [
      record.signed_action.signature,
      record.signed_action.hashed.content,
    ],
  });
  allDhtOps.push({
    [DhtOpType.StoreRecord]: [
      record.signed_action.signature,
      record.signed_action.hashed.content,
      extractEntry(record),
    ],
  });

  // Each action derives into different DhtOps

  if (record.signed_action.hashed.content.type === ActionType.Update) {
    allDhtOps.push({
      [DhtOpType.RegisterUpdatedContent]: [
        record.signed_action.signature,
        record.signed_action.hashed.content,
        extractEntry(record),
      ],
    });
    allDhtOps.push({
      [DhtOpType.RegisterUpdatedRecord]: [
        record.signed_action.signature,
        record.signed_action.hashed.content,
        extractEntry(record),
      ],
    });
    if (isPublic(record.signed_action.hashed.content.entry_type)) {
      allDhtOps.push({
        [DhtOpType.StoreEntry]: [
          record.signed_action.signature,
          record.signed_action.hashed.content,
          extractEntry(record),
        ],
      });
    }
  } else if (record.signed_action.hashed.content.type === ActionType.Create) {
    if (isPublic(record.signed_action.hashed.content.entry_type)) {
      allDhtOps.push({
        [DhtOpType.StoreEntry]: [
          record.signed_action.signature,
          record.signed_action.hashed.content,
          extractEntry(record),
        ],
      });
    }
  } else if (record.signed_action.hashed.content.type === ActionType.Delete) {
    allDhtOps.push({
      [DhtOpType.RegisterDeletedBy]: [
        record.signed_action.signature,
        record.signed_action.hashed.content,
      ],
    });
    allDhtOps.push({
      [DhtOpType.RegisterDeletedEntryAction]: [
        record.signed_action.signature,
        record.signed_action.hashed.content,
      ],
    });
  } else if (
    record.signed_action.hashed.content.type === ActionType.DeleteLink
  ) {
    allDhtOps.push({
      [DhtOpType.RegisterRemoveLink]: [
        record.signed_action.signature,
        record.signed_action.hashed.content,
      ],
    });
  } else if (
    record.signed_action.hashed.content.type === ActionType.CreateLink
  ) {
    allDhtOps.push({
      [DhtOpType.RegisterAddLink]: [
        record.signed_action.signature,
        record.signed_action.hashed.content,
      ],
    });
  }

  return allDhtOps;
}

export function sortDhtOps(dhtOps: DhtOp[]): DhtOp[] {
  const prio = (dhtOp: DhtOp) =>
    DHT_SORT_PRIORITY.findIndex((type) => type === getDhtOpType(dhtOp));
  return dhtOps.sort((dhtA: DhtOp, dhtB: DhtOp) => prio(dhtA) - prio(dhtB));
}

export function getEntry(dhtOp: DhtOp): Entry | undefined {
  const type = getDhtOpType(dhtOp);
  if (type === DhtOpType.StoreEntry) return getDhtOpEntry(dhtOp);
  else if (type === DhtOpType.StoreRecord) return getDhtOpEntry(dhtOp);
  return undefined;
}
