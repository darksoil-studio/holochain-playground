import { CellMap } from '@darksoil-studio/holochain-utils';

import { SimulatedDna } from '../dnas/simulated-dna.js';

export interface BadAgentConfig {
	disable_validation_before_publish: boolean;
	pretend_invalid_records_are_valid: boolean;
}

export interface BadAgent {
	config: BadAgentConfig;

	counterfeitDnas: CellMap<SimulatedDna>; // Segmented by DnaHash / AgentPubKey
}
