import {
  Create,
  Entry,
  NewEntryHeader,
  SignedHeaderHashed,
} from '@holochain/client';
import { Element, serializeHash } from '@holochain-open-dev/core-types';
import { getEntryTypeString } from '@holochain-playground/simulator';

import { SimulatedCellStore } from '../../store/simulated-playground-store';
import { CellStore } from '../../store/playground-store';

export function sourceChainNodes(
  cellStore: CellStore<any>,
  elements: Element[]
) {
  const nodes = [];

  for (const element of elements) {
    const header: SignedHeaderHashed = element.signed_header;
    const headerHash = serializeHash(header.header.hash);

    nodes.push({
      data: {
        id: headerHash,
        data: header,
        label: header.header.content.type,
      },
      classes: ['header', header.header.content.type],
    });

    if ((header.header.content as Create).prev_header) {
      const previousHeaderHash = serializeHash(
        (header.header.content as Create).prev_header
      );
      nodes.push({
        data: {
          id: `${headerHash}->${previousHeaderHash}`,
          source: headerHash,
          target: previousHeaderHash,
        },
        classes: ['embedded-reference'],
      });
    }
  }

  for (const element of elements) {
    const header: SignedHeaderHashed = element.signed_header;
    const headerHash = serializeHash(header.header.hash);

    if (element.entry) {
      const newEntryHeader = header.header.content as NewEntryHeader;
      const entryHash = serializeHash(newEntryHeader.entry_hash);
      const entryNodeId = `${headerHash}:${entryHash}`;

      const entry: Entry = element.entry;

      let entryType: string | undefined;

      if (cellStore instanceof SimulatedCellStore) {
        entryType = getEntryTypeString(
          cellStore.dna,
          newEntryHeader.entry_type
        );
      } else {
        entryType = element.entry.entry_type;
      }

      nodes.push({
        data: {
          id: entryNodeId,
          data: entry,
          label: entryType,
        },
        classes: [entryType, 'entry'],
      });
      nodes.push({
        data: {
          id: `${headerHash}->${entryNodeId}`,
          source: headerHash,
          target: entryNodeId,
        },
        classes: ['embedded-reference'],
      });
    }
  }

  return nodes;
}
