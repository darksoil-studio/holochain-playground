import {
  Create,
  Delete,
  Entry,
  EntryType,
  NewEntryHeader,
  SignedHeaderHashed,
  Update,
  EntryHash,
  HeaderHash,
} from '@holochain/conductor-api';

import { P2pCell } from '../../..';
import { GetLinksOptions, GetOptions } from '../../../types';
import {
  getLinksForEntry,
  getHeaderModifiers,
  getHeadersForEntry,
  getEntryDetails,
} from '../dht/get';
import { CellState, ValidationStatus } from '../state';
import {
  GetEntryResponse,
  GetElementResponse,
  GetLinksResponse,
} from './types';

// From https://github.com/holochain/holochain/blob/develop/crates/holochain_cascade/src/authority.rs
export class Authority {
  constructor(protected state: CellState, protected p2p: P2pCell) {}

  public async handle_get_entry(
    entry_hash: EntryHash,
    options: GetOptions
  ): Promise<GetEntryResponse | undefined> {
    const entry = this.state.CAS.get(entry_hash);
    if (!entry) return undefined;

    const allHeaders = getHeadersForEntry(this.state, entry_hash);

    const entryDetails = getEntryDetails(this.state, entry_hash);

    const createHeader = allHeaders.find(
      header => (header.header.content as Create).entry_type
    );
    let entry_type: EntryType | undefined = undefined;
    if (createHeader)
      entry_type = (createHeader.header.content as Create).entry_type;

    return {
      entry,
      entry_type: entry_type as EntryType,
      deletes: entryDetails.deletes as SignedHeaderHashed<Delete>[],
      updates: entryDetails.updates as SignedHeaderHashed<Update>[],
      live_headers: entryDetails.headers as SignedHeaderHashed<Create>[],
    };
  }

  public async handle_get_element(
    header_hash: HeaderHash,
    options: GetOptions
  ): Promise<GetElementResponse | undefined> {
    if (this.state.metadata.misc_meta.get(header_hash) !== 'StoreElement') {
      return undefined;
    }

    const header = this.state.CAS.get(header_hash) as SignedHeaderHashed;
    let maybe_entry: Entry | undefined = undefined;
    let validation_status: ValidationStatus = ValidationStatus.Valid;

    if (header) {
      if (
        (header as SignedHeaderHashed<NewEntryHeader>).header.content.entry_hash
      ) {
        const entryHash = (header as SignedHeaderHashed<NewEntryHeader>).header
          .content.entry_hash;
        maybe_entry = this.state.CAS.get(entryHash);
      }
    } else {
      validation_status = ValidationStatus.Rejected;
    }

    const modifiers = getHeaderModifiers(this.state, header_hash);

    return {
      deletes: modifiers.deletes,
      updates: modifiers.updates,
      signed_header: header,
      validation_status,
      maybe_entry,
    };
  }

  public async handle_get_links(
    base_address: EntryHash,
    options: GetLinksOptions
  ): Promise<GetLinksResponse> {
    return getLinksForEntry(this.state, base_address);
  }
}
