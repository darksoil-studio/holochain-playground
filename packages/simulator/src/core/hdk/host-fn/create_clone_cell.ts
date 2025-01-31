import {
	CapSecret,
	CellId,
	CloneId,
	DnaHash,
	DnaModifiers,
} from '@holochain/client';

import { Dictionary } from '../../../types.js';
import { Conductor } from '../../conductor.js';
import { HostFn, HostFnWorkspace } from '../host-fn.js';

export interface CreateCloneCellInput {
	cell_id: CellId;
	modifiers: Dictionary<any>;
	membrane_proof: Uint8Array | undefined;
	name: string | undefined;
}

export interface ClonedCell {
	cell_id: CellId;
	clone_id: CloneId;
	original_dna_hash: DnaHash;
	dna_modifiers: DnaModifiers;
	name: string;
	enabled: boolean;
}

export type CreateCloneCellFn = (input: CreateCloneCellInput) => Promise<any>;

export const create_clone_cell: HostFn<CreateCloneCellFn> =
	(workspace: HostFnWorkspace): CreateCloneCellFn =>
	async (input): Promise<any> => {
		// UNIMPLEMENTED!
	};
