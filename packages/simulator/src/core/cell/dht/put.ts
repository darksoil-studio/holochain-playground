import isEqual from 'lodash-es/isEqual';
import {
  ValidationReceipt,
  EntryDhtStatus,
  DhtOpHash,
} from '@holochain-open-dev/core-types';
import {
  DhtOp,
  DhtOpType,
  HeaderType,
  SignedHeaderHashed,
  NewEntryHeader,
  HeaderHash,
  EntryHash,
  AnyDhtHash,
  Header,
  getDhtOpType,
  getDhtOpHeader,
  Update,
  Delete,
  CreateLink,
  DeleteLink,
  getDhtOpSignature,
} from '@holochain/conductor-api';
import {
  ChainStatus,
  LinkMetaKey,
  LinkMetaVal,
  SysMetaVal,
} from '../state/metadata';

import {
  ValidationLimboValue,
  CellState,
  IntegrationLimboValue,
  IntegratedDhtOpsValue,
} from '../state';

import { getHeadersForEntry } from './get';
import { HoloHashMap } from '../../../processors/holo-hash-map';
import { getEntry } from '../utils';
import { hash, HashType } from '../../../processors/hash';

export const putValidationLimboValue =
  (dhtOpHash: DhtOpHash, validationLimboValue: ValidationLimboValue) =>
  (state: CellState) => {
    state.validationLimbo.put(dhtOpHash, validationLimboValue);
  };

export const putValidationReceipt =
  (dhtOpHash: DhtOpHash, validationReceipt: ValidationReceipt) =>
  (state: CellState) => {
    if (!state.validationReceipts.has(dhtOpHash)) {
      state.validationReceipts.put(dhtOpHash, new HoloHashMap());
    }

    state.validationReceipts
      .get(dhtOpHash)
      .put(validationReceipt.validator, validationReceipt);
  };

export const deleteValidationLimboValue =
  (dhtOpHash: DhtOpHash) => (state: CellState) => {
    state.validationLimbo.delete(dhtOpHash);
  };

export const putIntegrationLimboValue =
  (dhtOpHash: DhtOpHash, integrationLimboValue: IntegrationLimboValue) =>
  (state: CellState) => {
    state.integrationLimbo.put(dhtOpHash, integrationLimboValue);
  };

export const putDhtOpData = (dhtOp: DhtOp) => (state: CellState) => {
  const header = getDhtOpHeader(dhtOp);
  const headerHash = hash(header, HashType.HEADER);

  const ssh: SignedHeaderHashed = {
    header: {
      content: header,
      hash: headerHash,
    },
    signature: getDhtOpSignature(dhtOp),
  };
  state.CAS.put(headerHash, ssh);

  const entry = getEntry(dhtOp);

  if (entry) {
    state.CAS.put((header as NewEntryHeader).entry_hash, entry);
  }
};

export const putDhtOpMetadata = (dhtOp: DhtOp) => (state: CellState) => {
  const type = getDhtOpType(dhtOp);
  const header = getDhtOpHeader(dhtOp);
  const headerHash = hash(header, HashType.HEADER);

  if (type === DhtOpType.StoreElement) {
    state.metadata.misc_meta.put(headerHash, 'StoreElement');
  } else if (type === DhtOpType.StoreEntry) {
    const entryHash = (header as NewEntryHeader).entry_hash;

    if (header.type === HeaderType.Update) {
      register_header_on_basis(headerHash, header, headerHash)(state);
      register_header_on_basis(entryHash, header, headerHash)(state);
    }

    register_header_on_basis(entryHash, header, headerHash)(state);
    update_entry_dht_status(entryHash)(state);
  } else if (type === DhtOpType.RegisterAgentActivity) {
    state.metadata.misc_meta.put(headerHash, {
      ChainItem: header.timestamp,
    });

    state.metadata.misc_meta.put(header.author, {
      ChainStatus: ChainStatus.Valid,
    });
  } else if (
    type === DhtOpType.RegisterUpdatedContent ||
    type === DhtOpType.RegisterUpdatedElement
  ) {
    register_header_on_basis(
      (header as Update).original_header_address,
      header,
      headerHash
    )(state);
    register_header_on_basis(
      (header as Update).original_entry_address,
      header,
      headerHash
    )(state);
    update_entry_dht_status((header as Update).original_entry_address)(state);
  } else if (
    type === DhtOpType.RegisterDeletedBy ||
    type === DhtOpType.RegisterDeletedEntryHeader
  ) {
    register_header_on_basis(
      (header as Delete).deletes_address,
      header,
      headerHash
    )(state);
    register_header_on_basis(
      (header as Delete).deletes_entry_address,
      header,
      headerHash
    )(state);

    update_entry_dht_status((header as Delete).deletes_entry_address)(state);
  } else if (type === DhtOpType.RegisterAddLink) {
    const key: LinkMetaKey = {
      base: (header as CreateLink).base_address,
      header_hash: headerHash,
      tag: (header as CreateLink).tag,
      zome_id: (header as CreateLink).zome_id,
    };
    const value: LinkMetaVal = {
      link_add_hash: headerHash,
      tag: (header as CreateLink).tag,
      target: (header as CreateLink).target_address,
      timestamp: (header as CreateLink).timestamp,
      zome_id: (header as CreateLink).zome_id,
    };
    state.metadata.link_meta.push({ key, value });
  } else if (type === DhtOpType.RegisterRemoveLink) {
    const val: SysMetaVal = {
      DeleteLink: headerHash,
    };

    putSystemMetadata((header as DeleteLink).link_add_address, val)(state);
  }
};

function is_header_alive(state: CellState, headerHash: HeaderHash): boolean {
  const dhtHeaders = state.metadata.system_meta.get(headerHash);
  if (dhtHeaders) {
    const isHeaderDeleted = !!dhtHeaders.find(
      metaVal =>
        (
          metaVal as {
            Delete: HeaderHash;
          }
        ).Delete
    );
    return !isHeaderDeleted;
  }
  return true;
}

const update_entry_dht_status =
  (entryHash: EntryHash) => (state: CellState) => {
    const headers = getHeadersForEntry(state, entryHash);

    const entryIsAlive = headers.some(header =>
      is_header_alive(state, header.header.hash)
    );

    state.metadata.misc_meta.put(entryHash, {
      EntryStatus: entryIsAlive ? EntryDhtStatus.Live : EntryDhtStatus.Dead,
    });
  };

export const register_header_on_basis =
  (basis: AnyDhtHash, header: Header, headerHash: HeaderHash) =>
  (state: CellState) => {
    let value: SysMetaVal | undefined;
    const headerType = header.type;
    if (headerType === HeaderType.Create) {
      value = { NewEntry: headerHash };
    } else if (headerType === HeaderType.Update) {
      value = { Update: headerHash };
    } else if (headerType === HeaderType.Delete) {
      value = { Delete: headerHash };
    }

    if (value) {
      putSystemMetadata(basis, value)(state);
    }
  };

export const putSystemMetadata =
  (basis: AnyDhtHash, value: SysMetaVal) => (state: CellState) => {
    if (!state.metadata.system_meta.has(basis)) {
      state.metadata.system_meta.put(basis, []);
    }

    if (!state.metadata.system_meta.get(basis).find(v => isEqual(v, value))) {
      state.metadata.system_meta.get(basis).push(value);
    }
  };

export const putDhtOpToIntegrated =
  (dhtOpHash: DhtOpHash, integratedValue: IntegratedDhtOpsValue) =>
  (state: CellState) => {
    state.integratedDHTOps.put(dhtOpHash, integratedValue);
  };
