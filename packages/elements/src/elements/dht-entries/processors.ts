import {
	CellMap,
	HashType,
	HoloHashMap,
	getHashType,
	retype,
} from '@holochain-open-dev/utils';
import { SimulatedDna, getAppEntryType } from '@holochain-playground/simulator';
import {
	Action,
	DhtOp,
	EntryHashB64,
	HoloHash,
	NewEntryAction,
	decodeHashFromBase64,
	encodeHashToBase64,
} from '@holochain/client';
import uniq from 'lodash-es/uniq.js';

import { shortenStrRec } from '../utils/hash.js';
import { getEntryContents, getLinkTagStr } from '../utils/utils.js';
import { DhtSummary, isEntryDeleted, summarizeDht } from './dht.js';

export function allEntries(
	dhtShards: CellMap<DhtOp[]>,
	simulatedDna: SimulatedDna | undefined,
	showEntryContents: boolean,
	showDeleted: boolean,
	excludedEntryTypes: string[],
) {
	const summary = summarizeDht(dhtShards, simulatedDna);
	let nodes: any[] = [];
	const edges: any[] = [];

	const depsNotHeld = new HoloHashMap<HoloHash, boolean>();
	const nodesDrawn = new HoloHashMap<HoloHash, boolean>();

	// Add entry nodes

	for (const [entryHash, entry] of summary.entries.entries()) {
		const entryType = summary.entryTypes.get(entryHash);

		if (!excludedEntryTypes.includes(entryType)) {
			const strEntryHash = encodeHashToBase64(entryHash);

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
			nodesDrawn.set(entryHash, true);

			const actions = summary.actionsByEntry.get(entryHash);
			const action = summary.actions.get(actions[0]);
			if (getAppEntryType((action as NewEntryAction).entry_type)) {
				const implicitLinks = getEmbeddedReferences(
					summary,
					getEntryContents(entry),
				);

				for (const implicitLink of implicitLinks) {
					if (
						!excludedEntryTypes.includes(
							summary.entryTypes.get(decodeHashFromBase64(implicitLink.target)),
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
						depsNotHeld.set(decodeHashFromBase64(implicitLink.target), true);
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
			if (action && (action as NewEntryAction).entry_hash) {
				entryHash = (action as NewEntryAction).entry_hash;
			}
		}

		if (
			!entryHash ||
			!excludedEntryTypes.includes(summary.entryTypes.get(entryHash))
		) {
			depsNotHeld.set(baseAddress, true);

			const strBaseHash = encodeHashToBase64(baseAddress);
			for (const link of links) {
				let targetEntryHash;
				if (getHashType(link.target_address) === HashType.ENTRY) {
					targetEntryHash = link.target_address;
				} else if (getHashType(link.target_address) === HashType.ACTION) {
					const action: Action = summary.actions.get(link.target_address);
					if (action && (action as NewEntryAction).entry_hash) {
						targetEntryHash = (action as NewEntryAction).entry_hash;
					}
				}

				if (
					!targetEntryHash ||
					!excludedEntryTypes.includes(summary.entryTypes.get(targetEntryHash))
				) {
					const linkTag = simulatedDna ? link.tag : getLinkTagStr(link.tag);
					const tag = JSON.stringify(linkTag);
					const target = encodeHashToBase64(link.target_address);

					edges.push({
						data: {
							id: `${strBaseHash}->${target}`,
							source: strBaseHash,
							target,
							label: tag,
						},
						classes: ['explicit-link'],
					});
					depsNotHeld.set(link.target_address, true);
				}
			}
		}
	}

	// Add action nodes and updates edges

	for (const [entryHash, actionHashes] of summary.actionsByEntry.entries()) {
		if (!excludedEntryTypes.includes(summary.entryTypes.get(entryHash))) {
			const strEntryHash = encodeHashToBase64(entryHash);

			for (const actionHash of actionHashes) {
				const action = summary.actions.get(actionHash);
				const strActionHash = encodeHashToBase64(actionHash);

				nodes.push({
					data: {
						id: strActionHash,
						data: action,
						label: action.type,
					},
					classes: [action.type, 'action'],
				});
				nodesDrawn.set(actionHash, true);

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

				depsNotHeld.set(entryHash, true);

				for (const updateActionHash of summary.actionUpdates.get(actionHash) ||
					[]) {
					const strUpdateActionHash = encodeHashToBase64(updateActionHash);
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
						nodesDrawn.set(updateActionHash, true);
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
					depsNotHeld.set(actionHash, true);
				}

				for (const deleteActionHash of summary.actionDeletes.get(actionHash) ||
					[]) {
					const strDeleteActionHash = encodeHashToBase64(deleteActionHash);
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
						nodesDrawn.set(deleteActionHash, true);
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
					depsNotHeld.set(actionHash, true);
				}
			}
		}
	}

	for (const dep of depsNotHeld.keys()) {
		if (!nodesDrawn.has(dep)) {
			nodes.push({
				data: {
					id: encodeHashToBase64(dep),
					label: 'Unknown',
				},
				classes: ['not-held'],
			});
		}
	}

	const allEntryTypes = uniq(Array.from(summary.entryTypes.values()));

	return {
		nodes,
		edges,
		entryTypes: allEntryTypes,
	};
}

function hasHash(summary: DhtSummary, hash: HoloHash): HoloHash | undefined {
	if (getHashType(hash) === HashType.ACTION) {
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
		return decodeHashFromBase64(value);
	} else if (typeof value === 'object' && ArrayBuffer.isView(value)) {
		return value as HoloHash;
	}
	return undefined;
}

export function getEmbeddedReferences(
	summary: DhtSummary,
	value: any,
): Array<{ label: string | undefined; target: EntryHashB64 }> {
	if (!value) return [];

	const hash = convertToHash(value);

	if (hash) {
		const presentHash = hasHash(summary, hash);
		return presentHash
			? [
					{
						label: undefined,
						target: encodeHashToBase64(presentHash),
					},
				]
			: [];
	}
	if (Array.isArray(value) && value.length > 0 && convertToHash(value[0])) {
		return value
			.filter(v => !!convertToHash(v) && !!hasHash(summary, convertToHash(v)!))
			.map(v => ({
				target: encodeHashToBase64(hasHash(summary, convertToHash(v)!)!),
				label: undefined,
			}));
	}
	if (typeof value === 'object') {
		const values = Object.entries(value).map(([key, v]) => {
			const implicitLinks = getEmbeddedReferences(summary, v);
			for (const implicitLink of implicitLinks) {
				if (!implicitLink.label) {
					implicitLink.label = key;
				}
			}
			return implicitLinks;
		});
		return ([] as any[]).concat(...values);
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

	let nodes: any = [];
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
			getEntryContentsNode(content[property], propertyParentId),
		);
	}
	return nodes;
}
