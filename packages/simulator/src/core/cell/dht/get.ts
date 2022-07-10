import {
  Dictionary,
  DhtOpHashB64,
  EntryDhtStatus,
  EntryDetails,
  ValidationReceipt,
  EntryHashB64,
  ActionHashB64,
  DhtOpHash,
} from '@holochain-open-dev/core-types';
import {
  NewEntryAction,
  SignedActionHashed,
  DhtOpType,
  Update,
  Delete,
  CreateLink,
  DeleteLink,
  ActionType,
  Create,
  DhtOp,
  EntryHash,
  ActionHash,
  getDhtOpType,
  getDhtOpAction,
} from '@holochain/client';

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
import { getSysMetaValActionHash, LinkMetaVal } from '../state/metadata';

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

export function getActionsForEntry(
  state: CellState,
  entryHash: EntryHash
): SignedActionHashed[] {
  const entryMetadata = state.metadata.system_meta.get(entryHash);
  if (!entryMetadata) return [];

  return entryMetadata
    .map(h => {
      const hash = getSysMetaValActionHash(h);
      if (hash) {
        return state.CAS.get(hash);
      }
      return undefined;
    })
    .filter(action => !!action);
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
  const allActions = getActionsForEntry(state, entry_hash);
  const dhtStatus = getEntryDhtStatus(state, entry_hash);

  const live_actions: HoloHashMap<SignedActionHashed<Create>> =
    new HoloHashMap();
  const updates: HoloHashMap<SignedActionHashed<Update>> = new HoloHashMap();
  const deletes: HoloHashMap<SignedActionHashed<Delete>> = new HoloHashMap();

  for (const action of allActions) {
    const actionContent = (action as SignedActionHashed).hashed.content;

    if (
      (actionContent as Update).original_entry_address &&
      areEqual((actionContent as Update).original_entry_address, entry_hash)
    ) {
      updates.put(action.hashed.hash, action as SignedActionHashed<Update>);
    } else if (
      (actionContent as Create).entry_hash &&
      areEqual((actionContent as Create).entry_hash, entry_hash)
    ) {
      live_actions.put(
        action.hashed.hash,
        action as SignedActionHashed<Create>
      );
    } else if (
      areEqual((actionContent as Delete).deletes_entry_address, entry_hash)
    ) {
      deletes.put(action.hashed.hash, action as SignedActionHashed<Delete>);
    }
  }

  return {
    entry,
    actions: allActions,
    entry_dht_status: dhtStatus as EntryDhtStatus,
    updates: updates.values(),
    deletes: deletes.values(),
    rejected_actions: [], // TODO: after validation is implemented
  };
}

export function getActionModifiers(
  state: CellState,
  actionHash: ActionHash
): {
  updates: SignedActionHashed<Update>[];
  deletes: SignedActionHashed<Delete>[];
} {
  const allModifiers = state.metadata.system_meta.get(actionHash);
  if (!allModifiers)
    return {
      updates: [],
      deletes: [],
    };

  const updates = allModifiers
    .filter(m => (m as { Update: ActionHash }).Update)
    .map(m => state.CAS.get((m as { Update: ActionHash }).Update));
  const deletes = allModifiers
    .filter(m => (m as { Delete: ActionHash }).Delete)
    .map(m => state.CAS.get((m as { Delete: ActionHash }).Delete));

  return {
    updates,
    deletes,
  };
}

export function getAllHeldEntries(state: CellState): EntryHash[] {
  const newEntryActions = state.integratedDHTOps
    .values()
    .filter(dhtOpValue => getDhtOpType(dhtOpValue.op) === DhtOpType.StoreEntry)
    .map(dhtOpValue => getDhtOpAction(dhtOpValue.op));

  const allEntryHashes = newEntryActions.map(
    h => (h as NewEntryAction).entry_hash
  );

  return uniqWith(allEntryHashes, areEqual);
}

export function getAllHeldActions(state: CellState): ActionHash[] {
  const actions = state.integratedDHTOps
    .values()
    .filter(
      dhtOpValue => getDhtOpType(dhtOpValue.op) === DhtOpType.StoreRecord
    )
    .map(dhtOpValue => getDhtOpAction(dhtOpValue.op));

  const allActionHashes = actions.map(h => hash(h, HashType.ACTION));

  return uniqWith(allActionHashes, areEqual);
}

export function getAllAuthoredEntries(state: CellState): EntryHash[] {
  const allActions = state.authoredDHTOps
    .values()
    .map(dhtOpValue => getDhtOpAction(dhtOpValue.op));

  const newEntryActions: NewEntryAction[] = allActions.filter(
    h => (h as NewEntryAction).entry_hash
  ) as NewEntryAction[];

  return newEntryActions.map(h => h.entry_hash);
}

export function isHoldingEntry(
  state: CellState,
  entryHash: EntryHash
): boolean {
  return state.metadata.system_meta.get(entryHash) !== undefined;
}

export function isHoldingRecord(
  state: CellState,
  actionHash: ActionHash
): boolean {
  return state.metadata.misc_meta.get(actionHash) === 'StoreRecord';
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

  const link_adds: SignedActionHashed<CreateLink>[] = [];
  const link_removes: SignedActionHashed<DeleteLink>[] = [];

  for (const value of linkMetaVals) {
    const action = state.CAS.get(value.link_add_hash);

    if (action) {
      link_adds.push(action);
    }

    const removes = getRemovesOnLinkAdd(state, value.link_add_hash);

    for (const remove of removes) {
      const removeAction = state.CAS.get(remove);
      link_removes.push(removeAction);
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
  link_add_hash: ActionHash
): ActionHash[] {
  const metadata = state.metadata.system_meta.get(link_add_hash);

  if (!metadata) return [];

  const removes: ActionHash[] = [];
  for (const val of metadata) {
    if ((val as { DeleteLink: ActionHash }).DeleteLink) {
      removes.push((val as { DeleteLink: ActionHash }).DeleteLink);
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
      linkAdds.put(linkAdd.hashed.hash, linkAdd.hashed.content);
    }
  }

  for (const responses of getLinksResponses) {
    for (const linkRemove of responses.link_removes) {
      const removedAddress = linkRemove.hashed.content.link_add_address;

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

export function computeDhtStatus(allActionsForEntry: SignedActionHashed[]): {
  entry_dht_status: EntryDhtStatus;
  rejected_actions: SignedActionHashed[];
} {
  const aliveActions: HoloHashMap<SignedActionHashed | undefined> =
    new HoloHashMap();
  const rejected_actions: SignedActionHashed[] = [];

  for (const action of allActionsForEntry) {
    if (action.hashed.content.type === ActionType.Create) {
      aliveActions.put(action.hashed.hash, action);
    }
  }

  for (const action of allActionsForEntry) {
    if (
      action.hashed.content.type === ActionType.Update ||
      action.hashed.content.type === ActionType.Delete
    ) {
      if (aliveActions.has(action.hashed.hash))
        rejected_actions.push(
          aliveActions.get(action.hashed.hash) as SignedActionHashed
        );
      aliveActions.delete(action.hashed.hash);
    }
  }

  const isSomeActionAlive = aliveActions
    .values()
    .some(action => action !== undefined);

  // TODO: add more cases
  const entry_dht_status = isSomeActionAlive
    ? EntryDhtStatus.Live
    : EntryDhtStatus.Dead;

  return {
    entry_dht_status,
    rejected_actions,
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
