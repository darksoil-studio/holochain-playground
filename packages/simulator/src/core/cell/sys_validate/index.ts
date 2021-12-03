import {
  AgentPubKey,
  AppEntryType,
  Create,
  Entry,
  EntryHash,
  EntryType,
  Header,
  HeaderType,
  NewEntryHeader,
  Signature,
  Timestamp,
  Update,
} from '@holochain/conductor-api';


import { EntryDef, SimulatedDna } from '../../../dnas/simulated-dna';
import { areEqual } from '../../../processors/hash';
import { Metadata } from '../state/metadata';
import { hashEntry } from '../utils';

// From https://github.com/holochain/holochain/blob/develop/crates/holochain/src/core/sys_validate.rs

/// Verify the signature for this header
export async function verify_header_signature(
  sig: Signature,
  header: Header
): Promise<boolean> {
  return true; // TODO: actually implement signatures
}

/// Verify the author key was valid at the time
/// of signing with dpki
/// TODO: This is just a stub until we have dpki.
export async function author_key_is_valid(
  author: AgentPubKey
): Promise<boolean> {
  return true;
}

export function check_prev_header(header: Header): void {
  if (header.type === HeaderType.Dna) return;
  if (header.header_seq <= 0)
    throw new Error(`Non-Dna Header contains a 0 or less header_seq`);
  if (!header.prev_header)
    throw new Error(
      `Non-Dna Header doesn't contain a reference to the previous header`
    );
}

export function check_valid_if_dna(header: Header, metadata: Metadata): void {
  if (metadata.misc_meta.get(header.author))
    throw new Error(
      `Trying to validate a Dna header when the agent already has committed other headers`
    );
}

export function check_chain_rollback() {
  //TODO
}

export function check_spam() {
  //TODO
}

export function check_prev_timestamp(
  header: Header,
  prev_header: Header
): void {
  const tsToMillis = (t: Timestamp) => Math.floor(t / 1000);

  if (tsToMillis(header.timestamp) <= tsToMillis(prev_header.timestamp)) {
    // TODO: find out why this isn't working and fix it
    /* throw new Error(
      `New header must have a greater timestamp than any previous one`
    ); */
  }
}

export function check_prev_seq(header: Header, prev_header: Header): void {
  const prev_seq = (prev_header as Create).header_seq
    ? (prev_header as Create).header_seq
    : 0;
  if (
    !(
      (header as Create).header_seq > 0 &&
      (header as Create).header_seq === prev_seq + 1
    )
  )
    throw new Error(
      `Immediate following header must have as header_seq the previous one +1`
    );
}

export function check_entry_type(entry_type: EntryType, entry: Entry): void {
  if (entry_type === 'Agent' && entry.entry_type === 'Agent') return;
  if (entry_type === 'CapClaim' && entry.entry_type === 'CapClaim') return;
  if (entry_type === 'CapGrant' && entry.entry_type === 'CapGrant') return;
  if ((entry_type as { App: AppEntryType }).App && entry.entry_type === 'App')
    return;
  throw new Error(`Entry types don't match`);
}

export function check_app_entry_type(
  entry_type: AppEntryType,
  simulated_dna: SimulatedDna
): EntryDef {
  const zome_index = entry_type.zome_id;
  const entry_index = entry_type.id;

  const zome = simulated_dna.zomes[zome_index];
  if (!zome)
    throw new Error(`Trying to validate an entry for a non existent zome`);

  const entry_def = zome.entry_defs[entry_index];
  if (!entry_def)
    throw new Error(
      `Trying to validate an entry which does not have any entry definition`
    );

  if (entry_def.visibility !== entry_type.visibility)
    throw new Error(
      `Trying to validate an entry with visibility not matching its definition`
    );
  return entry_def;
}

export function check_not_private(entry_def: EntryDef): void {
  if (entry_def.visibility === 'Private')
    throw new Error(`Trying to validate as public a private entry type`);
}

export function check_entry_hash(hash: EntryHash, entry: Entry): void {
  if (!areEqual(hashEntry(entry), hash))
    throw new Error(`Entry hash is invalid`);
}

export function check_new_entry_header(header: Header): void {
  if (!(header.type === HeaderType.Create || header.type === HeaderType.Update))
    throw new Error(
      `A header refering a new entry is not of type Create or Update`
    );
}

export const MAX_ENTRY_SIZE = 16 * 1000 * 1000;

export function check_entry_size(entry: Entry): void {
  if (JSON.stringify(entry.content).length > MAX_ENTRY_SIZE)
    throw new Error(`Entry size exceeds the MAX_ENTRY_SIZE`);
}

export const MAX_TAG_SIZE = 400;

export function check_tag_size(tag: string): void {
  if (tag.length > MAX_TAG_SIZE)
    throw new Error(`The given tag size exceeds the MAX_TAG_SIZE`);
}

export function check_update_reference(
  update: Update,
  original_entry_header: NewEntryHeader
): void {
  if (
    JSON.stringify(update.entry_type) !==
    JSON.stringify(original_entry_header.entry_type)
  )
    throw new Error(`An entry must be updated to the same entry type`);
}
