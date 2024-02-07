import { createContext } from '@lit/context';
import { PlaygroundStore } from '../store/playground-store.js';
import { PlaygroundMode } from '../store/mode.js';

export const playgroundContext = createContext<PlaygroundStore<any>>(
  'holochain-playground/store'
);
