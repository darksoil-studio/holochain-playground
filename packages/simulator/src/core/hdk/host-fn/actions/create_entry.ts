import { Entry, HeaderHash } from '@holochain/conductor-api';
import { HostFn, HostFnWorkspace } from '../../host-fn';
import { common_create } from './common/create';

export type CreateEntryFn = (args: {
  content: any;
  entry_def_id: string;
}) => Promise<HeaderHash>;

// Creates a new Create header and its entry in the source chain
export const create_entry: HostFn<CreateEntryFn> =
  (workspace: HostFnWorkspace, zome_index: number): CreateEntryFn =>
  async (args: { content: any; entry_def_id: string }): Promise<HeaderHash> => {
    const entry: Entry = { entry_type: 'App', content: args.content };

    const entryDefIndex = workspace.dna.zomes[zome_index].entry_defs.findIndex(
      entry_def => entry_def.id === args.entry_def_id
    );
    if (entryDefIndex < 0) {
      throw new Error(
        `Given entry def id ${args.entry_def_id} does not exist in this zome`
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

    return common_create(workspace, entry, entry_type);
  };
