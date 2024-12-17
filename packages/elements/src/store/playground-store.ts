import {
	getDhtOpAction,
	getDhtOpEntry,
	getDhtOpType,
	isWarrantOp,
} from '@holochain-playground/simulator';
import {
	ActionHashed,
	AgentPubKey,
	AnyDhtHash,
	AppInfo,
	CellId,
	ChainOp,
	DhtOp,
	DhtOpType,
	DnaHash,
	NewEntryAction,
	Record,
} from '@holochain/client';
import {
	AsyncComputed,
	AsyncResult,
	AsyncSignal,
	Signal,
	joinAsync,
	joinAsyncMap,
	uniquify,
	watch,
} from '@tnesh-stack/signals';
import { CellMap, HashType, hash, hashAction } from '@tnesh-stack/utils';
import isEqual from 'lodash-es/isEqual.js';

import { ConnectedConductorStore } from './connected-playground-store.js';
import { PlaygroundMode } from './mode.js';
import { SimulatedConductorStore } from './simulated-playground-store.js';
import { joinAsyncCellMap, mapCellValues } from './utils.js';

export interface CellStore {
	sourceChain: AsyncSignal<Record[]>;

	peers: AsyncSignal<AgentPubKey[]>;

	dhtShard: AsyncSignal<Array<DhtOp>>;

	cellId: CellId;

	get(dhtHash: AnyDhtHash): AsyncSignal<any | undefined>;
}

export function getFromStore(
	cellStore: CellStore,
	dhtHash: AnyDhtHash,
): AsyncSignal<any | undefined> {
	return new AsyncComputed(() => {
		const sourceChainResult = cellStore.sourceChain.get();
		const dhtShardResult = cellStore.dhtShard.get();
		if (sourceChainResult.status !== 'completed') return sourceChainResult;
		if (dhtShardResult.status !== 'completed') return dhtShardResult;

		const sourceChain = sourceChainResult.value;
		const dhtShard = dhtShardResult.value;

		for (const record of sourceChain) {
			const actionHashed: ActionHashed = record.signed_action.hashed;
			if (isEqual(actionHashed.hash, dhtHash)) {
				return {
					status: 'completed',
					value: actionHashed.content,
				};
			}
			if (
				(actionHashed.content as NewEntryAction).entry_hash &&
				isEqual((actionHashed.content as NewEntryAction).entry_hash, dhtHash)
			) {
				return {
					status: 'completed',
					value: (record.entry as any).Present,
				};
			}
		}

		for (const op of dhtShard) {
			if (isWarrantOp(op)) {
				continue;
			}

			const chainOp = (op as { ChainOp: ChainOp }).ChainOp;

			const action = getDhtOpAction(chainOp);
			const actionHash = hashAction(action);

			if (isEqual(actionHash, dhtHash)) {
				return {
					status: 'completed',
					value: action,
				};
			}

			if (
				(action as NewEntryAction).entry_hash &&
				isEqual((action as NewEntryAction).entry_hash, dhtHash)
			) {
				const type = getDhtOpType(chainOp);
				if (type === DhtOpType.StoreEntry || type === DhtOpType.StoreRecord) {
					return {
						status: 'completed',
						value: getDhtOpEntry(chainOp),
					};
				}
			}
		}
		return {
			status: 'completed',
			value: undefined,
		};
	});
}

export interface ConductorStore<T extends CellStore> {
	happs: AsyncSignal<Array<AppInfo>>;
	cells: AsyncSignal<CellMap<T>>;
}

type CellStoreForConductorStore<T> =
	T extends ConductorStore<infer CellStore> ? CellStore : never;

export abstract class PlaygroundStore<
	T extends SimulatedConductorStore | ConnectedConductorStore,
> {
	activeDna = new Signal.State<DnaHash | undefined>(undefined);

	activeAgentPubKey = new Signal.State<AgentPubKey | undefined>(undefined);

	activeDhtHash = new Signal.State<AnyDhtHash | undefined>(undefined);

	abstract conductors: Signal.State<Array<T>>;

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

	cell(cellId: CellId): AsyncSignal<CellStoreForConductorStore<T> | undefined> {
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

	// allHapps =

	allDnas = new AsyncComputed(() => {
		const allCells = this.allCells.get();
		if (allCells.status !== 'completed') return allCells;

		const value = uniquify(allCells.value.cellIds().map(cellId => cellId[0]));
		return {
			status: 'completed',
			value,
		};
	});

	allCells = new AsyncComputed<CellMap<CellStoreForConductorStore<T>>>(() => {
		const conductors = this.conductors.get();
		const cellMaps = joinAsync(
			conductors.map(
				c =>
					c.cells.get() as AsyncResult<CellMap<CellStoreForConductorStore<T>>>,
			),
		);
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

		const map = new CellMap<CellStoreForConductorStore<T>>();

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
