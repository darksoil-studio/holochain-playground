import {
  AgentPubKeyB64,
  ValidationReceipt,
} from '@holochain-open-dev/core-types';
import { AgentPubKey, DhtOp } from '@holochain/conductor-api';

import { HoloHashMap } from '../../../processors/holo-hash-map';

import { BadAction } from '../utils';

// From https://github.com/holochain/holochain/blob/develop/crates/kitsune_p2p/kitsune_p2p/src/types/gossip.rs

export interface GossipData {
  validated_dht_ops: HoloHashMap<GossipDhtOpData>;
  neighbors: Array<AgentPubKey>;
  badActions: Array<BadAction>;
}

export interface GossipDhtOpData {
  op: DhtOp;
  validation_receipts: ValidationReceipt[];
}
