import {
  HeaderHashB64,
  Element,
  Dictionary,
  DnaHashB64,
} from '@holochain-open-dev/core-types';
import {
  AgentPubKey,
  Dna,
  HeaderType,
  CellId,
  DhtOp,
  SignedHeaderHashed,
  NewEntryHeader,
  Delete,
  ZomeCallCapGrant,
  Update,
  Entry,
  CapSecret,
  DnaHash,
  HeaderHash,
} from '@holochain/conductor-api';
import { areEqual } from '../../../processors/hash';

import { HoloHashMap } from '../../../processors/holo-hash-map';
import { CellState } from '../state';
import { getAllAuthoredHeaders } from './get';

export function getTipOfChain(cellState: CellState): HeaderHash {
  return cellState.sourceChain[cellState.sourceChain.length - 1];
}

export function getAuthor(cellState: CellState): AgentPubKey {
  return getHeaderAt(cellState, 0).header.content.author;
}

export function getDnaHash(state: CellState): DnaHash {
  const firstHeaderHash = state.sourceChain[state.sourceChain.length - 1];

  const dna: SignedHeaderHashed<Dna> = state.CAS.get(firstHeaderHash);
  return dna.header.content.hash;
}

export function getHeaderAt(
  cellState: CellState,
  index: number
): SignedHeaderHashed {
  const headerHash = cellState.sourceChain[index];
  return cellState.CAS.get(headerHash);
}

export function getNextHeaderSeq(cellState: CellState): number {
  return cellState.sourceChain.length;
}

export function getElement(state: CellState, headerHash: HeaderHash): Element {
  const signed_header: SignedHeaderHashed = state.CAS.get(headerHash);

  let entry;
  if (
    signed_header.header.content.type == HeaderType.Create ||
    signed_header.header.content.type == HeaderType.Update
  ) {
    entry = state.CAS.get(signed_header.header.content.entry_hash);
  }
  return { signed_header, entry };
}

export function getCellId(state: CellState): CellId {
  const author = getAuthor(state);
  const dna = getDnaHash(state);
  return [dna, author];
}

export function getNonPublishedDhtOps(state: CellState): HoloHashMap<DhtOp> {
  const nonPublishedDhtOps: HoloHashMap<DhtOp> = new HoloHashMap();
  for (const dhtOpHash of state.authoredDHTOps.keys()) {
    const authoredValue = state.authoredDHTOps.get(dhtOpHash);
    if (authoredValue.last_publish_time === undefined) {
      nonPublishedDhtOps.put(dhtOpHash, authoredValue.op);
    }
  }

  return nonPublishedDhtOps;
}

export function valid_cap_grant(
  state: CellState,
  zome: string,
  fnName: string,
  provenance: AgentPubKey,
  secret: CapSecret | undefined
): boolean {
  if (areEqual(provenance, getCellId(state)[1])) return true;

  const aliveCapGrantsHeaders: HoloHashMap<SignedHeaderHashed<NewEntryHeader>> =
    new HoloHashMap();

  const allHeaders = getAllAuthoredHeaders(state);

  for (const header of allHeaders) {
    if (isCapGrant(header)) {
      aliveCapGrantsHeaders.put(
        header.header.hash,
        header as SignedHeaderHashed<NewEntryHeader>
      );
    }
  }

  for (const header of allHeaders) {
    const headerContent = header.header.content;
    if (
      (headerContent as Update).original_header_address &&
      aliveCapGrantsHeaders.has(
        (headerContent as Update).original_header_address
      )
    ) {
      aliveCapGrantsHeaders.delete(
        (headerContent as Update).original_header_address
      );
    }
    if (
      (headerContent as Delete).deletes_address &&
      aliveCapGrantsHeaders.has((headerContent as Delete).deletes_address)
    ) {
      aliveCapGrantsHeaders.delete((headerContent as Delete).deletes_address);
    }
  }

  const aliveCapGrants: Array<ZomeCallCapGrant> = aliveCapGrantsHeaders
    .values()
    .map(
      headerHash =>
        (state.CAS.get(headerHash.header.content.entry_hash) as Entry).content
    );

  return !!aliveCapGrants.find(capGrant =>
    isCapGrantValid(capGrant, zome, fnName, provenance, secret)
  );
}

function isCapGrantValid(
  capGrant: ZomeCallCapGrant,
  zome: string,
  fnName: string,
  check_agent: AgentPubKey,
  check_secret: CapSecret | undefined
): boolean {
  if (!capGrant.functions.find(fn => fn.fn_name === fnName && fn.zome === zome))
    return false;

  if (capGrant.access === 'Unrestricted') return true;
  else if (
    (
      capGrant.access as {
        Assigned: { assignees: AgentPubKey[]; secret: CapSecret };
      }
    ).Assigned
  ) {
    return !!(
      capGrant.access as {
        Assigned: {
          secret: CapSecret;
          assignees: AgentPubKey[];
        };
      }
    ).Assigned.assignees.find(a => areEqual(a, check_agent));
  } else {
    return (
      (
        capGrant.access as {
          Transferable: { secret: CapSecret };
        }
      ).Transferable.secret === check_secret
    );
  }
}

function isCapGrant(header: SignedHeaderHashed): boolean {
  const content = header.header.content;
  return !!(
    (content as NewEntryHeader).entry_hash &&
    (content as NewEntryHeader).entry_type === 'CapGrant'
  );
}
