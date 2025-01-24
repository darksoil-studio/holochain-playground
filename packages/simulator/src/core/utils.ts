import { CellInfo, CellType, DnaModifiers } from '@holochain/client';
import { encode } from '@msgpack/msgpack';

import { AppRole } from '../dnas/simulated-dna';
import { Dictionary } from '../types';

export function simulatedRolesToCellInfo(
	roles: Dictionary<AppRole>,
): Dictionary<CellInfo[]> {
	const mockDnaModifiers: DnaModifiers = {
		network_seed: '',
		properties: encode(undefined),
		origin_time: Date.now() * 1000,
		quantum_time: {
			secs: 1000,
			nanos: 0,
		},
	};
	const cellInfo: Dictionary<CellInfo[]> = {};
	for (const [roleName, role] of Object.entries(roles)) {
		cellInfo[roleName] = role.is_provisioned
			? [
					{
						[CellType.Provisioned]: {
							cell_id: role.base_cell_id,
							dna_modifiers: mockDnaModifiers,
							name: roleName,
						},
					},
				]
			: [];

		for (const [cloneName, clone] of Object.entries(role.clones)) {
			cellInfo[roleName].push({
				[CellType.Cloned]: {
					cell_id: clone,
					enabled: true,
					original_dna_hash: role.base_cell_id[0],
					dna_modifiers: mockDnaModifiers,
					clone_id: cloneName,
					name: roleName,
				},
			});
		}
	}
	return cellInfo;
}
