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
	if (CellType.Provisioned in cellInfo) {
		return cellInfo[CellType.Provisioned].cell_id[0];
	} else if (CellType.Cloned in cellInfo) {
		return cellInfo[CellType.Cloned].cell_id[0];
	} else {
		return cellInfo[CellType.Stem].dna;
	}
}

export function cellName(cellInfo: CellInfo): string {
	if (CellType.Provisioned in cellInfo) {
		return cellInfo[CellType.Provisioned].name;
	} else if (CellType.Cloned in cellInfo) {
		return cellInfo[CellType.Cloned].clone_id;
	} else {
		return cellInfo[CellType.Stem].name!;
	}
}

export function dnaModifiers(cellInfo: CellInfo): DnaModifiers {
	if (CellType.Provisioned in cellInfo) {
		return cellInfo[CellType.Provisioned].dna_modifiers;
	} else if (CellType.Cloned in cellInfo) {
		return cellInfo[CellType.Cloned].dna_modifiers;
	} else {
		return cellInfo[CellType.Stem].dna_modifiers!;
	}
}
