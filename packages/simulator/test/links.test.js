import { assert, describe, expect, it } from 'vitest';

import { createConductors, demoHapp } from '../dist';
import { sleep } from './utils';

describe('Links', () => {
	it('create entry and link, get_links, delete_links', async function () {
		const conductors = await createConductors(10, [], demoHapp());
		await sleep(300);

		const cell = conductors[0].getAllCells()[0];

		let baseHash = await conductors[0].callZomeFn({
			cellId: cell.cellId,
			cap: null,
			fnName: 'create_entry',
			payload: { content: 'hi' },
			zome: 'demo_entries',
		});

		expect(baseHash).to.be.ok;
		await sleep(300);

		const create_link_hash = await conductors[0].callZomeFn({
			cellId: cell.cellId,
			cap: null,
			fnName: 'create_link',
			payload: {
				base: baseHash,
				target: cell.cellId[1],
				link_type: 0,
				tag: 'hello',
			},
			zome: 'demo_links',
		});

		expect(create_link_hash).to.be.ok;

		await sleep(300);

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

		await sleep(300);

		await conductors[0].callZomeFn({
			cellId: cell.cellId,
			cap: null,
			fnName: 'delete_link',
			payload: {
				create_link_hash,
			},
			zome: 'demo_links',
		});
		await sleep(3000);

		links = await conductors[0].callZomeFn({
			cellId: cell.cellId,
			cap: null,
			fnName: 'get_links',
			payload: {
				base: baseHash,
				link_type: 0,
			},
			zome: 'demo_links',
		});

		expect(links.length).to.equal(0);
	});
});
