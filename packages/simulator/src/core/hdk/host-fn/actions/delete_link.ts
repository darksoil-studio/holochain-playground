import { Element } from '@holochain-open-dev/core-types';
import { HeaderHash, CreateLink } from '@holochain/conductor-api';

import { GetStrategy } from '../../../../types';
import {
  buildDeleteLink,
  buildShh,
} from '../../../cell/source-chain/builder-headers';
import { putElement } from '../../../cell/source-chain/put';
import { HostFn, HostFnWorkspace } from '../../host-fn';

export type DeleteLinkFn = (deletes_address: HeaderHash) => Promise<HeaderHash>;

// Creates a new Create header and its entry in the source chain
export const delete_link: HostFn<DeleteLinkFn> =
  (worskpace: HostFnWorkspace): DeleteLinkFn =>
  async (deletes_address): Promise<HeaderHash> => {
    const elementToDelete = await worskpace.cascade.dht_get(deletes_address, {
      strategy: GetStrategy.Contents,
    });

    if (!elementToDelete)
      throw new Error('Could not find element to be deleted');

    const baseAddress = (
      elementToDelete.signed_header.header.content as CreateLink
    ).base_address;

    if (!baseAddress)
      throw new Error('Header for the given hash is not a CreateLink header');

    const deleteHeader = buildDeleteLink(
      worskpace.state,
      baseAddress,
      deletes_address
    );

    const element: Element = {
      signed_header: buildShh(deleteHeader),
      entry: undefined,
    };
    putElement(element)(worskpace.state);

    return element.signed_header.header.hash;
  };
