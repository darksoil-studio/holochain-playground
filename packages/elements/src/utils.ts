import {
	AppInfo,
	CellId,
	CellInfo,
	CellType,
	DnaHash,
	DnaModifiers,
} from '@holochain/client';

export function cellCount(appInfo: AppInfo): number {
	return Object.values(appInfo.cell_info).reduce(
		(acc, next) => acc + next.length,
		0,
	);
}

export function dnaHash(cellInfo: CellInfo): DnaHash {
	if (cellInfo.type === CellType.Provisioned) {
		return cellInfo.value.cell_id[0];
	} else if (cellInfo.type === CellType.Cloned) {
		return cellInfo.value.cell_id[0];
	} else {
		return cellInfo.value.dna;
	}
}

export function cellName(cellInfo: CellInfo): string {
	if (cellInfo.type === CellType.Provisioned) {
		return cellInfo.value.name;
	} else if (cellInfo.type === CellType.Cloned) {
		return cellInfo.value.clone_id;
	} else {
		return cellInfo.value.name!;
	}
}

export function dnaModifiers(cellInfo: CellInfo): DnaModifiers {
	if (cellInfo.type === CellType.Provisioned) {
		return cellInfo.value.dna_modifiers;
	} else if (cellInfo.type === CellType.Cloned) {
		return cellInfo.value.dna_modifiers;
	} else {
		return cellInfo.value.dna_modifiers!;
	}
}
