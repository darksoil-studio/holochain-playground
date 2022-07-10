import { deserializeHash, serializeHash } from '@holochain-open-dev/utils';
import { EntryHashB64 } from '@holochain-open-dev/core-types';
import {
  NewEntryAction,
  DhtOp,
  EntryHash,
  HoloHash,
  Action,
} from '@holochain/client';
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
  hideActions: boolean,
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

      const actions = summary.actionsByEntry.get(entryHash);
      const action = summary.actions.get(actions[0]);
      if (getAppEntryType((action as NewEntryAction).entry_type)) {
        const implicitLinks = getEmbeddedReferences(
          summary,
          !hideActions,
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

  for (const [baseAddress, links] of summary.links.entries()) {
    let entryHash;
    if (getHashType(baseAddress) === HashType.ENTRY) {
      entryHash = baseAddress;
    } else if (getHashType(baseAddress) === HashType.ACTION) {
      const action: Action = summary.actions.get(baseAddress);
      if ((action as NewEntryAction).entry_hash) {
        entryHash = (action as NewEntryAction).entry_hash;
      }
    }

    if (
      !entryHash ||
      !excludedEntryTypes.includes(summary.entryTypes.get(entryHash))
    ) {
      depsNotHeld.put(baseAddress, true);

      const strBaseHash = serializeHash(baseAddress);
      for (const link of links) {

        let targetEntryHash;
        if (getHashType(link.target_address) === HashType.ENTRY) {
          targetEntryHash = link.target_address;
        } else if (getHashType(link.target_address) === HashType.ACTION) {
          const action: Action = summary.actions.get(link.target_address);
          if ((action as NewEntryAction).entry_hash) {
            targetEntryHash = (action as NewEntryAction).entry_hash;
          }
        }
    
        if (!targetEntryHash ||
          !excludedEntryTypes.includes(
            summary.entryTypes.get(targetEntryHash)
          )
        ) {
          const linkTag = simulatedDna ? link.tag : getLinkTagStr(link.tag);
          const tag = JSON.stringify(linkTag);
          const target = serializeHash(link.target_address);

          edges.push({
            data: {
              id: `${strBaseHash}->${target}`,
              source: strBaseHash,
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

  // Add action nodes and updates edges

  if (!hideActions) {
    for (const [entryHash, actionHashes] of summary.actionsByEntry.entries()) {
      if (!excludedEntryTypes.includes(summary.entryTypes.get(entryHash))) {
        const strEntryHash = serializeHash(entryHash);

        for (const actionHash of actionHashes) {
          const action = summary.actions.get(actionHash);
          const strActionHash = serializeHash(actionHash);

          nodes.push({
            data: {
              id: strActionHash,
              data: action,
              label: action.type,
            },
            classes: [action.type, 'action'],
          });
          nodesDrawn.put(actionHash, true);

          edges.push({
            data: {
              id: `${strActionHash}->${strEntryHash}`,
              source: strActionHash,
              target: strEntryHash,
              label: 'creates',
              actionReference: true,
            },
            classes: ['embedded-reference', 'action-reference'],
          });

          depsNotHeld.put(entryHash, true);

          for (const updateActionHash of summary.actionUpdates.get(
            actionHash
          ) || []) {
            const strUpdateActionHash = serializeHash(updateActionHash);
            const updateAction = summary.actions.get(updateActionHash);

            if (!nodesDrawn.get(updateActionHash)) {
              nodes.push({
                data: {
                  id: strUpdateActionHash,
                  data: updateAction,
                  label: updateAction.type,
                },
                classes: [updateAction.type, 'action'],
              });
              nodesDrawn.put(updateActionHash, true);
            }

            edges.push({
              data: {
                id: `${strUpdateActionHash}-updates-${strActionHash}`,
                source: strUpdateActionHash,
                target: strActionHash,
                label: 'updates',
                actionReference: true,
              },
              classes: ['embedded-reference', 'action-reference'],
            });
            depsNotHeld.put(actionHash, true);
          }

          for (const deleteActionHash of summary.actionDeletes.get(
            actionHash
          ) || []) {
            const strDeleteActionHash = serializeHash(deleteActionHash);
            const deleteAction = summary.actions.get(deleteActionHash);

            if (!nodesDrawn.get(deleteActionHash)) {
              nodes.push({
                data: {
                  id: strDeleteActionHash,
                  data: deleteAction,
                  label: deleteAction.type,
                },
                classes: [deleteAction.type, 'action'],
              });
              nodesDrawn.put(deleteActionHash, true);
            }

            edges.push({
              data: {
                id: `${strDeleteActionHash}-deletes-${strActionHash}`,
                source: strDeleteActionHash,
                target: strActionHash,
                label: 'deletes',
                actionReference: true,
              },
              classes: ['embedded-reference', 'action-reference'],
            });
            depsNotHeld.put(actionHash, true);
          }
        }
      }
    }
  } else {
    // Show only updates between entries
    for (const [entryHash, actionHashes] of summary.actionsByEntry.entries()) {
      if (!excludedEntryTypes.includes(summary.entryTypes.get(entryHash))) {
        const strOriginalEntryHash = serializeHash(entryHash);

        for (const actionHash of actionHashes) {
          for (const updateActionHash of summary.actionUpdates.get(
            actionHash
          ) || []) {
            const updateAction = summary.actions.get(updateActionHash);

            const strUpdateEntryHash = serializeHash(
              (updateAction as NewEntryAction).entry_hash
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
  showActions: boolean,
  hash: HoloHash
): HoloHash | undefined {
  if (getHashType(hash) === HashType.ACTION && showActions) {
    return summary.actions.has(hash) ? hash : undefined;
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
  return undefined;
}

export function getEmbeddedReferences(
  summary: DhtSummary,
  showActions: boolean,
  value: any
): Array<{ label: string; target: EntryHashB64 }> {
  if (!value) return [];

  const hash = convertToHash(value);

  if (hash) {
    const presentHash = hasHash(summary, showActions, hash);
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
          !!hasHash(summary, showActions, convertToHash(v))
      )
      .map((v) => ({
        target: serializeHash(hasHash(summary, showActions, convertToHash(v))),
        label: undefined,
      }));
  }
  if (typeof value === 'object') {
    const values = Object.entries(value).map(([key, v]) => {
      const implicitLinks = getEmbeddedReferences(summary, showActions, v);
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
  if (content === null || content === undefined) return [];

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
