import { encodeHashToBase64, Entry, EntryHash } from '@holochain/client';
import { encode } from '@msgpack/msgpack';
import { hashEntry } from '../../cell/utils.js';
import { HostFn, HostFnWorkspace } from '../host-fn.js';

export type HashEntryFn = (args: any) => Promise<EntryHash>;

// Creates a new Create action and its entry in the source chain
export const hash_entry: HostFn<HashEntryFn> =
  (worskpace: HostFnWorkspace): HashEntryFn =>
  async (args): Promise<EntryHash> => {
    const entry: Entry = { entry_type: 'App', entry: encode(args) };
    return hashEntry(entry);
  };
