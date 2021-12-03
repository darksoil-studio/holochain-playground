import { setCustomElements } from '@storybook/web-components';
import ce from '../custom-elements.json';

setCustomElements(ce);

export const parameters = {
  actions: { argTypesRegex: '^on[A-Z].*' },
};

import {
  HolochainPlaygroundContainer,
  DhtCells,
  SourceChain,
  EntryContents,
  EntryGraph,
  CallZomeFns,
} from '../dist';
customElements.define(
  'holochain-playground-container',
  HolochainPlaygroundContainer
);
customElements.define('dht-cells', DhtCells);
customElements.define('source-chain', SourceChain);
customElements.define('entry-graph', EntryGraph);
customElements.define('entry-contents', EntryContents);
customElements.define('call-zome-fns', CallZomeFns);
