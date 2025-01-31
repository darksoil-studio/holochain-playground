import { CapSecret, CellId } from '@holochain/client';

import { Conductor } from '../../conductor.js';
import { HostFn, HostFnWorkspace } from '../host-fn.js';

export type CallTargetCell =
	| { OtherCell: CellId }
	| { OtherRole: string }
	| { Local: void };

export type CallFn = (
	to_cell: CallTargetCell,
	zome: string,
	fn_name: string,
	cap_secret: CapSecret | undefined,
	payload: any,
) => Promise<any>;

function getCellId(
	callerCell: CellId,
	targetCell: CallTargetCell,
	conductorHandle: Conductor,
) {
	if ('Local' in targetCell) {
		return callerCell;
	} else if ('OtherCell' in targetCell) {
		return targetCell.OtherCell;
	} else {
		const happ = Object.values(conductorHandle.installedHapps).find(happ =>
			Object.entries(happ.roles).find(([role, cells]) =>
				isEqual(cells.base_cell_id, callerCell),
			),
		);
		if (!happ)
			throw new Error(`A non-existant cell is making a call zome fn request.`);
		const role = targetCell.OtherRole;

		const isClone = role.includes('.');

		if (isClone) {
			const roleWithoutClone = role.split('.')[0];
			return happ.roles[roleWithoutClone].clones[role];
		} else {
			return happ.roles[role].base_cell_id;
		}
	}
}
function isEqual(cellId1: CellId, cellId2: CellId): boolean {
	return cellId1.toString() === cellId2.toString();
}

export const call: HostFn<CallFn> =
	(workspace: HostFnWorkspace): CallFn =>
	async (to_cell, zome, fn_name, cap_secret, payload): Promise<any> => {
		const cellId = getCellId(
			[workspace.state.dnaHash, workspace.state.agentPubKey],
			to_cell,
			workspace.conductor_handle,
		);

		return workspace.conductor_handle.callZomeFn({
			cellId,
			cap: cap_secret,
			fnName: fn_name,
			zome: zome,
			payload: payload,
		});
	};
