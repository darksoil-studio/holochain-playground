import { CellMap } from '@holochain-open-dev/utils';
import { CellId } from '@holochain/client';
import isEqual from 'lodash-es/isEqual';
import { Readable, derived } from '@holochain-open-dev/stores';

export function cellChanges(
  currentCellIds: CellId[],
  targetCellIds: CellId[]
): { cellsToAdd: CellId[]; cellsToRemove: CellId[] } {
  const cellsToAdd = targetCellIds.filter(
    (cellId) => !contains(currentCellIds, cellId)
  );
  const cellsToRemove = currentCellIds.filter(
    (cellId) => !contains(targetCellIds, cellId)
  );

  return {
    cellsToAdd,
    cellsToRemove,
  };
}

export function contains(cellIds: CellId[], lookingForCellId: CellId) {
  return cellIds.find((c) => isEqual(c, lookingForCellId));
}

export function mapDerive<T, R>(
  cellMap: CellMap<T>,
  mapFn: (value: T) => Readable<R>
): Readable<CellMap<R>> {
  return derived(
    cellMap
      .entries()
      .map(([cellId, v]: [CellId, T]) =>
        derived(mapFn(v), (r) => [cellId, r] as [CellId, R])
      ),
    (values) => new CellMap<R>(values)
  );
}
