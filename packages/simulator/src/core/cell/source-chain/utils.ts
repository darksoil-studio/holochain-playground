import {
  AgentPubKey,
  Dna,
  ActionType,
  CellId,
  DhtOp,
  SignedActionHashed,
  NewEntryAction,
  Delete,
  ZomeCallCapGrant,
  Update,
  Entry,
  CapSecret,
  DnaHash,
  ActionHash,
  Record,
} from '@holochain/client';
import { areEqual } from '../../../processors/hash';

import { HoloHashMap } from '../../../processors/holo-hash-map';
import { CellState } from '../state';
import { getAllAuthoredActions } from './get';

export function getTipOfChain(cellState: CellState): ActionHash {
  return cellState.sourceChain[cellState.sourceChain.length - 1];
}

export function getAuthor(cellState: CellState): AgentPubKey {
  return getActionAt(cellState, 0).hashed.content.author;
}

export function getDnaHash(state: CellState): DnaHash {
  const firstActionHash = state.sourceChain[state.sourceChain.length - 1];

  const dna: SignedActionHashed<Dna> = state.CAS.get(firstActionHash);
  return dna.hashed.content.hash;
}

export function getActionAt(
  cellState: CellState,
  index: number
): SignedActionHashed {
  const actionHash = cellState.sourceChain[index];
  return cellState.CAS.get(actionHash);
}

export function getNextActionSeq(cellState: CellState): number {
  return cellState.sourceChain.length;
}

export function getRecord(state: CellState, actionHash: ActionHash): Record {
  const signed_action: SignedActionHashed = state.CAS.get(actionHash);

  let entry;
  if (
    signed_action.hashed.content.type == ActionType.Create ||
    signed_action.hashed.content.type == ActionType.Update
  ) {
    entry = state.CAS.get(signed_action.hashed.content.entry_hash);
  }
  return { signed_action, entry };
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

  const aliveCapGrantsActions: HoloHashMap<SignedActionHashed<NewEntryAction>> =
    new HoloHashMap();

  const allActions = getAllAuthoredActions(state);

  for (const action of allActions) {
    if (isCapGrant(action)) {
      aliveCapGrantsActions.put(
        action.hashed.hash,
        action as SignedActionHashed<NewEntryAction>
      );
    }
  }

  for (const action of allActions) {
    const actionContent = action.hashed.content;
    if (
      (actionContent as Update).original_action_address &&
      aliveCapGrantsActions.has(
        (actionContent as Update).original_action_address
      )
    ) {
      aliveCapGrantsActions.delete(
        (actionContent as Update).original_action_address
      );
    }
    if (
      (actionContent as Delete).deletes_address &&
      aliveCapGrantsActions.has((actionContent as Delete).deletes_address)
    ) {
      aliveCapGrantsActions.delete((actionContent as Delete).deletes_address);
    }
  }

  const aliveCapGrants: Array<ZomeCallCapGrant> = aliveCapGrantsActions
    .values()
    .map(
      actionHash =>
        (state.CAS.get(actionHash.hashed.content.entry_hash) as Entry).entry as ZomeCallCapGrant
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

function isCapGrant(action: SignedActionHashed): boolean {
  const content = action.hashed.content;
  return !!(
    (content as NewEntryAction).entry_hash &&
    (content as NewEntryAction).entry_type === 'CapGrant'
  );
}
