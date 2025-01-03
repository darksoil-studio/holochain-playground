import {
	AppInfo,
	CellId,
	CellInfo,
	CellType,
	DnaHash,
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
		return cellInfo[CellType.Cloned].name;
	} else {
		return cellInfo[CellType.Stem].name!;
	}
}