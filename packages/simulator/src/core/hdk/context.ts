import { HostFnWorkspace } from './host-fn.js';
import {
  CreateCapGrantFn,
  create_cap_grant,
} from './host-fn/actions/create_cap_grant.js';
import { CreateEntryFn, create_entry } from './host-fn/actions/create_entry.js';
import { CreateLinkFn, create_link } from './host-fn/actions/create_link.js';
import {
  DeleteCapGrantFn,
  delete_cap_grant,
} from './host-fn/actions/delete_cap_grant.js';
import { DeleteEntryFn, delete_entry } from './host-fn/actions/delete_entry.js';
import { DeleteLinkFn, delete_link } from './host-fn/actions/delete_link.js';
import { UpdateEntryFn, update_entry } from './host-fn/actions/update_entry.js';
import { AgentInfoFn, agent_info } from './host-fn/agent_info.js';
import { CallRemoteFn, call_remote } from './host-fn/call_remote.js';
import { get, GetFn } from './host-fn/get.js';
import { GetDetailsFn, get_details } from './host-fn/get_details.js';
import { GetLinksFn, get_links } from './host-fn/get_links.js';
import { HashEntryFn, hash_entry } from './host-fn/hash_entry.js';
import { query, QueryFn } from './host-fn/query.js';
import { ensure, Path } from './path.js';

export interface SimulatedValidateFunctionContext {
  get: GetFn;
  get_details: GetDetailsFn;
  hash_entry: HashEntryFn;
  get_links: GetLinksFn;
}
export interface Hdk extends SimulatedValidateFunctionContext {
  create_entry: CreateEntryFn;
  delete_entry: DeleteEntryFn;
  update_entry: UpdateEntryFn;
  create_link: CreateLinkFn;
  create_cap_grant: CreateCapGrantFn;
  delete_cap_grant: DeleteCapGrantFn;
  delete_link: DeleteLinkFn;
  call_remote: CallRemoteFn;
  agent_info: AgentInfoFn;
  query: QueryFn;
}

export interface SimulatedZomeFunctionContext extends Hdk {
  path: Path;
}

export function buildValidationFunctionContext(
  workspace: HostFnWorkspace,
  zome_index: number
): SimulatedValidateFunctionContext {
  return {
    hash_entry: hash_entry(workspace, zome_index),
    get: get(workspace, zome_index),
    get_details: get_details(workspace, zome_index),
    get_links: get_links(workspace, zome_index),
  };
}

export function buildZomeFunctionContext(
  workspace: HostFnWorkspace,
  zome_index: number
): SimulatedZomeFunctionContext {
  const hdk: Hdk = {
    ...buildValidationFunctionContext(workspace, zome_index),
    create_entry: create_entry(workspace, zome_index),
    delete_entry: delete_entry(workspace, zome_index),
    update_entry: update_entry(workspace, zome_index),
    create_link: create_link(workspace, zome_index),
    delete_link: delete_link(workspace, zome_index),
    create_cap_grant: create_cap_grant(workspace, zome_index),
    delete_cap_grant: delete_cap_grant(workspace, zome_index),
    call_remote: call_remote(workspace, zome_index),
    agent_info: agent_info(workspace, zome_index),
    query: query(workspace, zome_index),
  };

  return {
    ...hdk,
    path: {
      ensure: ensure(hdk),
    },
  };
}
