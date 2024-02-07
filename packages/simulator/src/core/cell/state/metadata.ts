import { EntryDhtStatus } from '@holochain-open-dev/core-types';
import { HoloHashMap } from '@holochain-open-dev/utils';
import {
  NewEntryAction,
  Timestamp,
  EntryHash,
  ActionHash,
  LinkType,
} from '@holochain/client';

// From https://github.com/holochain/holochain/blob/develop/crates/holochain/src/core/state/metadata.rs

export interface Metadata {
  // Stores an array of actions indexed by entry hash
  system_meta: HoloHashMap<EntryHash, SysMetaVal[]>;
  link_meta: Array<{ key: LinkMetaKey; value: LinkMetaVal }>;
  misc_meta: HoloHashMap<ActionHash, MiscMetaVal>;
}

export type SysMetaVal =
  | {
      NewEntry: ActionHash;
    }
  | {
      Update: ActionHash;
    }
  | {
      Delete: ActionHash;
    }
  | {
      Activity: ActionHash;
    }
  | {
      DeleteLink: ActionHash;
    }
  | {
      CustomPackage: ActionHash;
    };

export function getSysMetaValActionHash(
  sys_meta_val: SysMetaVal
): ActionHash | undefined {
  if ((sys_meta_val as { NewEntry: ActionHash }).NewEntry)
    return (sys_meta_val as { NewEntry: ActionHash }).NewEntry;
  if ((sys_meta_val as { Update: ActionHash }).Update)
    return (sys_meta_val as { Update: ActionHash }).Update;
  if ((sys_meta_val as { Delete: ActionHash }).Delete)
    return (sys_meta_val as { Delete: ActionHash }).Delete;
  if ((sys_meta_val as { Activity: ActionHash }).Activity)
    return (sys_meta_val as { Activity: ActionHash }).Activity;
  return undefined;
}

export interface LinkMetaKey {
  base: EntryHash;
  zome_index: number;
  tag: any;
  link_type: LinkType;
  action_hash: ActionHash;
}

export interface LinkMetaVal {
  link_add_hash: ActionHash;
  target: EntryHash;
  timestamp: Timestamp;
  zome_index: number;
  link_type: LinkType;
  tag: any;
}

export type MiscMetaVal =
  | {
      EntryStatus: EntryDhtStatus;
    }
  | 'StoreRecord'
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
  action_seq: number;
  hash: ActionHash[];
}
export interface CoreEntryDetails {
  actions: NewEntryAction[];
  links: LinkMetaVal[];
  dhtStatus: EntryDhtStatus;
}
