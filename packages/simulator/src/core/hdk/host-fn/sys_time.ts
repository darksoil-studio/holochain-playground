import { AgentPubKey, Timestamp } from '@holochain/client';

import { getCellId } from '../../cell/source-chain/utils.js';
import { HostFn, HostFnWorkspace } from '../host-fn.js';

export type SysTimeFn = () => Promise<Timestamp>;

// Creates a new Create action and its entry in the source chain
export const sys_time: HostFn<SysTimeFn> =
	(worskpace: HostFnWorkspace): SysTimeFn =>
	async (): Promise<Timestamp> => {
		return Date.now() * 1000;
	};
