import { ContextKey, createContext } from '@lit-labs/context';
import { PlaygroundStore } from '../store/playground-store';
import { PlaygroundMode } from '../store/mode';

export type PlaygroundContext<
  T extends PlaygroundMode,
  S extends PlaygroundStore<T>
> = ContextKey<S>;

export const playgroundContext: PlaygroundContext<any, any> = createContext(
  'holochain-playground/store'
);
