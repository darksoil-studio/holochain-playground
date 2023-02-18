import {
  EntryHash,
  ActionHash,
  Record,
  AnyDhtHash,
  encodeHashToBase64,
} from '@holochain/client';
import {
  buildCreateLink,
  buildShh,
} from '../../../cell/source-chain/builder-actions.js';
import { putRecord } from '../../../cell/source-chain/put.js';
import { HostFn, HostFnWorkspace } from '../../host-fn.js';

export type CreateLinkFn = (args: {
  base: AnyDhtHash;
  target: AnyDhtHash;
  tag: any;
}) => Promise<ActionHash>;

// Creates a new CreateLink action in the source chain
export const create_link: HostFn<CreateLinkFn> =
  (worskpace: HostFnWorkspace, zome_id: number): CreateLinkFn =>
  async (args): Promise<ActionHash> => {
    const createLink = buildCreateLink(
      worskpace.state,
      zome_id,
      args.base,
      args.target,
      args.tag
    );

    const element: Record = {
      signed_action: buildShh(createLink),
      entry: { NotApplicable: null },
    };
    putRecord(element)(worskpace.state);
    return element.signed_action.hashed.hash;
  };
