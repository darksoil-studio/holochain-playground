import { property } from 'lit/decorators.js';
import { demoHapp, SimulatedHappBundle } from '@holochain-playground/simulator';
import { BasePlaygroundContext } from './base-playground-context';
import { SimulatedPlaygroundStore } from '../store/simulated-playground-store';
import { PlaygroundMode } from '../store/mode';

export class SimulatedPlaygroundContext extends BasePlaygroundContext<
  PlaygroundMode.Simulated,
  SimulatedPlaygroundStore
> {
  @property({ type: Number })
  numberOfSimulatedConductors: number = 10;

  @property({ type: Object })
  simulatedHapp: SimulatedHappBundle = demoHapp();

  /** Context variables */

  async buildStore() {
    return SimulatedPlaygroundStore.create(
      this.numberOfSimulatedConductors,
      this.simulatedHapp
    );
  }
}
