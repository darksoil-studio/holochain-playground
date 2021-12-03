import { createConductors, demoHapp } from '../dist';
import { expect } from '@esm-bundle/chai';
import { sleep } from './utils';

describe('Conductor', () => {
  it('create conductors and call zome fn', async function () {
    this.timeout(0);

    const conductors = await createConductors(10, [], demoHapp());
    await sleep(10000);

    const cell = conductors[0].getAllCells()[0];

    let hash = await conductors[0].callZomeFn({
      cellId: cell.cellId,
      cap: null,
      fnName: 'create_entry',
      payload: { content: 'hi' },
      zome: 'demo_entries',
    });

    expect(hash).to.be.ok;
    await sleep(5000);
    expect(cell.getState().integratedDHTOps.keys().length).to.be.greaterThan(6);

    let getresult = await conductors[0].callZomeFn({
      cellId: cell.cellId,
      cap: null,
      fnName: 'get',
      payload: {
        hash,
      },
      zome: 'demo_entries',
    });

    expect(getresult).to.be.ok;

    getresult = await conductors[0].callZomeFn({
      cellId: cell.cellId,
      cap: null,
      fnName: 'get',
      payload: {
        hash,
      },
      zome: 'demo_entries',
    });

    expect(getresult).to.be.ok;
  });
});
