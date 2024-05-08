import {
	AsyncComputed,
	AsyncSignal,
	Signal,
	joinAsync,
	joinAsyncMap,
	watch,
} from '@holochain-open-dev/signals';
import { CellMap, HashType, hash } from '@holochain-open-dev/utils';
import {
	ActionHashed,
	AgentPubKey,
	AnyDhtHash,
	CellId,
	DhtOp,
	DhtOpType,
	DnaHash,
	NewEntryAction,
	Record,
	getDhtOpAction,
	getDhtOpEntry,
	getDhtOpType,
} from '@holochain/client';
import isEqual from 'lodash-es/isEqual.js';

import { PlaygroundMode } from './mode.js';
import { joinAsyncCellMap, mapCellValues } from './utils.js';

export abstract class CellStore<T extends PlaygroundMode> {
	abstract sourceChain: AsyncSignal<Record[]>;

	abstract peers: AsyncSignal<AgentPubKey[]>;

	abstract dhtShard: AsyncSignal<Array<DhtOp>>;

	abstract cellId: CellId;

	constructor(public conductorStore: ConductorStore<T>) {}

	get(dhtHash: AnyDhtHash): AsyncSignal<any | undefined> {
		return new AsyncComputed(() => {
			const sourceChainResult = this.sourceChain.get();
			const dhtShardResult = this.dhtShard.get();
			if (sourceChainResult.status !== 'completed') return sourceChainResult;
			if (dhtShardResult.status !== 'completed') return dhtShardResult;

			const sourceChain = sourceChainResult.value;
			const dhtShard = dhtShardResult.value;

			for (const record of sourceChain) {
				const actionHashed: ActionHashed = record.signed_action.hashed;
				if (isEqual(actionHashed.hash, dhtHash)) {
					return actionHashed.content;
				}
				if (
					(actionHashed.content as NewEntryAction).entry_hash &&
					isEqual((actionHashed.content as NewEntryAction).entry_hash, dhtHash)
				) {
					return (record.entry as any).Present;
				}
			}

			for (const op of dhtShard) {
				const action = getDhtOpAction(op);
				const actionHash = hash(action, HashType.ACTION);

				if (isEqual(actionHash, dhtHash)) {
					return action;
				}

				if (
					(action as NewEntryAction).entry_hash &&
					isEqual((action as NewEntryAction).entry_hash, dhtHash)
				) {
					const type = getDhtOpType(op);
					if (type === DhtOpType.StoreEntry || type === DhtOpType.StoreRecord) {
						return getDhtOpEntry(op);
					}
				}
			}
			return undefined;
		});
	}
}

export abstract class ConductorStore<T extends PlaygroundMode> {
	abstract cells: AsyncSignal<CellMap<CellStore<T>>>;
}

export abstract class PlaygroundStore<T extends PlaygroundMode> {
	activeDna = new Signal.State<DnaHash | undefined>(undefined);

	activeAgentPubKey = new Signal.State<AgentPubKey | undefined>(undefined);

	activeDhtHash = new Signal.State<AnyDhtHash | undefined>(undefined);

	abstract conductors: Signal.State<Array<ConductorStore<T>>>;

	constructor() {
		let currentvalue: DnaHash | undefined;

		watch(this.activeDna, v => {
			if (!isEqual(v, currentvalue)) {
				currentvalue = v;

				this.activeDhtHash.set(undefined);
				const currentConductors = this.conductors.get();

				const activePubKey = this.activeAgentPubKey.get();
				if (
					!v ||
					(activePubKey &&
						!currentConductors.find(c => {
							const cells = c.cells.get();
							return (
								cells.status === 'completed' &&
								cells.value.has([v, activePubKey])
							);
						}))
				) {
					this.activeAgentPubKey.set(undefined);
				}
			}
		});
	}

	cell(cellId: CellId): AsyncSignal<CellStore<T> | undefined> {
		return new AsyncComputed(() => {
			const cells = this.allCells.get();
			if (cells.status !== 'completed') return cells;

			const value = cells.value.get(cellId);
			return {
				status: 'completed',
				value,
			};
		});
	}

	activeCell = new AsyncComputed(() => {
		const activeDna = this.activeDna.get();
		const activeAgentPubKey = this.activeAgentPubKey.get();
		const allCells = this.allCells.get();
		if (allCells.status !== 'completed') return allCells;

		if (!activeDna || !activeAgentPubKey)
			return {
				status: 'completed',
				value: undefined,
			};

		const value = allCells.value.get([activeDna, activeAgentPubKey]);
		return {
			status: 'completed',
			value,
		};
	});

	allDnas = new AsyncComputed(() => {
		const allCells = this.allCells.get();
		if (allCells.status !== 'completed') return allCells;

		const value = allCells.value.cellIds().map(cellId => cellId[0]);
		return {
			status: 'completed',
			value,
		};
	});

	allCells = new AsyncComputed(() => {
		const conductors = this.conductors.get();
		const cellMaps = joinAsync(conductors.map(c => c.cells.get()));
		if (cellMaps.status !== 'completed') return cellMaps;

		const value = cellMaps.value.reduce((acc, next) => {
			for (const [cellId, store] of next.entries()) {
				acc.set(cellId, store);
			}
			return acc;
		}, new CellMap());
		return {
			status: 'completed',
			value,
		};
	});

	activeContent = new AsyncComputed(() => {
		const activeDhtHash = this.activeDhtHash.get();

		if (!activeDhtHash)
			return {
				status: 'completed',
				value: undefined,
			};

		const cellsForActiveDna = this.cellsForActiveDna.get();
		if (cellsForActiveDna.status !== 'completed') return cellsForActiveDna;

		for (const [_cellId, cell] of cellsForActiveDna.value.entries()) {
			const result = cell.get(activeDhtHash).get();
			if (result.status === 'completed') {
				if (result.value) {
					return {
						status: 'completed',
						value: result.value,
					};
				}
			} else {
				return result;
			}
		}
		return {
			status: 'completed',
			value: undefined,
		};
	});

	cellsForActiveDna = new AsyncComputed(() => {
		const activeDna = this.activeDna.get();
		const allCells = this.allCells.get();
		if (allCells.status !== 'completed') return allCells;

		const map = new CellMap<CellStore<T>>();

		for (const [cellId, value] of allCells.value.entries()) {
			if (isEqual(activeDna?.toString(), cellId[0].toString())) {
				map.set(cellId, value);
			}
		}
		return {
			status: 'completed',
			value: map,
		};
	});

	dhtForActiveDna = new AsyncComputed(() => {
		const cellsForActiveDna = this.cellsForActiveDna.get();
		if (cellsForActiveDna.status !== 'completed') return cellsForActiveDna;

		return joinAsyncCellMap(
			mapCellValues(cellsForActiveDna.value, c => c.dhtShard.get()),
		);
	});
}
