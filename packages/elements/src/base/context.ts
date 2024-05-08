import { createContext } from '@lit/context';

import { ConnectedPlaygroundStore } from '../store/connected-playground-store.js';
import { SimulatedPlaygroundStore } from '../store/simulated-playground-store.js';

export const playgroundContext = createContext<
	SimulatedPlaygroundStore | ConnectedPlaygroundStore
>('holochain-playground/store');
