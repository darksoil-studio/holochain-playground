import {
	Cell,
	Conductor,
	isHoldingEntry,
	isHoldingRecord,
} from '@holochain-playground/simulator';
import {
	ActionHash,
	AgentPubKey,
	AnyDhtHash,
	DnaHash,
	NewEntryAction,
	SignedActionHashed,
} from '@holochain/client';
import { HashType, HoloHashMap, getHashType } from '@tnesh-stack/utils';
import { cloneDeep } from 'lodash-es';

export function selectCells(dna: DnaHash, conductor: Conductor): Cell[] {
	return conductor.getCells(dna);
}

export function selectGlobalDHTOpsCount(cells: Cell[]): number {
	let dhtOps = 0;

	for (const cell of cells) {
		dhtOps += Object.keys(cell._state.integratedDHTOps).length;
	}

	return dhtOps;
}

export function selectHoldingCells(hash: AnyDhtHash, cells: Cell[]): Cell[] {
	if (getHashType(hash) === HashType.ENTRY)
		return cells.filter(cell => isHoldingEntry(cell._state, hash));
	return cells.filter(cell => isHoldingRecord(cell._state, hash));
}

export function selectConductorByAgent(
	agentPubKey: AgentPubKey,
	conductors: Conductor[],
): Conductor | undefined {
	return conductors.find(conductor =>
		conductor
			.getAllCells()
			.find(cell => cell.agentPubKey.toString() === agentPubKey.toString()),
	);
}

export function selectCell(
	dnaHash: DnaHash,
	agentPubKey: AgentPubKey,
	conductors: Conductor[],
): Cell | undefined {
	for (const conductor of conductors) {
		for (const cell of conductor.getAllCells()) {
			if (
				cell.agentPubKey.toString() === agentPubKey.toString() &&
				cell.dnaHash.toString() === dnaHash.toString()
			) {
				return cell;
			}
		}
	}

	return undefined;
}

export function selectFromCAS(hash: AnyDhtHash, cells: Cell[]): any {
	if (!hash) return undefined;

	for (const cell of cells) {
		const entry = cell._state.CAS.get(hash);
		if (entry) {
			return cloneDeep(entry);
		}
	}
	return undefined;
}

export function selectActionEntry(actionHash: ActionHash, cells: Cell[]): any {
	const action: SignedActionHashed<NewEntryAction> = selectFromCAS(
		actionHash,
		cells,
	);
	return selectFromCAS(action.hashed.content.entry_hash, cells);
}

export function selectMedianHoldingDHTOps(cells: Cell[]): number {
	const holdingDHTOps = [];

	for (const cell of cells) {
		holdingDHTOps.push(Object.keys(cell._state.integratedDHTOps).length);
	}

	holdingDHTOps.sort();

	const medianIndex = Math.floor(holdingDHTOps.length / 2);

	return holdingDHTOps.sort((a, b) => a - b)[medianIndex];
}

export function selectAllDNAs(conductors: Conductor[]): DnaHash[] {
	const dnas = new HoloHashMap<DnaHash, boolean>();

	for (const conductor of conductors) {
		for (const cell of conductor.getAllCells()) {
			dnas.set(cell.dnaHash, true);
		}
	}
	return Array.from(dnas.keys());
}

export function selectRedundancyFactor(cell: Cell): number {
	return cell.p2p.redundancyFactor;
}
