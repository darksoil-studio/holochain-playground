import { describe, expect, it } from 'vitest';
import { sleep } from './utils';
import { createConductors, demoHapp } from '../dist';

describe('CRUD', () => {
  it('create, update and delete an entry', async function () {
    const conductors = await createConductors(3, [], demoHapp());
    await sleep(200);

    const cell = conductors[0].getAllCells()[0];

    let actionHash = await conductors[0].callZomeFn({
      cellId: cell.cellId,
      cap: null,
      fnName: 'create_entry',
      payload: { content: 'hi' },
      zome: 'demo_entries',
    });

    expect(actionHash).to.be.ok;
    await sleep(200);

    const content = await conductors[0].callZomeFn({
      cellId: cell.cellId,
      cap: null,
      fnName: 'get',
      payload: { hash: actionHash },
      zome: 'demo_entries',
    });

    expect(content).to.be.ok;

    const entryHash = await conductors[0].callZomeFn({
      cellId: cell.cellId,
      cap: null,
      fnName: 'hash_entry',
      payload: {
        entry: 'hi',
      },
      zome: 'demo_entries',
    });

    expect(entryHash).to.be.ok;

    const getByEntryHashResult = await conductors[0].callZomeFn({
      cellId: cell.cellId,
      cap: null,
      fnName: 'get',
      payload: { hash: entryHash },
      zome: 'demo_entries',
    });

    expect(getByEntryHashResult).to.be.ok;

    try {
      await conductors[0].callZomeFn({
        cellId: cell.cellId,
        cap: null,
        fnName: 'update_entry',
        payload: {
          original_action_address: entryHash,
          new_content: 'hi2',
        },
        zome: 'demo_entries',
      });
      expect(false).to.be.ok;
    } catch (e) {
      expect(true).to.be.ok;
    }

    const updatehash = await conductors[0].callZomeFn({
      cellId: cell.cellId,
      cap: null,
      fnName: 'update_entry',
      payload: {
        original_action_address: actionHash,
        new_content: 'hi2',
      },
      zome: 'demo_entries',
    });

    expect(updatehash).to.be.ok;

    const deletehash = await conductors[0].callZomeFn({
      cellId: cell.cellId,
      cap: null,
      fnName: 'delete_entry',
      payload: {
        deletes_address: actionHash,
      },
      zome: 'demo_entries',
    });

    expect(deletehash).to.be.ok;

    await sleep(200);

    let getresult = await conductors[0].callZomeFn({
      cellId: cell.cellId,
      cap: null,
      fnName: 'get_details',
      payload: {
        hash: actionHash,
      },
      zome: 'demo_entries',
    });
    expect(getresult.content.deletes.length).to.equal(1);
    expect(getresult.content.updates.length).to.equal(1);

    getresult = await conductors[0].callZomeFn({
      cellId: cell.cellId,
      cap: null,
      fnName: 'get_details',
      payload: {
        hash: entryHash,
      },
      zome: 'demo_entries',
    });
    expect(getresult.content.updates.length).to.equal(1);
  });
});
