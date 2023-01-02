import { DhtOpHash, ValidationReceipt } from '@holochain-open-dev/core-types';
import { HoloHashMap } from '@holochain-open-dev/utils';
import { AgentPubKey, DhtOp } from '@holochain/client';

import { BadAction } from '../utils';

// From https://github.com/holochain/holochain/blob/develop/crates/kitsune_p2p/kitsune_p2p/src/types/gossip.rs

export interface GossipData {
  validated_dht_ops: HoloHashMap<DhtOpHash, GossipDhtOpData>;
  neighbors: Array<AgentPubKey>;
  badActions: Array<BadAction>;
}

export interface GossipDhtOpData {
  op: DhtOp;
  validation_receipts: ValidationReceipt[];
}
