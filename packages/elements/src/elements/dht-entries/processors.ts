import {
  deserializeHash,
  EntryHashB64,
  serializeHash,
} from '@holochain-open-dev/core-types';
import {
  NewEntryHeader,
  DhtOp,
  EntryHash,
  HoloHash,
} from '@holochain/conductor-api';
import {
  getAppEntryType,
  CellMap,
  HashType,
  retype,
  HoloHashMap,
  SimulatedDna,
  getHashType,
} from '@holochain-playground/simulator';
import uniq from 'lodash-es/uniq';

import { shortenStrRec } from '../utils/hash';
import { DhtSummary, isEntryDeleted, summarizeDht } from './dht';
import { getEntryContents, getLinkTagStr } from '../utils/utils';

export function allEntries(
  dhtShards: CellMap<DhtOp[]>,
  simulatedDna: SimulatedDna | undefined,
  showEntryContents: boolean,
  showDeleted: boolean,
  showHeaders: boolean,
  excludedEntryTypes: string[]
) {
  const summary = summarizeDht(dhtShards, simulatedDna);
  let nodes = [];
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
          summary,
          showHeaders,
          getEntryContents(entry)
        );

        for (const implicitLink of implicitLinks) {
          if (
            !excludedEntryTypes.includes(
              summary.entryTypes.get(deserializeHash(implicitLink.target))
            )
          ) {
            edges.push({
              data: {
                id: `${strEntryHash}->${implicitLink.target}`,
                source: strEntryHash,
                target: implicitLink.target,
                label: implicitLink.label,
              },
              classes: ['embedded-reference'],
            });
            depsNotHeld.put(deserializeHash(implicitLink.target), true);
          }
        }
      }

      if (showEntryContents) {
        let entryContent = entry.entry;

        if (!simulatedDna) {
          entryContent = getEntryContents(entry).entry;
        }
        const content = shortenStrRec(entryContent, true);

        const entryContentsNode = getEntryContentsNode(content, strEntryHash);
        nodes = nodes.concat(entryContentsNode);
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
          const linkTag = simulatedDna ? link.tag : getLinkTagStr(link.tag);
          const tag = JSON.stringify(linkTag);
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

function hasHash(
  summary: DhtSummary,
  showHeaders: boolean,
  hash: HoloHash
): HoloHash | undefined {
  if (getHashType(hash) === HashType.HEADER && showHeaders) {
    return summary.headers.has(hash) ? hash : undefined;
  } else {
    let hashToCheck = hash;
    if (getHashType(hash) === HashType.AGENT) {
      hashToCheck = retype(hash, HashType.ENTRY);
    }
    return summary.entries.has(hashToCheck) ? hashToCheck : undefined;
  }
}

function convertToHash(value: any): HoloHash | undefined {
  if (typeof value === 'string' && value.length === 53) {
    return deserializeHash(value);
  } else if (typeof value === 'object' && ArrayBuffer.isView(value)) {
    return value as HoloHash;
  }
}

export function getEmbeddedReferences(
  summary: DhtSummary,
  showHeaders: boolean,
  value: any
): Array<{ label: string; target: EntryHashB64 }> {
  if (!value) return [];

  const hash = convertToHash(value);

  if (hash) {
    const presentHash = hasHash(summary, showHeaders, hash);
    return presentHash
      ? [
          {
            label: undefined,
            target: serializeHash(presentHash),
          },
        ]
      : [];
  }
  if (Array.isArray(value) && value.length > 0 && convertToHash(value[0])) {
    return value
      .filter(
        (v) =>
          !!convertToHash(v) &&
          !!hasHash(summary, showHeaders, convertToHash(v))
      )
      .map((v) => ({
        target: serializeHash(hasHash(summary, showHeaders, convertToHash(v))),
        label: undefined,
      }));
  }
  if (typeof value === 'object') {
    const values = Object.entries(value).map(([key, v]) => {
      const implicitLinks = getEmbeddedReferences(summary, showHeaders, v);
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

function getEntryContentsNode(content: any, parentId: string): Array<any> {
  if (typeof content === 'string') {
    const label = content.length > 20 ? `${content.slice(0, 20)}...` : content;
    return [
      {
        data: {
          id: `${parentId}:content`,
          label,
          parent: parentId,
        },
      },
    ];
  }
  if (typeof content !== 'object') {
    return [
      {
        data: {
          id: `${parentId}:content`,
          label: `${content}`,
          parent: parentId,
        },
      },
    ];
  }

  let nodes = [];
  const properties = Object.keys(content);
  for (const property of properties) {
    const propertyParentId = `${parentId}:${property}`;
    nodes.push({
      data: {
        id: propertyParentId,
        parent: parentId,
        label: property,
      },
    });

    nodes = nodes.concat(
      getEntryContentsNode(content[property], propertyParentId)
    );
  }
  return nodes;
}
