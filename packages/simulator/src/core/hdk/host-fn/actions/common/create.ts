import { Element } from '@holochain-open-dev/core-types';
import { HeaderHash, Entry, EntryType } from '@holochain/conductor-api';

import {
  buildCreate,
  buildShh,
} from '../../../../cell/source-chain/builder-headers';
import { putElement } from '../../../../cell/source-chain/put';
import { HostFnWorkspace } from '../../../host-fn';

export function common_create(
  worskpace: HostFnWorkspace,
  entry: Entry,
  entry_type: EntryType
): HeaderHash {
  const create = buildCreate(worskpace.state, entry, entry_type);

  const element: Element = {
    signed_header: buildShh(create),
    entry,
  };
  putElement(element)(worskpace.state);

  return element.signed_header.header.hash;
}
