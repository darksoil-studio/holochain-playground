import { Entry, ActionHash, EntryType } from '@holochain/client';
import { encode } from '@msgpack/msgpack';

import { HostFn, HostFnWorkspace } from '../../host-fn.js';
import { common_update } from './common/update.js';

export type UpdateEntryFn = (
  original_action_address: ActionHash,
  newEntry: {
    content: any;
    entry_def_id: string;
  }
) => Promise<ActionHash>;

// Creates a new Create action and its entry in the source chain
export const update_entry: HostFn<UpdateEntryFn> =
  (workspace: HostFnWorkspace, zome_index: number): UpdateEntryFn =>
  async (
    original_action_address: ActionHash,
    newEntry: {
      content: any;
      entry_def_id: string;
    }
  ): Promise<ActionHash> => {
    const entry: Entry = { entry_type: 'App', entry: encode(newEntry.content) };

    const entryDefIndex = workspace.dna.zomes[zome_index].entry_defs.findIndex(
      (entry_def) => entry_def.id === newEntry.entry_def_id
    );
    if (entryDefIndex < 0) {
      throw new Error(
        `Given entry def id ${newEntry.entry_def_id} does not exist in this zome`
      );
    }

    const entry_type: EntryType = {
      App: {
        entry_index: entryDefIndex,
        zome_index,
        visibility:
          workspace.dna.zomes[zome_index].entry_defs[entryDefIndex].visibility,
      },
    };

    return common_update(workspace, original_action_address, entry, entry_type);
  };
