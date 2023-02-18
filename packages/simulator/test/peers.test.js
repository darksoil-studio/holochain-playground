import { createConductors, demoHapp } from '../dist';
import { assert, describe, expect, it } from 'vitest';
import { sleep } from './utils';

describe('Peers', () => {
  it('conductors should discover neighbors', async function () {
    const conductors = await createConductors(10, [], demoHapp());
    await sleep(2000);

    for (const c of conductors) {
      const neighborCount = c.getAllCells()[0].p2p.getState().neighbors.length;
      expect(neighborCount).to.be.greaterThan(2);
    }
  });
});
