import { ActionHash, Entry, EntryType, Record } from '@holochain/client';

import {
  buildCreate,
  buildShh,
} from '../../../../cell/source-chain/builder-actions.js';
import { putRecord } from '../../../../cell/source-chain/put.js';
import { HostFnWorkspace } from '../../../host-fn.js';

export function common_create(
  worskpace: HostFnWorkspace,
  entry: Entry,
  entry_type: EntryType
): ActionHash {
  const create = buildCreate(worskpace.state, entry, entry_type);

  const record: Record = {
    signed_action: buildShh(create),
    entry: {
      Present: entry
    }
  };

  putRecord(record)(worskpace.state);

  return record.signed_action.hashed.hash;
}
