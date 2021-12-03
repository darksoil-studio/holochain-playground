import { SimulatedDna } from '../dnas/simulated-dna';
import { CellMap, HoloHashMap } from '../processors/holo-hash-map';

export interface BadAgentConfig {
  disable_validation_before_publish: boolean;
  pretend_invalid_elements_are_valid: boolean;
}

export interface BadAgent {
  config: BadAgentConfig;

  counterfeitDnas: CellMap<SimulatedDna>; // Segmented by DnaHash / AgentPubKey
}
