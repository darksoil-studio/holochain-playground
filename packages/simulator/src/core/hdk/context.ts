import { HostFnWorkspace } from './host-fn.js';
import { CloseChainFn, close_chain } from './host-fn/actions/close_chain.js';
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
import { OpenChainFn, open_chain } from './host-fn/actions/open_chain.js';
import { UpdateEntryFn, update_entry } from './host-fn/actions/update_entry.js';
import { AgentInfoFn, agent_info } from './host-fn/agent_info.js';
import { CallRemoteFn, call_remote } from './host-fn/call_remote.js';
import { GetFn, get } from './host-fn/get.js';
import {
	GetAgentActivityFn,
	get_agent_activity,
} from './host-fn/get_agent_activity.js';
import { GetDetailsFn, get_details } from './host-fn/get_details.js';
import {
	GetLinkDetailsFn,
	get_link_details,
} from './host-fn/get_link_details.js';
import { GetLinksFn, get_links } from './host-fn/get_links.js';
import { HashEntryFn, hash_entry } from './host-fn/hash_entry.js';
import { QueryFn, query } from './host-fn/query.js';
import { SysTimeFn, sys_time } from './host-fn/sys_time.js';
import { Path, ensure } from './path.js';

export interface SimulatedValidateFunctionContext {
	get: GetFn;
	get_details: GetDetailsFn;
	hash_entry: HashEntryFn;
	get_links: GetLinksFn;
	get_link_details: GetLinkDetailsFn;
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
	open_chain: OpenChainFn;
	close_chain: CloseChainFn;
	get_agent_activity: GetAgentActivityFn;
	sys_time: SysTimeFn;
}

export interface SimulatedZomeFunctionContext extends Hdk {
	path: Path;
}

export function buildValidationFunctionContext(
	workspace: HostFnWorkspace,
	zome_index: number,
): SimulatedValidateFunctionContext {
	return {
		hash_entry: hash_entry(workspace, zome_index),
		get: get(workspace, zome_index),
		get_details: get_details(workspace, zome_index),
		get_links: get_links(workspace, zome_index),
		get_link_details: get_link_details(workspace, zome_index),
	};
}

export function buildZomeFunctionContext(
	workspace: HostFnWorkspace,
	zome_index: number,
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
		open_chain: open_chain(workspace, zome_index),
		close_chain: close_chain(workspace, zome_index),
		get_agent_activity: get_agent_activity(workspace, zome_index),
		sys_time: sys_time(workspace, zome_index),
	};

	return {
		...hdk,
		path: {
			ensure: ensure(hdk),
		},
	};
}
