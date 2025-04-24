import { CellId } from '@holochain/client';
import { AsyncResult, JoinAsyncOptions, joinAsync } from '@darksoil-studio/holochain-signals';
import { CellMap } from '@darksoil-studio/holochain-utils';

export function cellChanges(
	currentCellIds: CellId[],
	targetCellIds: CellId[],
): { cellsToAdd: CellId[]; cellsToRemove: CellId[] } {
	const cellsToAdd = targetCellIds.filter(
		cellId => !contains(currentCellIds, cellId),
	);
	const cellsToRemove = currentCellIds.filter(
		cellId => !contains(targetCellIds, cellId),
	);

	return {
		cellsToAdd,
		cellsToRemove,
	};
}

export function contains(cellIds: CellId[], lookingForCellId: CellId) {
	return cellIds.find(c => isEqual(c, lookingForCellId));
}

function isEqual(cellId1: CellId, cellId2: CellId): boolean {
	return cellId1.toString() === cellId2.toString();
}

/**
 * Create a new map maintaining the keys while mapping the values with the given mapping function
 */
export function mapCellValues<V, U>(
	map: CellMap<V>,
	mappingFn: (value: V, key: CellId) => U,
): CellMap<U> {
	const mappedMap = new CellMap<U>();

	for (const [key, value] of map.entries()) {
		mappedMap.set(key, mappingFn(value, key));
	}
	return mappedMap;
}

export function joinAsyncCellMap<T>(
	map: CellMap<AsyncResult<T>>,
	joinOptions?: JoinAsyncOptions,
): AsyncResult<CellMap<T>> {
	const resultsArray = Array.from(map.entries()).map(([key, result]) => {
		if (result.status !== 'completed') return result;
		const value = [key, result.value] as [CellId, T];
		return {
			status: 'completed',
			value,
		} as AsyncResult<[CellId, T]>;
	});
	const arrayResult = joinAsync(resultsArray, joinOptions);

	if (arrayResult.status !== 'completed') return arrayResult;

	const value = new CellMap<T>(arrayResult.value);
	return {
		status: 'completed',
		value,
	} as AsyncResult<CellMap<T>>;
}
