import { HashType, hash } from '@darksoil-studio/holochain-utils';
import {
	AgentPubKey,
	AgentPubKeyB64,
	CellId,
	DnaHash,
	DnaModifiers,
	EntryVisibility,
	HoloHash,
	Record,
} from '@holochain/client';
import { encode } from '@msgpack/msgpack';

import { ValidationOutcome } from '../core/cell/sys_validate/types.js';
import { Conductor } from '../core/conductor.js';
import {
	SimulatedValidateFunctionContext,
	SimulatedZomeFunctionContext,
} from '../core/hdk/index.js';
import { Dictionary } from '../types.js';

export interface SimulatedZomeFunctionArgument {
	name: string;
	type: string;
}

export interface SimulatedZomeFunction {
	call: (
		context: SimulatedZomeFunctionContext,
	) => (payload: any) => Promise<any>;
	arguments: SimulatedZomeFunctionArgument[];
}

export type SimulatedValidateFunction = (
	context: SimulatedValidateFunctionContext,
) => (payload: any) => Promise<ValidationOutcome>;

export interface SimulatedZome {
	name: string;
	entry_defs: Array<EntryDef>;
	zome_functions: Dictionary<SimulatedZomeFunction>;
	validate?: SimulatedValidateFunction;
	blocklyCode?: string;
}

export interface SimulatedDna {
	zomes: Array<SimulatedZome>;
	properties: Dictionary<any>;
	networkSeed: string;
}

export interface SimulatedDnaRole {
	dna: SimulatedDna;
	deferred: boolean;
}
export interface SimulatedHappBundle {
	name: string;
	description: string;
	roles: Dictionary<SimulatedDnaRole>;
}

export interface AppRole {
	base_cell_id: CellId;
	is_provisioned: boolean;
	clones: Dictionary<CellId>;
}

export interface InstalledHapp {
	app_id: string;
	agent_pub_key: AgentPubKey;
	roles: Dictionary<AppRole>;
	installed_at: number;
}

export interface EntryDef {
	id: string;
	visibility: EntryVisibility;
}

export function hashDna(dna: SimulatedDna): HoloHash {
	const freeOfFunctionsDna = deepMap(dna, f => {
		if (typeof f !== 'function') return f;
		else return f.toString();
	});

	return hash(freeOfFunctionsDna, HashType.DNA);
}

function deepMap<T, R>(obj: any, cb: (o: T, key: string) => R) {
	var out: any = {};

	Object.keys(obj).forEach(function (k) {
		var val: any;

		if (obj[k] !== null && typeof obj[k] === 'object') {
			val = deepMap(obj[k], cb);
		} else {
			val = cb(obj[k], k);
		}

		out[k] = val as any;
	});

	return out;
}
