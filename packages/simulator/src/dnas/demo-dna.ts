import { Update } from '@holochain/client';
import { areEqual } from '../processors/hash';

import { GetStrategy } from '../types';
import {
  SimulatedDna,
  SimulatedHappBundle,
  SimulatedZome,
} from './simulated-dna';

export const demoEntriesZome: SimulatedZome = {
  name: 'demo_entries',
  entry_defs: [
    {
      id: 'demo_entry',
      visibility: { Public: null },
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
  validation_functions: {
    validate_update_entry_demo_entry:
      (hdk) =>
      async ({ record }) => {
        const update = record.signed_action.hashed.content as Update;
        const updateAuthor = update.author;

        const originalAction = await hdk.get(update.original_action_address);

        if (!originalAction)
          return {
            resolved: false,
            depsHashes: [update.original_action_address],
          };

        if (
          !areEqual(
            originalAction.signed_action.hashed.content.author,
            updateAuthor
          )
        ) {
          return {
            valid: false,
            resolved: true,
          };
        }

        return { valid: true, resolved: true };
      },
  },
};

export const demoLinksZome: SimulatedZome = {
  name: 'demo_links',
  entry_defs: [],
  zome_functions: {
    create_link: {
      call:
        ({ create_link }) =>
        ({ base, target, tag }) => {
          return create_link({ base, target, tag });
        },
      arguments: [
        { name: 'base', type: 'AnyDhtHash' },
        { name: 'target', type: 'AnyDhtHash' },
        { name: 'tag', type: 'any' },
      ],
    },
    get_links: {
      call:
        ({ get_links }) =>
        ({ base }) => {
          return get_links(base);
        },
      arguments: [{ name: 'base', type: 'AnyDhtHash' }],
    },
    delete_link: {
      call:
        ({ delete_link }) =>
        ({ create_link_hash }) => {
          return delete_link(create_link_hash);
        },
      arguments: [{ name: 'add_link_action', type: 'ActionHash' }],
    },
  },
  validation_functions: {},
};
export const demoPathsZome: SimulatedZome = {
  name: 'demo_paths',
  entry_defs: [
    {
      id: 'path',
      visibility: { Public: null },
    },
  ],
  zome_functions: {
    ensure_path: {
      call:
        (hdk) =>
        async ({ path }) => {
          const actionHash = await hdk.create_entry({
            content: path,
            entry_def_id: 'path',
          });

          return hdk.path.ensure(path);
        },
      arguments: [{ name: 'path', type: 'String' }],
    },
  },
  validation_functions: {},
};

export function demoDna(): SimulatedDna {
  const zomes = [demoEntriesZome, demoLinksZome, demoPathsZome];
  return {
    properties: {},
    uid: '',
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
