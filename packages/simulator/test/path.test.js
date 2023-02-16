import { createConductors, demoHapp } from '../dist';
import { describe, expect, it } from 'vitest';
import { sleep } from './utils';

describe('Paths', () => {
  it('ensure a path', async function () {
    const conductors = await createConductors(10, [], demoHapp());
    await sleep(1000);

    const cell = conductors[0].getAllCells()[0];

    const hash = await conductors[0].callZomeFn({
      cellId: cell.cellId,
      cap: null,
      fnName: 'ensure_path',
      payload: { path: 'a.sample.path' },
      zome: 'demo_paths',
    });
    expect(hash).to.be.ok;
  });
});
