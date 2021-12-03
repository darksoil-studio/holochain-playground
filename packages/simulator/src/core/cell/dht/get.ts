import {
  Dictionary,
  DhtOpHashB64,
  EntryDhtStatus,
  EntryDetails,
  ValidationReceipt,
  EntryHashB64,
  HeaderHashB64,
  DhtOpHash,
} from '@holochain-open-dev/core-types';
import {
  NewEntryHeader,
  SignedHeaderHashed,
  DhtOpType,
  Update,
  Delete,
  CreateLink,
  DeleteLink,
  HeaderType,
  Create,
  DhtOp,
  EntryHash,
  HeaderHash,
  getDhtOpType,
  getDhtOpHeader,
} from '@holochain/conductor-api';

import { uniqWith } from 'lodash-es';
import { areEqual, hash, HashType } from '../../../processors/hash';
import { HoloHashMap } from '../../../processors/holo-hash-map';

import { GetLinksResponse, Link } from '../cascade/types';
import {
  CellState,
  ValidationLimboStatus,
  ValidationLimboValue,
  IntegrationLimboValue,
  IntegratedDhtOpsValue,
  ValidationStatus,
} from '../state';
import { getSysMetaValHeaderHash, LinkMetaVal } from '../state/metadata';

export function getValidationLimboDhtOps(
  state: CellState,
  statuses: ValidationLimboStatus[]
): HoloHashMap<ValidationLimboValue> {
  const pendingDhtOps: HoloHashMap<ValidationLimboValue> = new HoloHashMap();

  for (const [dhtOpHash, limboValue] of state.validationLimbo.entries()) {
    if (statuses.includes(limboValue.status)) {
      pendingDhtOps.put(dhtOpHash, limboValue);
    }
  }

  return pendingDhtOps;
}

export const getValidationReceipts =
  (dhtOpHash: DhtOpHash) =>
  (state: CellState): ValidationReceipt[] => {
    return state.validationReceipts.has(dhtOpHash)
      ? state.validationReceipts.get(dhtOpHash).values()
      : [];
  };

export function pullAllIntegrationLimboDhtOps(
  state: CellState
): HoloHashMap<IntegrationLimboValue> {
  const dhtOps = state.integrationLimbo;

  state.integrationLimbo = new HoloHashMap();

  return dhtOps;
}

export function getHeadersForEntry(
  state: CellState,
  entryHash: EntryHash
): SignedHeaderHashed[] {
  const entryMetadata = state.metadata.system_meta.get(entryHash);
  if (!entryMetadata) return [];

  return entryMetadata
    .map(h => {
      const hash = getSysMetaValHeaderHash(h);
      if (hash) {
        return state.CAS.get(hash);
      }
      return undefined;
    })
    .filter(header => !!header);
}

export function getEntryDhtStatus(
  state: CellState,
  entryHash: EntryHash
): EntryDhtStatus | undefined {
  const meta = state.metadata.misc_meta.get(entryHash);

  return meta
    ? (
        meta as {
          EntryStatus: EntryDhtStatus;
        }
      ).EntryStatus
    : undefined;
}

export function getEntryDetails(
  state: CellState,
  entry_hash: EntryHash
): EntryDetails {
  const entry = state.CAS.get(entry_hash);
  const allHeaders = getHeadersForEntry(state, entry_hash);
  const dhtStatus = getEntryDhtStatus(state, entry_hash);

  const live_headers: HoloHashMap<SignedHeaderHashed<Create>> =
    new HoloHashMap();
  const updates: HoloHashMap<SignedHeaderHashed<Update>> = new HoloHashMap();
  const deletes: HoloHashMap<SignedHeaderHashed<Delete>> = new HoloHashMap();

  for (const header of allHeaders) {
    const headerContent = (header as SignedHeaderHashed).header.content;

    if (
      (headerContent as Update).original_entry_address &&
      areEqual((headerContent as Update).original_entry_address, entry_hash)
    ) {
      updates.put(header.header.hash, header as SignedHeaderHashed<Update>);
    } else if (
      (headerContent as Create).entry_hash &&
      areEqual((headerContent as Create).entry_hash, entry_hash)
    ) {
      live_headers.put(
        header.header.hash,
        header as SignedHeaderHashed<Create>
      );
    } else if (
      areEqual((headerContent as Delete).deletes_entry_address, entry_hash)
    ) {
      deletes.put(header.header.hash, header as SignedHeaderHashed<Delete>);
    }
  }

  return {
    entry,
    headers: allHeaders,
    entry_dht_status: dhtStatus as EntryDhtStatus,
    updates: updates.values(),
    deletes: deletes.values(),
    rejected_headers: [], // TODO: after validation is implemented
  };
}

export function getHeaderModifiers(
  state: CellState,
  headerHash: HeaderHash
): {
  updates: SignedHeaderHashed<Update>[];
  deletes: SignedHeaderHashed<Delete>[];
} {
  const allModifiers = state.metadata.system_meta.get(headerHash);
  if (!allModifiers)
    return {
      updates: [],
      deletes: [],
    };

  const updates = allModifiers
    .filter(m => (m as { Update: HeaderHash }).Update)
    .map(m => state.CAS.get((m as { Update: HeaderHash }).Update));
  const deletes = allModifiers
    .filter(m => (m as { Delete: HeaderHash }).Delete)
    .map(m => state.CAS.get((m as { Delete: HeaderHash }).Delete));

  return {
    updates,
    deletes,
  };
}

export function getAllHeldEntries(state: CellState): EntryHash[] {
  const newEntryHeaders = state.integratedDHTOps
    .values()
    .filter(dhtOpValue => getDhtOpType(dhtOpValue.op) === DhtOpType.StoreEntry)
    .map(dhtOpValue => getDhtOpHeader(dhtOpValue.op));

  const allEntryHashes = newEntryHeaders.map(
    h => (h as NewEntryHeader).entry_hash
  );

  return uniqWith(allEntryHashes, areEqual);
}

export function getAllHeldHeaders(state: CellState): HeaderHash[] {
  const headers = state.integratedDHTOps
    .values()
    .filter(
      dhtOpValue => getDhtOpType(dhtOpValue.op) === DhtOpType.StoreElement
    )
    .map(dhtOpValue => getDhtOpHeader(dhtOpValue.op));

  const allHeaderHashes = headers.map(h => hash(h, HashType.HEADER));

  return uniqWith(allHeaderHashes, areEqual);
}

export function getAllAuthoredEntries(state: CellState): EntryHash[] {
  const allHeaders = state.authoredDHTOps
    .values()
    .map(dhtOpValue => getDhtOpHeader(dhtOpValue.op));

  const newEntryHeaders: NewEntryHeader[] = allHeaders.filter(
    h => (h as NewEntryHeader).entry_hash
  ) as NewEntryHeader[];

  return newEntryHeaders.map(h => h.entry_hash);
}

export function isHoldingEntry(
  state: CellState,
  entryHash: EntryHash
): boolean {
  return state.metadata.system_meta.get(entryHash) !== undefined;
}

export function isHoldingElement(
  state: CellState,
  headerHash: HeaderHash
): boolean {
  return state.metadata.misc_meta.get(headerHash) === 'StoreElement';
}

export function isHoldingDhtOp(
  state: CellState,
  dhtOpHash: DhtOpHash
): boolean {
  return !!state.integratedDHTOps.get(dhtOpHash);
}

export interface EntryDHTInfo {
  details: EntryDetails;
  links: LinkMetaVal[];
}

export function getDhtShard(state: CellState): HoloHashMap<EntryDHTInfo> {
  const heldEntries = getAllHeldEntries(state);

  const dhtShard: HoloHashMap<EntryDHTInfo> = new HoloHashMap();

  for (const entryHash of heldEntries) {
    dhtShard.put(entryHash, {
      details: getEntryDetails(state, entryHash),
      links: getCreateLinksForEntry(state, entryHash),
    });
  }

  return dhtShard;
}

export function getLinksForEntry(
  state: CellState,
  entryHash: EntryHash
): GetLinksResponse {
  const linkMetaVals = getCreateLinksForEntry(state, entryHash);

  const link_adds: SignedHeaderHashed<CreateLink>[] = [];
  const link_removes: SignedHeaderHashed<DeleteLink>[] = [];

  for (const value of linkMetaVals) {
    const header = state.CAS.get(value.link_add_hash);

    if (header) {
      link_adds.push(header);
    }

    const removes = getRemovesOnLinkAdd(state, value.link_add_hash);

    for (const remove of removes) {
      const removeHeader = state.CAS.get(remove);
      link_removes.push(removeHeader);
    }
  }

  return {
    link_adds,
    link_removes,
  };
}

export function getCreateLinksForEntry(
  state: CellState,
  entryHash: EntryHash
): LinkMetaVal[] {
  return state.metadata.link_meta
    .filter(({ key, value }) => areEqual(key.base, entryHash))
    .map(({ key, value }) => value);
}

export function getRemovesOnLinkAdd(
  state: CellState,
  link_add_hash: HeaderHash
): HeaderHash[] {
  const metadata = state.metadata.system_meta.get(link_add_hash);

  if (!metadata) return [];

  const removes: HeaderHash[] = [];
  for (const val of metadata) {
    if ((val as { DeleteLink: HeaderHash }).DeleteLink) {
      removes.push((val as { DeleteLink: HeaderHash }).DeleteLink);
    }
  }
  return removes;
}

export function getLiveLinks(
  getLinksResponses: Array<GetLinksResponse>
): Array<Link> {
  // Map and flatten adds
  const linkAdds: HoloHashMap<CreateLink | undefined> = new HoloHashMap();
  for (const responses of getLinksResponses) {
    for (const linkAdd of responses.link_adds) {
      linkAdds.put(linkAdd.header.hash, linkAdd.header.content);
    }
  }

  for (const responses of getLinksResponses) {
    for (const linkRemove of responses.link_removes) {
      const removedAddress = linkRemove.header.content.link_add_address;

      linkAdds.delete(removedAddress);
    }
  }

  const resultingLinks: Link[] = [];

  for (const liveLink of linkAdds.values()) {
    if (liveLink)
      resultingLinks.push({
        base: liveLink.base_address,
        target: liveLink.target_address,
        tag: liveLink.tag,
      });
  }

  return resultingLinks;
}

export function computeDhtStatus(allHeadersForEntry: SignedHeaderHashed[]): {
  entry_dht_status: EntryDhtStatus;
  rejected_headers: SignedHeaderHashed[];
} {
  const aliveHeaders: HoloHashMap<SignedHeaderHashed | undefined> =
    new HoloHashMap();
  const rejected_headers: SignedHeaderHashed[] = [];

  for (const header of allHeadersForEntry) {
    if (header.header.content.type === HeaderType.Create) {
      aliveHeaders.put(header.header.hash, header);
    }
  }

  for (const header of allHeadersForEntry) {
    if (
      header.header.content.type === HeaderType.Update ||
      header.header.content.type === HeaderType.Delete
    ) {
      if (aliveHeaders.has(header.header.hash))
        rejected_headers.push(
          aliveHeaders.get(header.header.hash) as SignedHeaderHashed
        );
      aliveHeaders.delete(header.header.hash);
    }
  }

  const isSomeHeaderAlive = aliveHeaders
    .values()
    .some(header => header !== undefined);

  // TODO: add more cases
  const entry_dht_status = isSomeHeaderAlive
    ? EntryDhtStatus.Live
    : EntryDhtStatus.Dead;

  return {
    entry_dht_status,
    rejected_headers,
  };
}

export function hasDhtOpBeenProcessed(
  state: CellState,
  dhtOpHash: DhtOpHash
): boolean {
  return (
    state.integrationLimbo.has(dhtOpHash) ||
    state.integratedDHTOps.has(dhtOpHash) ||
    state.validationLimbo.has(dhtOpHash)
  );
}

export function getIntegratedDhtOpsWithoutReceipt(
  state: CellState
): HoloHashMap<IntegratedDhtOpsValue> {
  const needReceipt: HoloHashMap<IntegratedDhtOpsValue> = new HoloHashMap();

  for (const [dhtOpHash, integratedValue] of state.integratedDHTOps.entries()) {
    if (integratedValue.send_receipt) {
      needReceipt.put(dhtOpHash, integratedValue);
    }
  }
  return needReceipt;
}
