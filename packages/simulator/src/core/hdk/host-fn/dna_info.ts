import { DnaHash, DnaModifiers, ZomeName } from '@holochain/client';
import { encode } from '@msgpack/msgpack';

import { getCellId } from '../../cell/source-chain/utils.js';
import { HostFn, HostFnWorkspace } from '../host-fn.js';

export interface DnaInfo {
	name: string;
	hash: DnaHash;
	modifiers: DnaModifiers;
	zome_names: Array<ZomeName>;
}

export type DnaInfoFn = () => Promise<DnaInfo>;

export const dna_info: HostFn<DnaInfoFn> =
	(workspace: HostFnWorkspace): DnaInfoFn =>
	async (): Promise<DnaInfo> => {
		const cellId = getCellId(workspace.state);
		const dnaHash = cellId[0];
		const origin_time = Date.now() * 1000;
		const quantum_time = {
			secs: 1000,
			nanos: 0,
		};
		return {
			name: '',
			hash: dnaHash,
			modifiers: {
				network_seed: workspace.dna.networkSeed,
				properties: encode(workspace.dna.properties),
				origin_time,
				quantum_time,
			},
			zome_names: workspace.dna.zomes.map(z => z.name),
		};
	};
