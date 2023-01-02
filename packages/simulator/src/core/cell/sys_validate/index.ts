import {
  AgentPubKey,
  AppEntryDef,
  Create,
  Entry,
  EntryHash,
  EntryType,
  Action,
  ActionType,
  NewEntryAction,
  Signature,
  Timestamp,
  Update,
} from '@holochain/client';

import { EntryDef, SimulatedDna } from '../../../dnas/simulated-dna';
import { areEqual } from '../../../processors/hash';
import { Metadata } from '../state/metadata';
import { hashEntry } from '../utils';

// From https://github.com/holochain/holochain/blob/develop/crates/holochain/src/core/sys_validate.rs

/// Verify the signature for this action
export async function verify_action_signature(
  sig: Signature,
  action: Action
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

export function check_prev_action(action: Action): void {
  if (action.type === ActionType.Dna) return;
  if (action.action_seq <= 0)
    throw new Error(`Non-Dna Action contains a 0 or less action_seq`);
  if (!action.prev_action)
    throw new Error(
      `Non-Dna Action doesn't contain a reference to the previous action`
    );
}

export function check_valid_if_dna(action: Action, metadata: Metadata): void {
  if (metadata.misc_meta.get(action.author))
    throw new Error(
      `Trying to validate a Dna action when the agent already has committed other actions`
    );
}

export function check_chain_rollback() {
  //TODO
}

export function check_spam() {
  //TODO
}

export function check_prev_timestamp(
  action: Action,
  prev_action: Action
): void {
  const tsToMillis = (t: Timestamp) => Math.floor(t / 1000);

  if (tsToMillis(action.timestamp) <= tsToMillis(prev_action.timestamp)) {
    // TODO: find out why this isn't working and fix it
    /* throw new Error(
      `New action must have a greater timestamp than any previous one`
    ); */
  }
}

export function check_prev_seq(action: Action, prev_action: Action): void {
  const prev_seq = (prev_action as Create).action_seq
    ? (prev_action as Create).action_seq
    : 0;
  if (
    !(
      (action as Create).action_seq > 0 &&
      (action as Create).action_seq === prev_seq + 1
    )
  )
    throw new Error(
      `Immediate following action must have as action_seq the previous one +1`
    );
}

export function check_entry_type(entry_type: EntryType, entry: Entry): void {
  if (entry_type === 'Agent' && entry.entry_type === 'Agent') return;
  if (entry_type === 'CapClaim' && entry.entry_type === 'CapClaim') return;
  if (entry_type === 'CapGrant' && entry.entry_type === 'CapGrant') return;
  if ((entry_type as { App: AppEntryDef }).App && entry.entry_type === 'App')
    return;
  throw new Error(`Entry types don't match`);
}

export function check_app_entry_type(
  entry_type: AppEntryDef,
  simulated_dna: SimulatedDna
): EntryDef {
  const zome_index = entry_type.zome_index;
  const entry_index = entry_type.entry_index;

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
  if ('Private' in entry_def.visibility)
    throw new Error(`Trying to validate as public a private entry type`);
}

export function check_entry_hash(hash: EntryHash, entry: Entry): void {
  if (!areEqual(hashEntry(entry), hash))
    throw new Error(`Entry hash is invalid`);
}

export function check_new_entry_action(action: Action): void {
  if (!(action.type === ActionType.Create || action.type === ActionType.Update))
    throw new Error(
      `A action refering a new entry is not of type Create or Update`
    );
}

export const MAX_ENTRY_SIZE = 16 * 1000 * 1000;

export function check_entry_size(entry: Entry): void {
  if (JSON.stringify(entry.entry).length > MAX_ENTRY_SIZE)
    throw new Error(`Entry size exceeds the MAX_ENTRY_SIZE`);
}

export const MAX_TAG_SIZE = 400;

export function check_tag_size(tag: string): void {
  if (tag.length > MAX_TAG_SIZE)
    throw new Error(`The given tag size exceeds the MAX_TAG_SIZE`);
}

export function check_update_reference(
  update: Update,
  original_entry_action: NewEntryAction
): void {
  if (
    JSON.stringify(update.entry_type) !==
    JSON.stringify(original_entry_action.entry_type)
  )
    throw new Error(`An entry must be updated to the same entry type`);
}
