import {
  Dna,
  HeaderType,
  AgentValidationPkg,
  Entry,
  EntryType,
  Create,
  Update,
  SignedHeaderHashed,
  Header,
  CreateLink,
  Delete,
  DeleteLink,
  AgentPubKey,
  DnaHash,
  EntryHash,
  HeaderHash,
} from '@holochain/conductor-api';

import { hash, HashType } from '../../../processors/hash';
import { CellState } from '../state';
import { hashEntry } from '../utils';
import { getAuthor, getNextHeaderSeq, getTipOfChain } from './utils';

export function buildShh(header: Header): SignedHeaderHashed {
  return {
    header: {
      content: header,
      hash: hash(header, HashType.HEADER),
    },
    signature: Uint8Array.from([]),
  };
}

export function buildDna(dnaHash: DnaHash, agentId: AgentPubKey): Dna {
  const dna: Dna = {
    author: agentId,
    hash: dnaHash,
    timestamp: Date.now() * 1000,
    type: HeaderType.Dna,
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
    type: HeaderType.AgentValidationPkg,
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
    type: HeaderType.Create,
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
    type: HeaderType.CreateLink,
  };
  return create_link;
}

export function buildUpdate(
  state: CellState,
  entry: Entry,
  entry_type: EntryType,
  original_entry_address: EntryHash,
  original_header_address: HeaderHash
): Update {
  const entry_hash = hashEntry(entry);

  const update: Update = {
    ...buildCommon(state),
    entry_hash,
    entry_type,
    original_entry_address,
    original_header_address,

    type: HeaderType.Update,
  };
  return update;
}

export function buildDelete(
  state: CellState,
  deletes_address: HeaderHash,
  deletes_entry_address: EntryHash
): Delete {
  const deleteHeader: Delete = {
    ...buildCommon(state),
    type: HeaderType.Delete,
    deletes_address,
    deletes_entry_address,
  };
  return deleteHeader;
}

export function buildDeleteLink(
  state: CellState,
  base_address: EntryHash,
  link_add_address: HeaderHash
): DeleteLink {
  const deleteHeader: DeleteLink = {
    ...buildCommon(state),
    type: HeaderType.DeleteLink,
    base_address,
    link_add_address,
  };
  return deleteHeader;
}
/** Helpers */

function buildCommon(state: CellState) {
  const author = getAuthor(state);
  const header_seq = getNextHeaderSeq(state);
  const prev_header = getTipOfChain(state);
  const timestamp = Date.now() * 1000;

  return {
    author,
    header_seq,
    prev_header,
    timestamp,
  };
}
