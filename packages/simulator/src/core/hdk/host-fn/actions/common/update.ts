import {
  NewEntryAction,
  Entry,
  EntryType,
  ActionHash,
  Record,
} from '@holochain/client';

import { GetStrategy } from '../../../../../types';
import {
  buildDelete,
  buildShh,
  buildUpdate,
} from '../../../../cell/source-chain/builder-actions';
import { putRecord } from '../../../../cell/source-chain/put';
import { HostFnWorkspace } from '../../../host-fn';

export async function common_update(
  worskpace: HostFnWorkspace,
  original_action_hash: ActionHash,
  entry: Entry,
  entry_type: EntryType
): Promise<ActionHash> {
  const actionToUpdate = await worskpace.cascade.retrieve_action(
    original_action_hash,
    {
      strategy: GetStrategy.Contents,
    }
  );

  if (!actionToUpdate) throw new Error('Could not find record to be updated');

  const original_entry_hash = (actionToUpdate.hashed.content as NewEntryAction)
    .entry_hash;
  if (!original_entry_hash)
    throw new Error(`Trying to update an record with no entry`);

  const updateAction = buildUpdate(
    worskpace.state,
    entry,
    entry_type,
    original_entry_hash,
    original_action_hash
  );

  const record: Record = {
    signed_action: buildShh(updateAction),
    entry: {
      Present: entry,
    },
  };
  putRecord(record)(worskpace.state);

  return record.signed_action.hashed.hash;
}
