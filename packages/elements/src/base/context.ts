import { createContext } from '@lit-labs/context';
import { PlaygroundStore } from '../store/playground-store';
import { PlaygroundMode } from '../store/mode';


export const playgroundContext = createContext<PlaygroundStore<any>>(
  'holochain-playground/store'
);
