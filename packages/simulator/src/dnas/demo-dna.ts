import { Update } from '@holochain/client';

import {
	Op,
	RegisterUpdate,
} from '../core/cell/workflows/app_validation/types.js';
import { areEqual } from '../processors/hash.js';
import { GetStrategy } from '../types.js';
import {
	SimulatedDna,
	SimulatedHappBundle,
	SimulatedZome,
} from './simulated-dna.js';

export const demoEntriesZome: SimulatedZome = {
	name: 'demo_entries',
	entry_defs: [
		{
			id: 'demo_entry',
			visibility: 'Public',
		},
	],
	zome_functions: {
		create_entry: {
			call:
				({ create_entry }) =>
				async ({ content }) => {
					return create_entry({ content, entry_def_id: 'demo_entry' });
				},
			arguments: [{ name: 'content', type: 'any' }],
		},
		hash_entry: {
			call:
				({ hash_entry }) =>
				async ({ entry }) => {
					return hash_entry(entry);
				},
			arguments: [{ name: 'entry', type: 'any' }],
		},
		get: {
			call:
				({ get }) =>
				({ hash }) => {
					return get(hash, { strategy: GetStrategy.Latest });
				},
			arguments: [{ name: 'hash', type: 'AnyDhtHash' }],
		},
		get_details: {
			call:
				({ get_details }) =>
				({ hash }) => {
					return get_details(hash, { strategy: GetStrategy.Latest });
				},
			arguments: [{ name: 'hash', type: 'AnyDhtHash' }],
		},
		update_entry: {
			call:
				({ update_entry }) =>
				({ original_action_address, new_content }) => {
					return update_entry(original_action_address, {
						content: new_content,
						entry_def_id: 'demo_entry',
					});
				},
			arguments: [
				{ name: 'original_action_address', type: 'ActionHash' },
				{ name: 'new_content', type: 'String' },
			],
		},
		delete_entry: {
			call:
				({ delete_entry }) =>
				({ deletes_address }) => {
					return delete_entry(deletes_address);
				},
			arguments: [{ name: 'deletes_address', type: 'ActionHash' }],
		},
	},
	validate: hdk => async (op: Op) => {
		const registerUpdate = (op as { RegisterUpdate: RegisterUpdate })
			.RegisterUpdate;
		if (registerUpdate) {
			const update = registerUpdate.update.hashed.content as Update;
			const updateAuthor = update.author;

			const originalAction = await hdk.must_get_action(
				update.original_action_address,
			);

			if (!areEqual(originalAction.hashed.content.author, updateAuthor)) {
				return {
					valid: false,
					resolved: true,
				};
			}
		}

		return {
			resolved: true,
			valid: true,
		};
	},
};

export const demoLinksZome: SimulatedZome = {
	name: 'demo_links',
	entry_defs: [],
	zome_functions: {
		create_link: {
			call:
				({ create_link }) =>
				({ base, target, link_type, tag }) => {
					return create_link({ base, target, link_type, tag });
				},
			arguments: [
				{ name: 'base', type: 'AnyLinkableHash' },
				{ name: 'target', type: 'AnyLinkableHash' },
				{ name: 'link_type', type: 'number' },
				{ name: 'tag', type: 'any' },
			],
		},
		get_links: {
			call:
				({ get_links }) =>
				({ base, link_type }) => {
					return get_links(base, link_type);
				},
			arguments: [
				{ name: 'base', type: 'AnyDhtHash' },
				{ name: 'link_type', type: 'number' },
			],
		},
		delete_link: {
			call:
				({ delete_link }) =>
				({ create_link_hash }) => {
					return delete_link(create_link_hash);
				},
			arguments: [{ name: 'create_link_hash', type: 'ActionHash' }],
		},
	},
};
export const demoPathsZome: SimulatedZome = {
	name: 'demo_paths',
	entry_defs: [
		{
			id: 'path',
			visibility: 'Public',
		},
	],
	zome_functions: {
		ensure_path: {
			call:
				hdk =>
				async ({ path, link_type }) => {
					const actionHash = await hdk.create_entry({
						content: path,
						entry_def_id: 'path',
					});

					return hdk.path.ensure(path, link_type);
				},
			arguments: [
				{ name: 'path', type: 'String' },
				{ name: 'link_type', type: 'number' },
			],
		},
	},
};

export const demoMigrationZome: SimulatedZome = {
	name: 'demo_migration',
	entry_defs: [],
	zome_functions: {
		open_chain: {
			call:
				({ open_chain }) =>
				({ prev_target, close_hash }) => {
					return open_chain({
						prev_target: {
							type: 'Dna',
							content: prev_target,
						},
						close_hash,
					});
				},
			arguments: [
				{ name: 'prev_target', type: 'DnaHash' },
				{ name: 'close_hash', type: 'ActionHash' },
			],
		},
		close_chain: {
			call:
				({ close_chain }) =>
				({ new_target }) => {
					return close_chain({
						new_target: {
							type: 'Dna',
							content: new_target,
						},
					});
				},
			arguments: [{ name: 'new_target', type: 'DnaHash' }],
		},
	},
};

export const demoInfoZome: SimulatedZome = {
	name: 'demo_info',
	entry_defs: [],
	zome_functions: {
		dna_info: {
			call:
				({ dna_info }) =>
				async () => {
					const info = await dna_info();
					return info;
				},
			arguments: [],
		},
	},
};

export function demoDna(): SimulatedDna {
	const zomes = [
		demoEntriesZome,
		demoLinksZome,
		demoPathsZome,
		demoMigrationZome,
		demoInfoZome,
	];
	return {
		properties: {},
		networkSeed: '',
		zomes,
	};
}

export function demoHapp(): SimulatedHappBundle {
	return {
		name: 'demo-happ',
		description: '',
		roles: {
			default: {
				dna: demoDna(),
				deferred: false,
			},
		},
	};
}
