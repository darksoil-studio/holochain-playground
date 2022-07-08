import { Entry, ActionHash } from '@holochain/client';
import { HostFn, HostFnWorkspace } from '../../host-fn';
import { common_create } from './common/create';

export type CreateEntryFn = (args: {
  content: any;
  entry_def_id: string;
}) => Promise<ActionHash>;

// Creates a new Create action and its entry in the source chain
export const create_entry: HostFn<CreateEntryFn> =
  (workspace: HostFnWorkspace, zome_index: number): CreateEntryFn =>
  async (args: { content: any; entry_def_id: string }): Promise<ActionHash> => {
    const entry: Entry = { entry_type: 'App', entry: args.content };

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
