import { P2pCell } from '../..';
import { SimulatedDna } from '../../dnas/simulated-dna';
import { Cell, CellState } from '../cell';
import { Cascade } from '../cell/cascade/cascade';

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
