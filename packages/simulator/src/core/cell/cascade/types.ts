import {
  Entry,
  EntryType,
  SignedActionHashed,
  Create,
  Delete,
  Update,
  CreateLink,
  DeleteLink,
  EntryHash,
} from '@holochain/client';
import { ValidationStatus } from '../state.js';

export interface GetEntryResponse {
  entry: Entry;
  entry_type: EntryType;
  live_actions: SignedActionHashed<Create>[];
  deletes: SignedActionHashed<Delete>[];
  updates: SignedActionHashed<Update>[];
}

export interface GetRecordResponse {
  signed_action: SignedActionHashed;
  /// If there is an entry associated with this action it will be here
  maybe_entry: Entry | undefined;
  /// The validation status of this record.
  validation_status: ValidationStatus;
  /// All deletes on this action
  deletes: SignedActionHashed<Delete>[];
  /// Any updates on this entry.
  updates: SignedActionHashed<Update>[];
}

export type GetResult = GetRecordResponse | GetEntryResponse;

export interface GetLinksResponse {
  link_adds: SignedActionHashed<CreateLink>[];
  link_removes: SignedActionHashed<DeleteLink>[];
}

export interface Link {
  base: EntryHash;
  target: EntryHash;
  tag: any;
}
