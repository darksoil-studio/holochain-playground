import { AgentPubKey, DhtOp } from '@holochain/client';
import { DhtOpHash, ValidationReceipt } from '@tnesh-stack/core-types';
import { HoloHashMap } from '@tnesh-stack/utils';

import { BadAction } from '../utils.js';

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
