import { Entry, HeaderHash } from '@holochain/conductor-api';

import { HostFn, HostFnWorkspace } from '../../host-fn';
import { common_update } from './common/update';

export type UpdateEntryFn = (
  original_header_address: HeaderHash,
  newEntry: {
    content: any;
    entry_def_id: string;
  }
) => Promise<HeaderHash>;

// Creates a new Create header and its entry in the source chain
export const update_entry: HostFn<UpdateEntryFn> =
  (workspace: HostFnWorkspace, zome_index: number): UpdateEntryFn =>
  async (
    original_header_address: HeaderHash,
    newEntry: {
      content: any;
      entry_def_id: string;
    }
  ): Promise<HeaderHash> => {
    const entry: Entry = { entry_type: 'App', content: newEntry.content };

    const entryDefIndex = workspace.dna.zomes[zome_index].entry_defs.findIndex(
      entry_def => entry_def.id === newEntry.entry_def_id
    );
    if (entryDefIndex < 0) {
      throw new Error(
        `Given entry def id ${newEntry.entry_def_id} does not exist in this zome`
      );
    }

    const entry_type = {
      App: {
        id: entryDefIndex,
        zome_id: zome_index,
        visibility:
          workspace.dna.zomes[zome_index].entry_defs[entryDefIndex].visibility,
      },
    };

    return common_update(workspace, original_header_address, entry, entry_type);
  };
