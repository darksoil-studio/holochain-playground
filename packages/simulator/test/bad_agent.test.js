import { createConductors, demoHapp } from '../dist';
import { expect } from '@esm-bundle/chai';
import isEqual from 'lodash-es/isEqual';

import { sleep } from './utils';

describe('Bad Agent', () => {
  it(`bad agent cheats and gets booted out of the network`, async function () {
    this.timeout(0);

    for (let i = 0; i < 2; i++) {
      const conductors = await createConductors(10, [], demoHapp());

      await sleep(100);

      const aliceCell = conductors[0].getAllCells()[0];
      const bobCell = conductors[1].getAllCells()[0];

      const badAgent = conductors[2];
      badAgent.setBadAgent({
        pretend_invalid_elements_are_valid: true,
        disable_validation_before_publish: true,
      });
      const badAgentCell = badAgent.getAllCells()[0];
      conductors[3].setBadAgent({
        disable_validation_before_publish: true,
        pretend_invalid_elements_are_valid: true,
      });
      const badAgent2Address = conductors[3].getAllCells()[0].agentPubKey;

      const aliceAddress = aliceCell.cellId[1];
      const bobAddress = bobCell.cellId[1];
      const badAgentAddress = badAgentCell.cellId[1];

      let result = await conductors[0].callZomeFn({
        cellId: aliceCell.cellId,
        cap: null,
        fnName: 'create_entry',
        payload: { content: 'hi' },
        zome: 'demo_entries',
      });
      expect(result).to.be.ok;

      await sleep(100);

      try {
        // Bob is an honest agent: they shouldn't publish a bad action
        await conductors[1].callZomeFn({
          cellId: bobCell.cellId,
          cap: null,
          fnName: 'update_entry',
          payload: { original_header_address: result, new_content: 'hi2' },
          zome: 'demo_entries',
        });
        expect(false).to.be.ok;
      } catch (e) {
        expect(true).to.be.ok;
      }

      result = await conductors[2].callZomeFn({
        cellId: badAgentCell.cellId,
        cap: null,
        fnName: 'update_entry',
        payload: { original_header_address: result, new_content: 'hi2' },
        zome: 'demo_entries',
      });
      expect(result).to.be.ok;

      await sleep(15000);

      const honestCells = conductors
        .map(c => c.getAllCells()[0])
        .filter(
          cell =>
            !isEqual(cell.agentPubKey, badAgentAddress) &&
            !isEqual(cell.agentPubKey, badAgent2Address)
        );
      const honestCellsWithBadAgentAsNeighbor = honestCells.filter(
        cell =>
          cell.p2p.neighbors.find(n => isEqual(n, badAgentAddress)) ||
          cell.p2p.neighbors.find(n => isEqual(n, badAgent2Address))
      );

      expect(honestCellsWithBadAgentAsNeighbor.length).to.equal(0);
    }
  });
});
