import { Element } from '@holochain-open-dev/core-types';
import {
  NewEntryHeader,
  Entry,
  EntryType,
  HeaderHash,
} from '@holochain/conductor-api';

import { GetStrategy } from '../../../../../types';
import {
  buildDelete,
  buildShh,
  buildUpdate,
} from '../../../../cell/source-chain/builder-headers';
import { putElement } from '../../../../cell/source-chain/put';
import { HostFnWorkspace } from '../../../host-fn';

export async function common_update(
  worskpace: HostFnWorkspace,
  original_header_hash: HeaderHash,
  entry: Entry,
  entry_type: EntryType
): Promise<HeaderHash> {
  const headerToUpdate = await worskpace.cascade.retrieve_header(
    original_header_hash,
    {
      strategy: GetStrategy.Contents,
    }
  );

  if (!headerToUpdate) throw new Error('Could not find element to be updated');

  const original_entry_hash = (headerToUpdate.header.content as NewEntryHeader)
    .entry_hash;
  if (!original_entry_hash)
    throw new Error(`Trying to update an element with no entry`);

  const updateHeader = buildUpdate(
    worskpace.state,
    entry,
    entry_type,
    original_entry_hash,
    original_header_hash
  );

  const element: Element = {
    signed_header: buildShh(updateHeader),
    entry,
  };
  putElement(element)(worskpace.state);

  return element.signed_header.header.hash;
}
