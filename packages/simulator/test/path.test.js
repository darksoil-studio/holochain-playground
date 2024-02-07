import { createConductors, demoHapp } from '../dist';
import { describe, expect, it } from 'vitest';
import { sleep } from './utils';

describe('Paths', () => {
  it('ensure a path', async function () {
    const conductors = await createConductors(10, [], demoHapp());
    await sleep(200);

    const cell = conductors[0].getAllCells()[0];

    await conductors[0].callZomeFn({
      cellId: cell.cellId,
      cap: null,
      fnName: 'ensure_path',
      payload: { path: 'a.sample.path', link_type: 0 },
      zome: 'demo_paths',
    });
    const entryHash = await conductors[0].callZomeFn({
      cellId: cell.cellId,
      cap: null,
      fnName: 'hash_entry',
      payload: { entry: 'a' },
      zome: 'demo_entries',
    });

    await sleep(200);

    const links = await conductors[0].callZomeFn({
      cellId: cell.cellId,
      cap: null,
      fnName: 'get_links',
      payload: { base: entryHash, link_type: 0 },
      zome: 'demo_links',
    });
    expect(links.length).to.equal(1);
  });
});
