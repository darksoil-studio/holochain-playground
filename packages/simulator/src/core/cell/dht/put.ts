import {
	Action,
	ActionHash,
	ActionType,
	AnyDhtHash,
	ChainOp,
	ChainOpType,
	CreateLink,
	Delete,
	DeleteLink,
	DhtOp,
	EntryHash,
	NewEntryAction,
	SignedActionHashed,
	Update,
	encodeHashToBase64,
} from '@holochain/client';
import {
	DhtOpHash,
	EntryDhtStatus,
	ValidationReceipt,
} from '@darksoil-studio/holochain-core-types';
import { HashType, HoloHashMap, hash, hashAction } from '@darksoil-studio/holochain-utils';
import isEqual from 'lodash-es/isEqual.js';

import {
	CellState,
	IntegratedDhtOpsValue,
	IntegrationLimboValue,
	ValidationLimboValue,
} from '../state.js';
import {
	ChainStatus,
	LinkMetaKey,
	LinkMetaVal,
	SysMetaVal,
} from '../state/metadata.js';
import {
	getDhtOpAction,
	getDhtOpSignature,
	getDhtOpType,
	getEntry,
	isWarrantOp,
} from '../utils.js';
import { getActionsForEntry } from './get.js';

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
	if (isWarrantOp(dhtOp)) {
		return;
	}
	const chainOp = (dhtOp as { ChainOp: ChainOp }).ChainOp;

	const action = getDhtOpAction(chainOp);
	const actionHash = hashAction(action);

	const ssh: SignedActionHashed = {
		hashed: {
			content: action,
			hash: actionHash,
		},
		signature: getDhtOpSignature(chainOp),
	};
	state.CAS.set(actionHash, ssh);

	const entry = getEntry(dhtOp);
	if (entry) {
		state.CAS.set((action as NewEntryAction).entry_hash, entry);
	}
};

export const putDhtOpMetadata = (dhtOp: DhtOp) => (state: CellState) => {
	if (isWarrantOp(dhtOp)) {
		return;
	}
	const chainOp = (dhtOp as { ChainOp: ChainOp }).ChainOp;
	const type = getDhtOpType(chainOp);
	const action = getDhtOpAction(chainOp);
	const actionHash = hashAction(action);

	if (type === ChainOpType.StoreRecord) {
		state.metadata.misc_meta.set(actionHash, 'StoreRecord');
	} else if (type === ChainOpType.StoreEntry) {
		const entryHash = (action as NewEntryAction).entry_hash;

		if (action.type === ActionType.Update) {
			register_action_on_basis(actionHash, action, actionHash)(state);
			register_action_on_basis(entryHash, action, actionHash)(state);
		}

		register_action_on_basis(entryHash, action, actionHash)(state);
		update_entry_dht_status(entryHash)(state);
	} else if (type === ChainOpType.RegisterAgentActivity) {
		state.metadata.misc_meta.set(actionHash, {
			ChainItem: action.timestamp,
		});

		state.metadata.misc_meta.set(action.author, {
			ChainStatus: ChainStatus.Valid,
		});

		const previousActivity = state.metadata.activity.get(action.author) || [];
		state.metadata.activity.set(action.author, [
			...previousActivity,
			actionHash,
		]);
	} else if (
		type === ChainOpType.RegisterUpdatedContent ||
		type === ChainOpType.RegisterUpdatedRecord
	) {
		register_action_on_basis(
			(action as Update).original_action_address,
			action,
			actionHash,
		)(state);
		register_action_on_basis(
			(action as Update).original_entry_address,
			action,
			actionHash,
		)(state);
		update_entry_dht_status((action as Update).original_entry_address)(state);
	} else if (
		type === ChainOpType.RegisterDeletedBy ||
		type === ChainOpType.RegisterDeletedEntryAction
	) {
		register_action_on_basis(
			(action as Delete).deletes_address,
			action,
			actionHash,
		)(state);
		register_action_on_basis(
			(action as Delete).deletes_entry_address,
			action,
			actionHash,
		)(state);

		update_entry_dht_status((action as Delete).deletes_entry_address)(state);
	} else if (type === ChainOpType.RegisterAddLink) {
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
	} else if (type === ChainOpType.RegisterRemoveLink) {
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
			metaVal =>
				(
					metaVal as {
						Delete: ActionHash;
					}
				).Delete,
		);
		return !isActionDeleted;
	}
	return true;
}

const update_entry_dht_status =
	(entryHash: EntryHash) => (state: CellState) => {
		const actions = getActionsForEntry(state, entryHash);

		const entryIsAlive = actions.some(action =>
			is_action_alive(state, action.hashed.hash),
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

		if (!state.metadata.system_meta.get(basis).find(v => isEqual(v, value))) {
			state.metadata.system_meta.get(basis).push(value);
		}
	};

export const putDhtOpToIntegrated =
	(dhtOpHash: DhtOpHash, integratedValue: IntegratedDhtOpsValue) =>
	(state: CellState) => {
		state.integratedDHTOps.set(dhtOpHash, integratedValue);
	};
