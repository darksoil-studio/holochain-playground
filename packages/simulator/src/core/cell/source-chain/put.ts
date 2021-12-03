import { CellState } from '../state';
import { Element } from '@holochain-open-dev/core-types';
import { hashEntry } from '../utils';

export const putElement =
  (element: Element) =>
  (state: CellState): void => {
    // Put header in CAS
    const headerHash = element.signed_header.header.hash;
    state.CAS.put(headerHash, element.signed_header);

    // Put entry in CAS if it exist
    if (element.entry) {
      const entryHash = hashEntry(element.entry);
      state.CAS.put(entryHash, element.entry);
    }

    state.sourceChain.push(headerHash);
  };
