import { NewEntryAction, Record } from '@holochain/client';

import { QueryFilter } from '../../../types';
import { getAllAuthoredActions } from '../../cell/source-chain/get';
import { HostFn, HostFnWorkspace } from '../host-fn';

export type QueryFn = (filter: QueryFilter) => Promise<Array<Record>>;

// Creates a new Create action and its entry in the source chain
export const query: HostFn<QueryFn> =
  (workspace: HostFnWorkspace): QueryFn =>
  async (filter): Promise<Array<Record>> => {
    const authoredActions = getAllAuthoredActions(workspace.state);

    return authoredActions.map(action => {
      let entry = undefined;

      if ((action.hashed.content as NewEntryAction).entry_hash) {
        entry = workspace.state.CAS.get(
          (action.hashed.content as NewEntryAction).entry_hash
        );
      }

      return {
        signed_action: action,
        entry,
      };
    });
  };
