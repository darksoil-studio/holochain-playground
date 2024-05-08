import {
	SimulatedHappBundle,
	createConductors,
	demoHapp,
} from '@holochain-playground/simulator';
import { property } from 'lit/decorators.js';

import { PlaygroundMode } from '../store/mode.js';
import { SimulatedPlaygroundStore } from '../store/simulated-playground-store.js';
import { BasePlaygroundContext } from './base-playground-context.js';

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
		).then(() => {
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
