import { Element } from '@holochain-open-dev/core-types';
import { NewEntryHeader } from '@holochain/conductor-api';

import { QueryFilter } from '../../../types';
import { getAllAuthoredHeaders } from '../../cell/source-chain/get';
import { HostFn, HostFnWorkspace } from '../host-fn';

export type QueryFn = (filter: QueryFilter) => Promise<Array<Element>>;

// Creates a new Create header and its entry in the source chain
export const query: HostFn<QueryFn> =
  (workspace: HostFnWorkspace): QueryFn =>
  async (filter): Promise<Array<Element>> => {
    const authoredHeaders = getAllAuthoredHeaders(workspace.state);

    return authoredHeaders.map(header => {
      let entry = undefined;

      if ((header.header.content as NewEntryHeader).entry_hash) {
        entry = workspace.state.CAS.get(
          (header.header.content as NewEntryHeader).entry_hash
        );
      }

      return {
        signed_header: header,
        entry,
      };
    });
  };
