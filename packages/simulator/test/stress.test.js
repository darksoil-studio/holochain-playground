import { createConductors, demoHapp } from '../dist';
import { assert, describe, expect, it } from 'vitest';
import { sleep } from './utils.js';

describe('Stress tests links', () => {
  it('create multiple links', async function () {
    const start = Date.now();

    for (let i = 0; i < 2; i++) {
      await oneRound();
    }

    async function oneRound() {
      const conductors = await createConductors(10, [], demoHapp());
      await sleep(200);

      const cell = conductors[0].getAllCells()[0];

      await conductors[0].callZomeFn({
        cellId: cell.cellId,
        cap: null,
        fnName: 'create_entry',
        payload: { content: 'hi' },
        zome: 'demo_entries',
      });

      let baseHash = await conductors[0].callZomeFn({
        cellId: cell.cellId,
        cap: null,
        fnName: 'hash_entry',
        payload: { entry: { content: 'hi', entry_def_id: 'demo_entry' } },
        zome: 'demo_entries',
      });

      expect(baseHash).to.be.ok;
      await sleep(200);

      const add_link_hash = await conductors[0].callZomeFn({
        cellId: cell.cellId,
        cap: null,
        fnName: 'create_link',
        payload: {
          base: baseHash,
          target: cell.cellId[1],
          tag: 'hello',
          link_type: 0,
        },
        zome: 'demo_links',
      });

      expect(add_link_hash).to.be.ok;

      await sleep(1000);

      let links = await conductors[0].callZomeFn({
        cellId: cell.cellId,
        cap: null,
        fnName: 'get_links',
        payload: {
          base: baseHash,
          link_type: 0,
        },
        zome: 'demo_links',
      });

      expect(links.length).to.equal(1);
    }

    console.log('Ended in ', (Date.now() - start) / 1000);
  });
});
