import { Context, createContext } from '@lit-labs/context';
import { PlaygroundStore } from '../store/playground-store';
import { PlaygroundMode } from '../store/mode';

export type PlaygroundContext<T extends PlaygroundMode> = Context<
  PlaygroundStore<T>
>;

export const playgroundContext: PlaygroundContext<any> = createContext(
  'holochain-playground/store'
);
