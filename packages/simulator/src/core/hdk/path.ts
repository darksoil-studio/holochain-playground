import { EntryHash, LinkType } from '@holochain/client';
import { HashType, retype } from '@darksoil-studio/holochain-utils';

import { areEqual } from '../../processors/hash.js';
import { Hdk } from './context.js';

function rootHash(hdk: Hdk): Promise<EntryHash> {
	return hdk.hash_entry('ROOT_ANCHOR');
}

export const ensure =
	(hdk: Hdk) =>
	async (path: string, link_type: LinkType): Promise<void> => {
		const components = path.split('.');

		if (components.length === 1) {
			const root = await rootHash(hdk);
			const pathHash = await hdk.hash_entry(path);

			const links = (await hdk.get_links(root, link_type)) || [];
			const linksForThisPath = links.filter(link =>
				areEqual(retype(link.target, HashType.ENTRY), pathHash),
			);

			if (linksForThisPath.length === 0) {
				await hdk.create_link({
					base: root,
					target: pathHash,
					link_type,
					tag: path,
				});
			}
		} else if (components.length > 1) {
			components.splice(components.length - 1, 1);
			const parent = components.join('.');

			await ensure(hdk)(parent, link_type);

			const pathHash = await hdk.hash_entry(path);
			const parentHash = await hdk.hash_entry(parent);

			const links = (await hdk.get_links(parentHash, link_type)) || [];
			const linksForThisPath = links.filter(link =>
				areEqual(retype(link.target, HashType.ENTRY), pathHash),
			);

			if (linksForThisPath.length === 0) {
				await hdk.create_link({
					base: parentHash,
					target: pathHash,
					link_type,
					tag: path,
				});
			}
		}
	};

export interface Path {
	ensure: (path: string, link_type: LinkType) => Promise<void>;
}
