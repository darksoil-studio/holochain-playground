import { sleep } from '../../../../executor/delay-middleware';
import { HoloHashMap } from '../../../../processors/holo-hash-map';
import { getValidationReceipts } from '../../../cell';
import { P2pCell } from '../../p2p-cell';
import { getBadActions } from '../../utils';
import { GossipData, GossipDhtOpData } from '../types';

export const GOSSIP_INTERVAL_MS = 500;

export class SimpleBloomMod {
  gossip_on: boolean = true;

  lastBadActions = 0;

  constructor(protected p2pCell: P2pCell) {
    this.loop();
  }
  async loop() {
    while (true) {
      if (this.gossip_on) {
        try {
          await this.run_one_iteration();
        } catch (e) {
          console.warn('Connection closed');
        }
      }
      await sleep(GOSSIP_INTERVAL_MS);
    }
  }

  async run_one_iteration(): Promise<void> {
    const localDhtOpsHashes = this.p2pCell.cell._state.integratedDHTOps.keys();
    const localDhtOps =
      this.p2pCell.cell.handle_fetch_op_hash_data(localDhtOpsHashes);

    const state = this.p2pCell.cell._state;

    const dhtOpData: HoloHashMap<GossipDhtOpData> = new HoloHashMap();

    for (const dhtOpHash of localDhtOps.keys()) {
      const receipts = getValidationReceipts(dhtOpHash)(state);
      dhtOpData.put(dhtOpHash, {
        op: localDhtOps.get(dhtOpHash),
        validation_receipts: receipts,
      });
    }

    const pretendValid =
      this.p2pCell.cell.conductor.badAgent &&
      this.p2pCell.cell.conductor.badAgent.config
        .pretend_invalid_elements_are_valid;

    const badActions = pretendValid ? [] : getBadActions(state);

    const gossips: GossipData = {
      badActions,
      neighbors: [],
      validated_dht_ops: dhtOpData,
    };

    let warrant =
      badActions.length > 0 && badActions.length !== this.lastBadActions;
    this.lastBadActions = badActions.length;

    if (warrant) {
      const promises = [
        ...this.p2pCell.neighbors,
        ...this.p2pCell.farKnownPeers,
      ].map(peer => this.p2pCell.outgoing_gossip(peer, gossips, warrant));

      await Promise.all(promises);
    } else {
      for (const neighbor of this.p2pCell.neighbors) {
        await this.p2pCell.outgoing_gossip(neighbor, gossips, warrant);
      }
    }
  }
}
