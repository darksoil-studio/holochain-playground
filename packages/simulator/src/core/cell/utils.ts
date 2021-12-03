import {
  Create,
  CreateLink,
  Delete,
  DeleteLink,
  HeaderType,
  SignedHeaderHashed,
  Update,
  AnyDhtHash,
  AppEntryType,
  DhtOp,
  DhtOpType,
  Entry,
  EntryHash,
  EntryType,
  getDhtOpType,
  getDhtOpEntry,
  getDhtOpHeader,
} from '@holochain/conductor-api';
import { Element } from '@holochain-open-dev/core-types';

import { hash, HashType } from '../../processors/hash';
import { SimulatedDna } from '../../dnas/simulated-dna';

export function hashEntry(entry: Entry): EntryHash {
  if (entry.entry_type === 'Agent') return entry.content;
  return hash(entry.content, HashType.ENTRY);
}

export function getAppEntryType(
  entryType: EntryType
): AppEntryType | undefined {
  if ((entryType as { App: AppEntryType }).App)
    return (entryType as { App: AppEntryType }).App;
  return undefined;
}

export function getEntryTypeString(
  dna: SimulatedDna,
  entryType: EntryType
): string {
  const appEntryType = getAppEntryType(entryType);

  if (appEntryType) {
    return dna.zomes[appEntryType.zome_id].entry_defs[appEntryType.id].id;
  }

  return entryType as string;
}

export function getDhtOpBasis(dhtOp: DhtOp): AnyDhtHash {
  const type = getDhtOpType(dhtOp);
  const header = getDhtOpHeader(dhtOp);
  const headerHash = hash(header, HashType.HEADER);

  switch (type) {
    case DhtOpType.StoreElement:
      return headerHash;
    case DhtOpType.StoreEntry:
      return (header as Create).entry_hash;
    case DhtOpType.RegisterUpdatedContent:
      return (header as Update).original_entry_address;
    case DhtOpType.RegisterUpdatedElement:
      return (header as Update).original_header_address;
    case DhtOpType.RegisterAgentActivity:
      return header.author;
    case DhtOpType.RegisterAddLink:
      return (header as CreateLink).base_address;
    case DhtOpType.RegisterRemoveLink:
      return (header as DeleteLink).base_address;
    case DhtOpType.RegisterDeletedBy:
      return (header as Delete).deletes_address;
    case DhtOpType.RegisterDeletedEntryHeader:
      return (header as Delete).deletes_entry_address;
    default:
      return undefined as unknown as AnyDhtHash;
  }
}

export const DHT_SORT_PRIORITY = [
  DhtOpType.RegisterAgentActivity,
  DhtOpType.StoreEntry,
  DhtOpType.StoreElement,
  DhtOpType.RegisterUpdatedContent,
  DhtOpType.RegisterUpdatedElement,
  DhtOpType.RegisterDeletedEntryHeader,
  DhtOpType.RegisterDeletedBy,
  DhtOpType.RegisterAddLink,
  DhtOpType.RegisterRemoveLink,
];

export function elementToDhtOps(element: Element): DhtOp[] {
  const allDhtOps: DhtOp[] = [];

  // All hdk commands have these two DHT Ops

  allDhtOps.push({
    [DhtOpType.RegisterAgentActivity]: [
      element.signed_header.signature,
      element.signed_header.header.content,
    ],
  });
  allDhtOps.push({
    [DhtOpType.StoreElement]: [
      element.signed_header.signature,
      element.signed_header.header.content,
      element.entry,
    ],
  });

  // Each header derives into different DhtOps

  if (element.signed_header.header.content.type == HeaderType.Update) {
    allDhtOps.push({
      [DhtOpType.RegisterUpdatedContent]: [
        element.signed_header.signature,
        element.signed_header.header.content,
        element.entry,
      ],
    });
    allDhtOps.push({
      [DhtOpType.RegisterUpdatedElement]: [
        element.signed_header.signature,
        element.signed_header.header.content,
        element.entry,
      ],
    });
    allDhtOps.push({
      [DhtOpType.StoreEntry]: [
        element.signed_header.signature,
        element.signed_header.header.content,
        element.entry as Entry,
      ],
    });
  } else if (element.signed_header.header.content.type == HeaderType.Create) {
    allDhtOps.push({
      [DhtOpType.StoreEntry]: [
        element.signed_header.signature,
        element.signed_header.header.content,
        element.entry as Entry,
      ],
    });
  } else if (element.signed_header.header.content.type == HeaderType.Delete) {
    allDhtOps.push({
      [DhtOpType.RegisterDeletedBy]: [
        element.signed_header.signature,
        element.signed_header.header.content,
      ],
    });
    allDhtOps.push({
      [DhtOpType.RegisterDeletedEntryHeader]: [
        element.signed_header.signature,
        element.signed_header.header.content,
      ],
    });
  } else if (
    element.signed_header.header.content.type == HeaderType.DeleteLink
  ) {
    allDhtOps.push({
      [DhtOpType.RegisterRemoveLink]: [
        element.signed_header.signature,
        element.signed_header.header.content,
      ],
    });
  } else if (
    element.signed_header.header.content.type == HeaderType.CreateLink
  ) {
    allDhtOps.push({
      [DhtOpType.RegisterAddLink]: [
        element.signed_header.signature,
        element.signed_header.header.content,
      ],
    });
  }

  return allDhtOps;
}

export function sortDhtOps(dhtOps: DhtOp[]): DhtOp[] {
  const prio = (dhtOp: DhtOp) =>
    DHT_SORT_PRIORITY.findIndex(type => type === getDhtOpType(dhtOp));
  return dhtOps.sort((dhtA: DhtOp, dhtB: DhtOp) => prio(dhtA) - prio(dhtB));
}

export function getEntry(dhtOp: DhtOp): Entry | undefined {
  const type = getDhtOpType(dhtOp);
  if (type === DhtOpType.StoreEntry) return getDhtOpEntry(dhtOp);
  else if (type === DhtOpType.StoreElement) return getDhtOpEntry(dhtOp);
  return undefined;
}
