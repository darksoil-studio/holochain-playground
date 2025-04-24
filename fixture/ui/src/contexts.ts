import { AppClient } from '@holochain/client';
import { createContext } from '@lit-labs/context';

export const clientContext = createContext<AppClient>('appAgentClient');
