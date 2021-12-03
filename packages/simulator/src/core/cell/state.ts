import {
  deserializeHash,
  DhtOpHash,
  DhtOpHashB64,
  Dictionary,
  ValidationReceipt,
} from '@holochain-open-dev/core-types';
import {
  AgentPubKey,
  DhtOp,
  DnaHash,
  HeaderHash,
  HoloHash,
} from '@holochain/conductor-api';
import { location } from '../../processors/hash';
import { HoloHashMap } from '../../processors/holo-hash-map';
import { contains, DhtArc } from '../network/dht_arc';
import { Metadata } from './state/metadata';

export interface CellState {
  dnaHash: DnaHash;
  agentPubKey: AgentPubKey;
  sourceChain: Array<HeaderHash>;
  CAS: HoloHashMap<any>;
  metadata: Metadata; // For the moment only DHT shard
  integratedDHTOps: HoloHashMap<IntegratedDhtOpsValue>; // Key is the hash of the DHT op
  authoredDHTOps: HoloHashMap<AuthoredDhtOpsValue>; // Key is the hash of the DHT op
  integrationLimbo: HoloHashMap<IntegrationLimboValue>; // Key is the hash of the DHT op
  validationLimbo: HoloHashMap<ValidationLimboValue>; // Key is the hash of the DHT op
  validationReceipts: HoloHashMap<HoloHashMap<ValidationReceipt>>; // Segmented by dhtOpHash/authorOfReceipt
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
  integratedDhtOps: HoloHashMap<IntegratedDhtOpsValue>,
  from: number | undefined,
  to: number | undefined,
  dht_arc: DhtArc
): Array<DhtOpHash> {
  const isDhtOpsInFilter = ([dhtOpHash, dhtOpValue]: [
    DhtOpHash,
    IntegratedDhtOpsValue
  ]) => {
    if (from && dhtOpValue.when_integrated < from) return false;
    if (to && dhtOpValue.when_integrated > to) return false;
    if (dht_arc && !contains(dht_arc, location(dhtOpHash))) return false;
  };

  const ops = integratedDhtOps.entries().filter(isDhtOpsInFilter);
  return ops.map(op => op[0]);
}
