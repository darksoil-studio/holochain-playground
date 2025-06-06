import { HoloHashMap } from '@darksoil-studio/holochain-utils';
import { CellInfo, CellType, DnaHash, DnaModifiers } from '@holochain/client';
import { encode } from '@msgpack/msgpack';

import { AppRole, SimulatedDna } from '../dnas/simulated-dna';
import { Dictionary } from '../types';

export function simulatedRolesToCellInfo(
	roles: Dictionary<AppRole>,
	registeredDnas: HoloHashMap<DnaHash, SimulatedDna>,
): Dictionary<CellInfo[]> {
	const origin_time = Date.now() * 1000;
	const quantum_time = {
		secs: 1000,
		nanos: 0,
	};
	const cellInfo: Dictionary<CellInfo[]> = {};
	for (const [roleName, role] of Object.entries(roles)) {
		cellInfo[roleName] = role.is_provisioned
			? [
					{
						type: CellType.Provisioned,
						value: {
							cell_id: role.base_cell_id,
							dna_modifiers: {
								network_seed: registeredDnas.get(role.base_cell_id[0])
									.networkSeed,
								properties: encode(
									registeredDnas.get(role.base_cell_id[0]).properties,
								),
							},
							name: roleName,
						},
					},
				]
			: [];

		for (const [cloneName, clone] of Object.entries(role.clones)) {
			cellInfo[roleName].push({
				type: CellType.Cloned,
				value: {
					cell_id: clone,
					enabled: true,
					original_dna_hash: role.base_cell_id[0],
					dna_modifiers: {
						network_seed: registeredDnas.get(clone[0]).networkSeed,
						properties: encode(registeredDnas.get(clone[0]).properties),
					},
					clone_id: cloneName,
					name: roleName,
				},
			});
		}
	}
	return cellInfo;
}
