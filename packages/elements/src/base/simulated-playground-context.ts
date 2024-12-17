import {
	SimulatedHappBundle,
	createConductors,
	demoHapp,
} from '@holochain-playground/simulator';
import { customElement, property } from 'lit/decorators.js';

import {
	SimulatedConductorStore,
	SimulatedPlaygroundStore,
} from '../store/simulated-playground-store.js';
import { BasePlaygroundContext } from './base-playground-context.js';

@customElement('simulated-playground-context')
export class SimulatedPlaygroundContext extends BasePlaygroundContext<SimulatedPlaygroundStore> {
	@property({ type: Number })
	numberOfSimulatedConductors: number = 10;

	@property({ type: Object })
	simulatedHapp: SimulatedHappBundle = demoHapp();

	/** Context variables */

	buildStore() {
		const store = new SimulatedPlaygroundStore([], this.simulatedHapp);
		createConductors(
			this.numberOfSimulatedConductors,
			[],
			this.simulatedHapp,
		).then(conductors => {
			store.conductors.set(conductors.map(c => new SimulatedConductorStore(c)));
			store.activeDna.set(conductors[0].cells.cellIds()[0][0]);
			this.dispatchEvent(
				new CustomEvent('playground-ready', {
					bubbles: true,
					composed: true,
					detail: {
						store,
					},
				}),
			);
		});
		return store;
	}
}
