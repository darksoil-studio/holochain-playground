import { serializeHash } from '@holochain-open-dev/core-types';
import { NewEntryHeader, DhtOp, EntryHash } from '@holochain/conductor-api';
import {
  getAppEntryType,
  CellMap,
  HoloHashMap,
  SimulatedDna,
} from '@holochain-playground/simulator';
import uniq from 'lodash-es/uniq';

import { shortenStrRec } from '../utils/hash';
import { isEntryDeleted, summarizeDht } from './dht';
import { getEntryContents } from '../utils/utils';

export function allEntries(
  dhtShards: CellMap<DhtOp[]>,
  simulatedDna: SimulatedDna | undefined,
  showEntryContents: boolean,
  showDeleted: boolean,
  showHeaders: boolean,
  excludedEntryTypes: string[]
) {
  const summary = summarizeDht(dhtShards, simulatedDna);

  const nodes = [];
  const edges = [];

  const depsNotHeld = new HoloHashMap<boolean>();
  const nodesDrawn = new HoloHashMap<boolean>();

  // Add entry nodes

  for (const [entryHash, entry] of summary.entries.entries()) {
    const entryType = summary.entryTypes.get(entryHash);

    if (!excludedEntryTypes.includes(entryType)) {
      const strEntryHash = serializeHash(entryHash);

      const classes = [entryType, 'entry'];

      if (isEntryDeleted(summary, entryHash)) {
        classes.push('deleted');
      }

      nodes.push({
        data: {
          id: strEntryHash,
          data: entry,
          label: `${entryType}`,
        },
        classes,
      });
      nodesDrawn.put(entryHash, true);

      const headers = summary.headersByEntry.get(entryHash);
      const header = summary.headers.get(headers[0]);
      if (getAppEntryType((header as NewEntryHeader).entry_type)) {
        const implicitLinks = getEmbeddedReferences(
          summary.entries,
          entry.content
        );

        for (const implicitLink of implicitLinks) {
          if (
            !excludedEntryTypes.includes(
              summary.entryTypes.get(implicitLink.target)
            )
          ) {
            edges.push({
              data: {
                id: `${entryHash}->${implicitLink.target}`,
                source: entryHash,
                target: implicitLink.target,
                label: implicitLink.label,
              },
              classes: ['embedded-reference'],
            });
            depsNotHeld.put(implicitLink.target, true);
          }
        }
      }

      if (showEntryContents) {
        let entryContent = entry.entry;

        if (!simulatedDna) {
          entryContent = getEntryContents(entry).entry;
        }
        const content = shortenStrRec(entryContent, true);
        if (typeof content === 'object') {
          const properties = Object.keys(entryContent);
          for (const property of properties) {
            const propertyParentId = `${strEntryHash}:${property}`;
            nodes.push({
              data: {
                id: propertyParentId,
                parent: strEntryHash,
                label: '',
              },
            });
            nodes.push({
              data: {
                id: `${propertyParentId}:key`,
                label: property,
                parent: propertyParentId,
              },
            });
            nodes.push({
              data: {
                id: `${propertyParentId}:value`,
                label: content[property],
                parent: propertyParentId,
              },
            });
          }
        } else {
          nodes.push({
            data: {
              id: `${strEntryHash}:content`,
              label: content,
              parent: strEntryHash,
            },
          });
        }
      }
    }
  }

  // Add link edges

  for (const [baseEntryHash, links] of summary.entryLinks.entries()) {
    if (!excludedEntryTypes.includes(summary.entryTypes.get(baseEntryHash))) {
      const strBaseEntryHash = serializeHash(baseEntryHash);
      for (const link of links) {
        if (
          !excludedEntryTypes.includes(
            summary.entryTypes.get(link.target_address)
          )
        ) {
          const tag = JSON.stringify(link.tag);
          const target = serializeHash(link.target_address);

          edges.push({
            data: {
              id: `${strBaseEntryHash}->${target}`,
              source: strBaseEntryHash,
              target,
              label: tag,
            },
            classes: ['explicit-link'],
          });
          depsNotHeld.put(link.target_address, true);
        }
      }
    }
  }

  // Add header nodes and updates edges

  if (showHeaders) {
    for (const [entryHash, headerHashes] of summary.headersByEntry.entries()) {
      if (!excludedEntryTypes.includes(summary.entryTypes.get(entryHash))) {
        const strEntryHash = serializeHash(entryHash);

        for (const headerHash of headerHashes) {
          const header = summary.headers.get(headerHash);
          const strHeaderHash = serializeHash(headerHash);

          nodes.push({
            data: {
              id: strHeaderHash,
              data: header,
              label: header.type,
            },
            classes: [header.type, 'header'],
          });
          nodesDrawn.put(headerHash, true);

          edges.push({
            data: {
              id: `${strHeaderHash}->${strEntryHash}`,
              source: strHeaderHash,
              target: strEntryHash,
              label: 'creates',
              headerReference: true,
            },
            classes: ['embedded-reference', 'header-reference'],
          });

          depsNotHeld.put(entryHash, true);

          for (const updateHeaderHash of summary.headerUpdates.get(
            headerHash
          ) || []) {
            const strUpdateHeaderHash = serializeHash(updateHeaderHash);
            const updateHeader = summary.headers.get(updateHeaderHash);

            if (!nodesDrawn.get(updateHeaderHash)) {
              nodes.push({
                data: {
                  id: strUpdateHeaderHash,
                  data: updateHeader,
                  label: updateHeader.type,
                },
                classes: [updateHeader.type, 'header'],
              });
              nodesDrawn.put(updateHeaderHash, true);
            }

            edges.push({
              data: {
                id: `${strUpdateHeaderHash}-updates-${strHeaderHash}`,
                source: strUpdateHeaderHash,
                target: strHeaderHash,
                label: 'updates',
                headerReference: true,
              },
              classes: ['embedded-reference', 'header-reference'],
            });
            depsNotHeld.put(headerHash, true);
          }

          for (const deleteHeaderHash of summary.headerDeletes.get(
            headerHash
          ) || []) {
            const strDeleteHeaderHash = serializeHash(deleteHeaderHash);
            const deleteHeader = summary.headers.get(deleteHeaderHash);

            if (!nodesDrawn.get(deleteHeaderHash)) {
              nodes.push({
                data: {
                  id: strDeleteHeaderHash,
                  data: deleteHeader,
                  label: deleteHeader.type,
                },
                classes: [deleteHeader.type, 'header'],
              });
              nodesDrawn.put(deleteHeaderHash, true);
            }

            edges.push({
              data: {
                id: `${strDeleteHeaderHash}-deletes-${strHeaderHash}`,
                source: strDeleteHeaderHash,
                target: strHeaderHash,
                label: 'deletes',
                headerReference: true,
              },
              classes: ['embedded-reference', 'header-reference'],
            });
            depsNotHeld.put(headerHash, true);
          }
        }
      }
    }
  } else {
    // Show only updates between entries
    for (const [entryHash, headerHashes] of summary.headersByEntry.entries()) {
      if (!excludedEntryTypes.includes(summary.entryTypes.get(entryHash))) {
        const strOriginalEntryHash = serializeHash(entryHash);

        for (const headerHash of headerHashes) {
          for (const updateHeaderHash of summary.headerUpdates.get(
            headerHash
          ) || []) {
            const updateHeader = summary.headers.get(updateHeaderHash);

            const strUpdateEntryHash = serializeHash(
              (updateHeader as NewEntryHeader).entry_hash
            );

            edges.push({
              data: {
                id: `${strUpdateEntryHash}-updates-${strOriginalEntryHash}`,
                source: strUpdateEntryHash,
                target: strOriginalEntryHash,
                label: 'updates',
              },
              classes: ['embedded-reference'],
            });
            depsNotHeld.put(entryHash, true);
          }
        }
      }
    }
  }

  for (const dep of depsNotHeld.keys()) {
    if (!nodesDrawn.has(dep)) {
      nodes.push({
        data: {
          id: serializeHash(dep),
          label: 'Not Held',
        },
        classes: ['not-held'],
      });
    }
  }

  const allEntryTypes = uniq(summary.entryTypes.values());

  return {
    nodes,
    edges,
    entryTypes: allEntryTypes,
  };
}

export function getEmbeddedReferences(
  allEntries: HoloHashMap<any>,
  value: any
): Array<{ label: string; target: EntryHash }> {
  if (!value) return [];
  if (typeof value === 'object' && ArrayBuffer.isView(value)) {
    return allEntries.has(value as Uint8Array)
      ? [{ label: undefined, target: value as Uint8Array }]
      : [];
  }
  if (
    Array.isArray(value) &&
    value.length > 0 &&
    typeof value[0] === 'object' &&
    ArrayBuffer.isView(value)
  ) {
    return value
      .filter((v) => allEntries.has(v))
      .map((v) => ({ target: v, label: undefined }));
  }
  if (typeof value === 'object') {
    const values = Object.entries(value).map(([key, v]) => {
      const implicitLinks = getEmbeddedReferences(allEntries, v);
      for (const implicitLink of implicitLinks) {
        if (!implicitLink.label) {
          implicitLink.label = key;
        }
      }
      return implicitLinks;
    });
    return [].concat(...values);
  }
  return [];
}
