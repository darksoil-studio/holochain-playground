import { EntryDhtStatus, Dictionary } from '@holochain-open-dev/core-types';
import {
  NewEntryHeader,
  Timestamp,
  EntryHash,
  HeaderHash,
} from '@holochain/conductor-api';
import { HoloHashMap } from '../../../processors/holo-hash-map';

// From https://github.com/holochain/holochain/blob/develop/crates/holochain/src/core/state/metadata.rs

export interface Metadata {
  // Stores an array of headers indexed by entry hash
  system_meta: HoloHashMap<SysMetaVal[]>;
  link_meta: Array<{ key: LinkMetaKey; value: LinkMetaVal }>;
  misc_meta: HoloHashMap<MiscMetaVal>;
}

export type SysMetaVal =
  | {
      NewEntry: HeaderHash;
    }
  | {
      Update: HeaderHash;
    }
  | {
      Delete: HeaderHash;
    }
  | {
      Activity: HeaderHash;
    }
  | {
      DeleteLink: HeaderHash;
    }
  | {
      CustomPackage: HeaderHash;
    };

export function getSysMetaValHeaderHash(
  sys_meta_val: SysMetaVal
): HeaderHash | undefined {
  if ((sys_meta_val as { NewEntry: HeaderHash }).NewEntry)
    return (sys_meta_val as { NewEntry: HeaderHash }).NewEntry;
  if ((sys_meta_val as { Update: HeaderHash }).Update)
    return (sys_meta_val as { Update: HeaderHash }).Update;
  if ((sys_meta_val as { Delete: HeaderHash }).Delete)
    return (sys_meta_val as { Delete: HeaderHash }).Delete;
  if ((sys_meta_val as { Activity: HeaderHash }).Activity)
    return (sys_meta_val as { Activity: HeaderHash }).Activity;
  return undefined;
}

export interface LinkMetaKey {
  base: EntryHash;
  zome_id: number;
  tag: any;
  header_hash: HeaderHash;
}

export interface LinkMetaVal {
  link_add_hash: HeaderHash;
  target: EntryHash;
  timestamp: Timestamp;
  zome_id: number;
  tag: any;
}

export type MiscMetaVal =
  | {
      EntryStatus: EntryDhtStatus;
    }
  | 'StoreElement'
  | { ChainItem: Timestamp }
  | { ChainObserved: HighestObserved }
  | { ChainStatus: ChainStatus };

export enum ChainStatus {
  Empty,
  Valid,
  Forked,
  Invalid,
}

export interface HighestObserved {
  header_seq: number;
  hash: HeaderHash[];
}
export interface CoreEntryDetails {
  headers: NewEntryHeader[];
  links: LinkMetaVal[];
  dhtStatus: EntryDhtStatus;
}
