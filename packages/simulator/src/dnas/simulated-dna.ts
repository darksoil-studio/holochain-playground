import {
  AgentPubKeyB64,
  Dictionary,
  Element,
  DnaHashB64,
} from '@holochain-open-dev/core-types';
import {
  EntryVisibility,
  CellId,
  DnaHash,
  AgentPubKey,
  HoloHash,
} from '@holochain/client';
import { ValidationOutcome } from '../core/cell/sys_validate/types';
import {
  SimulatedValidateFunctionContext,
  SimulatedZomeFunctionContext,
} from '../core/hdk';
import { hash, HashType } from '../processors/hash';

export interface SimulatedZomeFunctionArgument {
  name: string;
  type: string;
}

export interface SimulatedZomeFunction {
  call: (
    context: SimulatedZomeFunctionContext
  ) => (payload: any) => Promise<any>;
  arguments: SimulatedZomeFunctionArgument[];
}

export type SimulatedValidateFunction = (
  context: SimulatedValidateFunctionContext
) => (payload: any) => Promise<ValidationOutcome>;

export interface SimulatedZome {
  name: string;
  entry_defs: Array<EntryDef>;
  zome_functions: Dictionary<SimulatedZomeFunction>;
  validation_functions: {
    validate_create_agent?: (
      context: SimulatedValidateFunctionContext
    ) => (args: {
      element: Element;
      agent_pub_key: AgentPubKeyB64;
      membrane_proof: any;
    }) => Promise<ValidationOutcome>;
  } & Dictionary<SimulatedValidateFunction>;
  blocklyCode?: string;
}

export interface SimulatedDna {
  zomes: Array<SimulatedZome>;
  properties: Dictionary<any>;
  uid: string;
}

export interface SimulatedDnaRole {
  dna: SimulatedDna | DnaHash;
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
  clones: CellId[];
}

export interface InstalledHapps {
  app_id: string;
  agent_pub_key: AgentPubKey;
  roles: Dictionary<AppRole>;
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
