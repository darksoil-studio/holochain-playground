import { SimulatedDna } from '../../dnas/simulated-dna.js';
import { Cascade } from '../cell/cascade/cascade.js';
import { CellState } from '../cell/state.js';
import { P2pCell } from '../network/p2p-cell.js';

export type HostFn<Fn extends Function> = (
  hostFnWorkspace: HostFnWorkspace,
  zome_index: number
) => Fn;

export interface HostFnWorkspace {
  state: CellState;
  p2p: P2pCell;
  cascade: Cascade;
  dna: SimulatedDna;
}
