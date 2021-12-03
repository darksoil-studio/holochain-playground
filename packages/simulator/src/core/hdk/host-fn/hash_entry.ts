import { Entry, EntryHash } from '@holochain/conductor-api';
import { hashEntry } from '../../cell/utils';
import { HostFn, HostFnWorkspace } from '../host-fn';

export type HashEntryFn = (args: { content: any }) => Promise<EntryHash>;

// Creates a new Create header and its entry in the source chain
export const hash_entry: HostFn<HashEntryFn> =
  (worskpace: HostFnWorkspace): HashEntryFn =>
  async (args): Promise<EntryHash> => {
    const entry: Entry = { entry_type: 'App', content: args.content };
    return hashEntry(entry);
  };
