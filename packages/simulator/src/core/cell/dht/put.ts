import isEqual from 'lodash-es/isEqual.js';
import {
  ValidationReceipt,
  EntryDhtStatus,
  DhtOpHash,
} from '@holochain-open-dev/core-types';
import {
  DhtOp,
  DhtOpType,
  ActionType,
  SignedActionHashed,
  NewEntryAction,
  ActionHash,
  EntryHash,
  AnyDhtHash,
  Action,
  getDhtOpType,
  getDhtOpAction,
  Update,
  Delete,
  CreateLink,
  DeleteLink,
  getDhtOpSignature,
  encodeHashToBase64,
} from '@holochain/client';
import { hash, HashType, HoloHashMap } from '@holochain-open-dev/utils';

import {
  ChainStatus,
  LinkMetaKey,
  LinkMetaVal,
  SysMetaVal,
} from '../state/metadata.js';

import {
  ValidationLimboValue,
  CellState,
  IntegrationLimboValue,
  IntegratedDhtOpsValue,
} from '../state.js';

import { getActionsForEntry } from './get.js';
import { getEntry } from '../utils.js';

export const putValidationLimboValue =
  (dhtOpHash: DhtOpHash, validationLimboValue: ValidationLimboValue) =>
  (state: CellState) => {
    state.validationLimbo.set(dhtOpHash, validationLimboValue);
  };

export const putValidationReceipt =
  (dhtOpHash: DhtOpHash, validationReceipt: ValidationReceipt) =>
  (state: CellState) => {
    if (!state.validationReceipts.has(dhtOpHash)) {
      state.validationReceipts.set(dhtOpHash, new HoloHashMap());
    }

    state.validationReceipts
      .get(dhtOpHash)
      .set(validationReceipt.validator, validationReceipt);
  };

export const deleteValidationLimboValue =
  (dhtOpHash: DhtOpHash) => (state: CellState) => {
    state.validationLimbo.delete(dhtOpHash);
  };

export const putIntegrationLimboValue =
  (dhtOpHash: DhtOpHash, integrationLimboValue: IntegrationLimboValue) =>
  (state: CellState) => {
    state.integrationLimbo.set(dhtOpHash, integrationLimboValue);
  };

export const putDhtOpData = (dhtOp: DhtOp) => (state: CellState) => {
  const action = getDhtOpAction(dhtOp);
  const actionHash = hash(action, HashType.ACTION);

  const ssh: SignedActionHashed = {
    hashed: {
      content: action,
      hash: actionHash,
    },
    signature: getDhtOpSignature(dhtOp),
  };
  state.CAS.set(actionHash, ssh);

  const entry = getEntry(dhtOp);
  if (entry) {
    state.CAS.set((action as NewEntryAction).entry_hash, entry);
  }
};

export const putDhtOpMetadata = (dhtOp: DhtOp) => (state: CellState) => {
  const type = getDhtOpType(dhtOp);
  const action = getDhtOpAction(dhtOp);
  const actionHash = hash(action, HashType.ACTION);

  if (type === DhtOpType.StoreRecord) {
    state.metadata.misc_meta.set(actionHash, 'StoreRecord');
  } else if (type === DhtOpType.StoreEntry) {
    const entryHash = (action as NewEntryAction).entry_hash;

    if (action.type === ActionType.Update) {
      register_action_on_basis(actionHash, action, actionHash)(state);
      register_action_on_basis(entryHash, action, actionHash)(state);
    }

    register_action_on_basis(entryHash, action, actionHash)(state);
    update_entry_dht_status(entryHash)(state);
  } else if (type === DhtOpType.RegisterAgentActivity) {
    state.metadata.misc_meta.set(actionHash, {
      ChainItem: action.timestamp,
    });

    state.metadata.misc_meta.set(action.author, {
      ChainStatus: ChainStatus.Valid,
    });
  } else if (
    type === DhtOpType.RegisterUpdatedContent ||
    type === DhtOpType.RegisterUpdatedRecord
  ) {
    register_action_on_basis(
      (action as Update).original_action_address,
      action,
      actionHash
    )(state);
    register_action_on_basis(
      (action as Update).original_entry_address,
      action,
      actionHash
    )(state);
    update_entry_dht_status((action as Update).original_entry_address)(state);
  } else if (
    type === DhtOpType.RegisterDeletedBy ||
    type === DhtOpType.RegisterDeletedEntryAction
  ) {
    register_action_on_basis(
      (action as Delete).deletes_address,
      action,
      actionHash
    )(state);
    register_action_on_basis(
      (action as Delete).deletes_entry_address,
      action,
      actionHash
    )(state);

    update_entry_dht_status((action as Delete).deletes_entry_address)(state);
  } else if (type === DhtOpType.RegisterAddLink) {
    const key: LinkMetaKey = {
      base: (action as CreateLink).base_address,
      action_hash: actionHash,
      tag: (action as CreateLink).tag,
      link_type: (action as CreateLink).link_type,
      zome_index: (action as CreateLink).zome_index,
    };
    const value: LinkMetaVal = {
      link_add_hash: actionHash,
      tag: (action as CreateLink).tag,
      link_type: (action as CreateLink).link_type,
      target: (action as CreateLink).target_address,
      timestamp: (action as CreateLink).timestamp,
      zome_index: (action as CreateLink).zome_index,
    };

    state.metadata.link_meta.push({ key, value });
  } else if (type === DhtOpType.RegisterRemoveLink) {
    const val: SysMetaVal = {
      DeleteLink: actionHash,
    };
    putSystemMetadata((action as DeleteLink).link_add_address, val)(state);
  }
};

function is_action_alive(state: CellState, actionHash: ActionHash): boolean {
  const dhtActions = state.metadata.system_meta.get(actionHash);
  if (dhtActions) {
    const isActionDeleted = !!dhtActions.find(
      (metaVal) =>
        (
          metaVal as {
            Delete: ActionHash;
          }
        ).Delete
    );
    return !isActionDeleted;
  }
  return true;
}

const update_entry_dht_status =
  (entryHash: EntryHash) => (state: CellState) => {
    const actions = getActionsForEntry(state, entryHash);

    const entryIsAlive = actions.some((action) =>
      is_action_alive(state, action.hashed.hash)
    );

    state.metadata.misc_meta.set(entryHash, {
      EntryStatus: entryIsAlive ? EntryDhtStatus.Live : EntryDhtStatus.Dead,
    });
  };

export const register_action_on_basis =
  (basis: AnyDhtHash, action: Action, actionHash: ActionHash) =>
  (state: CellState) => {
    let value: SysMetaVal | undefined;
    const actionType = action.type;
    if (actionType === ActionType.Create) {
      value = { NewEntry: actionHash };
    } else if (actionType === ActionType.Update) {
      value = { Update: actionHash };
    } else if (actionType === ActionType.Delete) {
      value = { Delete: actionHash };
    }

    if (value) {
      putSystemMetadata(basis, value)(state);
    }
  };

export const putSystemMetadata =
  (basis: AnyDhtHash, value: SysMetaVal) => (state: CellState) => {
    if (!state.metadata.system_meta.has(basis)) {
      state.metadata.system_meta.set(basis, []);
    }

    if (!state.metadata.system_meta.get(basis).find((v) => isEqual(v, value))) {
      state.metadata.system_meta.get(basis).push(value);
    }
  };

export const putDhtOpToIntegrated =
  (dhtOpHash: DhtOpHash, integratedValue: IntegratedDhtOpsValue) =>
  (state: CellState) => {
    state.integratedDHTOps.set(dhtOpHash, integratedValue);
  };
