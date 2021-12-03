import {
  Entry,
  EntryType,
  SignedHeaderHashed,
  Create,
  Delete,
  Update,
  CreateLink,
  DeleteLink,
  EntryHash,
} from '@holochain/conductor-api';
import { ValidationStatus } from '../state';

export interface GetEntryResponse {
  entry: Entry;
  entry_type: EntryType;
  live_headers: SignedHeaderHashed<Create>[];
  deletes: SignedHeaderHashed<Delete>[];
  updates: SignedHeaderHashed<Update>[];
}

export interface GetElementResponse {
  signed_header: SignedHeaderHashed;
  /// If there is an entry associated with this header it will be here
  maybe_entry: Entry | undefined;
  /// The validation status of this element.
  validation_status: ValidationStatus;
  /// All deletes on this header
  deletes: SignedHeaderHashed<Delete>[];
  /// Any updates on this entry.
  updates: SignedHeaderHashed<Update>[];
}

export type GetResult = GetElementResponse | GetEntryResponse;

export interface GetLinksResponse {
  link_adds: SignedHeaderHashed<CreateLink>[];
  link_removes: SignedHeaderHashed<DeleteLink>[];
}

export interface Link {
  base: EntryHash;
  target: EntryHash;
  tag: any;
}
