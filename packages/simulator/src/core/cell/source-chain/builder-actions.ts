import {
  Dna,
  ActionType,
  AgentValidationPkg,
  Entry,
  EntryType,
  Create,
  Update,
  SignedActionHashed,
  Action,
  CreateLink,
  Delete,
  DeleteLink,
  AgentPubKey,
  DnaHash,
  EntryHash,
  ActionHash,
} from '@holochain/client';
import { hash, HashType } from '@holochain-open-dev/utils';

import { CellState } from '../state.js';
import { hashEntry } from '../utils.js';
import { getAuthor, getNextActionSeq, getTipOfChain } from './utils.js';

export function buildShh(action: Action): SignedActionHashed {
  return {
    hashed: {
      content: action,
      hash: hash(action, HashType.ACTION),
    },
    signature: Uint8Array.from([]),
  };
}

export function buildDna(dnaHash: DnaHash, agentId: AgentPubKey): Dna {
  const dna: Dna = {
    author: agentId,
    hash: dnaHash,
    timestamp: Date.now() * 1000,
    type: ActionType.Dna,
  };

  return dna;
}

export function buildAgentValidationPkg(
  state: CellState,
  membrane_proof: any
): AgentValidationPkg {
  const pkg: AgentValidationPkg = {
    ...buildCommon(state),
    membrane_proof,
    type: ActionType.AgentValidationPkg,
  };
  return pkg;
}

export function buildCreate(
  state: CellState,
  entry: Entry,
  entry_type: EntryType
): Create {
  const entry_hash = hashEntry(entry);
  const create: Create = {
    ...buildCommon(state),
    entry_hash,
    entry_type,
    type: ActionType.Create,
  };
  return create;
}

export function buildCreateLink(
  state: CellState,
  zome_id: number,
  base: EntryHash,
  target: EntryHash,
  tag: any
): CreateLink {
  const create_link: CreateLink = {
    ...buildCommon(state),
    base_address: base,
    target_address: target,
    tag,
    zome_id,
    type: ActionType.CreateLink,
  };
  return create_link;
}

export function buildUpdate(
  state: CellState,
  entry: Entry,
  entry_type: EntryType,
  original_entry_address: EntryHash,
  original_action_address: ActionHash
): Update {
  const entry_hash = hashEntry(entry);

  const update: Update = {
    ...buildCommon(state),
    entry_hash,
    entry_type,
    original_entry_address,
    original_action_address,

    type: ActionType.Update,
  };
  return update;
}

export function buildDelete(
  state: CellState,
  deletes_address: ActionHash,
  deletes_entry_address: EntryHash
): Delete {
  const deleteAction: Delete = {
    ...buildCommon(state),
    type: ActionType.Delete,
    deletes_address,
    deletes_entry_address,
  };
  return deleteAction;
}

export function buildDeleteLink(
  state: CellState,
  base_address: EntryHash,
  link_add_address: ActionHash
): DeleteLink {
  const deleteAction: DeleteLink = {
    ...buildCommon(state),
    type: ActionType.DeleteLink,
    base_address,
    link_add_address,
  };
  return deleteAction;
}
/** Helpers */

function buildCommon(state: CellState) {
  const author = getAuthor(state);
  const action_seq = getNextActionSeq(state);
  const prev_action = getTipOfChain(state);
  const timestamp = Date.now() * 1000;

  return {
    author,
    action_seq,
    prev_action,
    timestamp,
  };
}
