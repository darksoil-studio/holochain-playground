import { createConductors, demoHapp } from '../dist';
import { expect } from '@esm-bundle/chai';
import { sleep } from './utils';

describe('Links', () => {
  it('create entry and link, get_links, delete_links', async function () {
    this.timeout(0);

    const conductors = await createConductors(10, [], demoHapp());
    await sleep(10000);

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
    await sleep(4000);

    const add_link_hash = await conductors[0].callZomeFn({
      cellId: cell.cellId,
      cap: null,
      fnName: 'create_link',
      payload: { base: baseHash, target: cell.cellId[1], tag: 'hello' },
      zome: 'demo_links',
    });

    expect(add_link_hash).to.be.ok;

    await sleep(2000);

    let links = await conductors[0].callZomeFn({
      cellId: cell.cellId,
      cap: null,
      fnName: 'get_links',
      payload: {
        base: baseHash,
      },
      zome: 'demo_links',
    });
    expect(links.length).to.equal(1);
    await sleep(3000);

    await conductors[0].callZomeFn({
      cellId: cell.cellId,
      cap: null,
      fnName: 'delete_link',
      payload: {
        add_link_header: add_link_hash,
      },
      zome: 'demo_links',
    });
    await sleep(5000);

    links = await conductors[0].callZomeFn({
      cellId: cell.cellId,
      cap: null,
      fnName: 'get_links',
      payload: {
        base: baseHash,
      },
      zome: 'demo_links',
    });

    expect(links.length).to.equal(0);
  });
});
