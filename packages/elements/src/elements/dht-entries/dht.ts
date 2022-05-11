import {
  HoloHashMap,
  CellMap,
  SimulatedDna,
  getEntryTypeString,
  HashType,
  hash,
} from '@holochain-playground/simulator';
import {
  HoloHash,
  DhtOp,
  Header,
  HeaderHash,
  EntryHash,
  DhtOpType,
  NewEntryHeader,
  getDhtOpType,
  getDhtOpHeader,
  getDhtOpEntry,
  CreateLink,
  DeleteLink,
  Delete,
  Update,
  Entry,
  AppEntryType,
} from '@holochain/client';

function appendToArray<T>(map: HoloHashMap<T[]>, key: HoloHash, value: T) {
  if (!map.has(key)) map.put(key, []);

  const previous_value = map.get(key);
  map.put(key, [...previous_value, value]);
}

export interface DhtSummary {
  headers: HoloHashMap<Header>;
  // Updated header -> header that updates
  headerUpdates: HoloHashMap<HeaderHash[]>;
  // Deleted header -> header that deletes
  headerDeletes: HoloHashMap<HeaderHash[]>;
  entries: HoloHashMap<any>;
  // Entry hash -> header that created that entry
  headersByEntry: HoloHashMap<HeaderHash[]>;
  entryLinks: HoloHashMap<
    Array<{
      target_address: EntryHash;
      tag: any;
      add_link_hash: HeaderHash;
    }>
  >;
  // Deleted add link -> header that deletes that
  deletedAddLinks: HoloHashMap<HeaderHash[]>;
  entryTypes: HoloHashMap<string>;
}

export function summarizeDht(
  dhtShards: CellMap<DhtOp[]>,
  simulatedDna?: SimulatedDna
): DhtSummary {
  // For every header hash, the types of Op that have been visited already
  const visited = new HoloHashMap<string[]>();

  const headers = new HoloHashMap<Header>();
  // Updated header -> header that updates
  const headerUpdates = new HoloHashMap<HeaderHash[]>();
  // Deleted header -> header that deletes
  const headerDeletes = new HoloHashMap<HeaderHash[]>();
  const entries = new HoloHashMap<any>();
  // Entry hash -> header that created that entry
  const headersByEntry = new HoloHashMap<HeaderHash[]>();
  const entryLinks = new HoloHashMap<
    Array<{
      target_address: EntryHash;
      tag: any;
      add_link_hash: HeaderHash;
    }>
  >();
  // Deleted add link -> header that deletes that
  const deletedAddLinks = new HoloHashMap<HeaderHash[]>();

  const entryTypes = new HoloHashMap<string>();
  for (const shard of dhtShards.values()) {
    for (const dhtOp of shard) {
      const dhtOpType = getDhtOpType(dhtOp);

      const header = getDhtOpHeader(dhtOp);

      const headerHash = hash(header, HashType.HEADER);

      if (!visited.has(headerHash)) {
        visited.put(headerHash, []);
      }
      if (!visited.get(headerHash).includes(dhtOpType)) {
        visited.put(headerHash, [...visited.get(headerHash), dhtOpType]);

        headers.put(headerHash, header);

        if (dhtOpType === DhtOpType.StoreEntry) {
          const entry_hash = (header as NewEntryHeader).entry_hash;
          const entry = getDhtOpEntry(dhtOp);
          entries.put(entry_hash, entry);
          appendToArray(headersByEntry, entry_hash, headerHash);

          const entryType = simulatedDna
            ? getEntryTypeString(
                simulatedDna,
                (header as NewEntryHeader).entry_type
              )
            : getConnectedEntryType(header as NewEntryHeader, entry);
          entryTypes.put(entry_hash, entryType);
        } else if (dhtOpType === DhtOpType.RegisterAddLink) {
          const base_address = (header as CreateLink).base_address;
          const target_address = (header as CreateLink).target_address;
          const tag = (header as CreateLink).tag;
          appendToArray(entryLinks, base_address, {
            tag,
            target_address,
            add_link_hash: headerHash,
          });
        } else if (dhtOpType === DhtOpType.RegisterRemoveLink) {
          const add_link_hash = (header as DeleteLink).link_add_address;
          appendToArray(deletedAddLinks, add_link_hash, headerHash);
        } else if (
          dhtOpType === DhtOpType.RegisterDeletedBy ||
          dhtOpType === DhtOpType.RegisterDeletedEntryHeader
        ) {
          const deletedHeader = (header as Delete).deletes_address;
          appendToArray(headerDeletes, deletedHeader, headerHash);
        } else if (
          dhtOpType === DhtOpType.RegisterUpdatedContent ||
          dhtOpType === DhtOpType.RegisterUpdatedElement
        ) {
          const updatedHeader = (header as Update).original_header_address;
          appendToArray(headerUpdates, updatedHeader, headerHash);
        }
      }
    }
  }

  return {
    headers,
    headerUpdates,
    headerDeletes,
    entries,
    headersByEntry,
    entryLinks,
    deletedAddLinks,
    entryTypes,
  };
}

export function isEntryDeleted(
  summary: DhtSummary,
  entryHash: EntryHash
): boolean {
  const headers = summary.headersByEntry.get(entryHash);
  const aliveHeaders = headers.filter((h) => !summary.headerDeletes.has(h));

  return aliveHeaders.length === 0;
}

function getConnectedEntryType(header: NewEntryHeader, entry: Entry): string {
  if (
    entry.entry_type !== 'App' &&
    (entry.entry_type as any) !== 'CounterSign'
  ) {
    return entry.entry_type;
  }
  const appEntryType = (
    header.entry_type as {
      App: AppEntryType;
    }
  ).App;

  return `Zome:${appEntryType.zome_id},EntryId:${appEntryType.id}`;
}
