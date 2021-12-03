import { Element } from '@holochain-open-dev/core-types';
import { HeaderHash, NewEntryHeader } from '@holochain/conductor-api';

import { GetStrategy } from '../../../../../types';
import {
  buildDelete,
  buildShh,
} from '../../../../cell/source-chain/builder-headers';
import { putElement } from '../../../../cell/source-chain/put';
import { HostFnWorkspace } from '../../../host-fn';

export async function common_delete(
  worskpace: HostFnWorkspace,
  header_hash: HeaderHash
): Promise<HeaderHash> {
  const headerToDelete = await worskpace.cascade.retrieve_header(header_hash, {
    strategy: GetStrategy.Contents,
  });

  if (!headerToDelete) throw new Error('Could not find element to be deleted');

  const deletesEntryAddress = (headerToDelete.header.content as NewEntryHeader)
    .entry_hash;

  if (!deletesEntryAddress)
    throw new Error(`Trying to delete an element with no entry`);

  const deleteHeader = buildDelete(
    worskpace.state,
    header_hash,
    deletesEntryAddress
  );

  const element: Element = {
    signed_header: buildShh(deleteHeader),
    entry: undefined,
  };
  putElement(element)(worskpace.state);

  return element.signed_header.header.hash;
}
