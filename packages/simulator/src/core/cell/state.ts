import {
	ActionHash,
	AgentPubKey,
	DhtOp,
	DnaHash,
	HoloHash,
} from '@holochain/client';
import { DhtOpHash, ValidationReceipt } from '@tnesh-stack/core-types';
import { HoloHashMap } from '@tnesh-stack/utils';

import { location } from '../../processors/hash.js';
import { DhtArc, contains } from '../network/dht_arc.js';
import { Metadata } from './state/metadata.js';

export interface CellState {
	dnaHash: DnaHash;
	agentPubKey: AgentPubKey;
	sourceChain: Array<ActionHash>;
	CAS: HoloHashMap<HoloHash, any>;
	metadata: Metadata; // For the moment only DHT shard
	integratedDHTOps: HoloHashMap<DhtOpHash, IntegratedDhtOpsValue>; // Key is the hash of the DHT op
	authoredDHTOps: HoloHashMap<DhtOpHash, AuthoredDhtOpsValue>; // Key is the hash of the DHT op
	integrationLimbo: HoloHashMap<DhtOpHash, IntegrationLimboValue>; // Key is the hash of the DHT op
	validationLimbo: HoloHashMap<DhtOpHash, ValidationLimboValue>; // Key is the hash of the DHT op
	validationReceipts: HoloHashMap<
		DhtOpHash,
		HoloHashMap<AgentPubKey, ValidationReceipt>
	>; // Segmented by dhtOpHash/authorOfReceipt
	badAgents: AgentPubKey[];
}

export interface IntegratedDhtOpsValue {
	op: DhtOp;
	validation_status: ValidationStatus;
	when_integrated: number;
	/// Send a receipt to this author.
	send_receipt: Boolean;
}

export interface IntegrationLimboValue {
	op: DhtOp;
	validation_status: ValidationStatus;
	/// Send a receipt to this author.
	send_receipt: Boolean;
}

export enum ValidationStatus {
	Valid,
	Rejected,
	Abandoned,
}

// From https://github.com/holochain/holochain/blob/develop/crates/holochain/src/core/state/dht_op_integration.rs
export interface AuthoredDhtOpsValue {
	op: DhtOp;
	receipt_count: number;
	last_publish_time: number | undefined;
}

export enum ValidationLimboStatus {
	Pending,
	AwaitingSysDeps,
	SysValidated,
	AwaitingAppDeps,
}

// From https://github.com/holochain/holochain/blob/develop/crates/holochain/src/core/state/validation_db.rs#L24
export interface ValidationLimboValue {
	status: ValidationLimboStatus;
	op: DhtOp;
	basis: HoloHash;
	time_added: number;
	last_try: number | undefined;
	num_tries: number;
	from_agent: AgentPubKey | undefined;
	/// Send a receipt to this author.
	send_receipt: Boolean;
}

export function query_dht_ops(
	integratedDhtOps: HoloHashMap<DhtOpHash, IntegratedDhtOpsValue>,
	from: number | undefined,
	to: number | undefined,
	dht_arc: DhtArc,
): Array<DhtOpHash> {
	const isDhtOpsInFilter = ([dhtOpHash, dhtOpValue]: [
		DhtOpHash,
		IntegratedDhtOpsValue,
	]) => {
		if (from && dhtOpValue.when_integrated < from) return false;
		if (to && dhtOpValue.when_integrated > to) return false;
		if (dht_arc && !contains(dht_arc, location(dhtOpHash))) return false;
	};

	const ops = Array.from(integratedDhtOps.entries()).filter(isDhtOpsInFilter);
	return ops.map(op => op[0]);
}
