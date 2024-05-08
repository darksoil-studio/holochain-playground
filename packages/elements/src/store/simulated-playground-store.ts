import {
	AsyncComputed,
	AsyncSignal,
	AsyncState,
	Signal,
} from '@holochain-open-dev/signals';
import { CellMap } from '@holochain-open-dev/utils';
import {
	BadAgent,
	Cell,
	Conductor,
	ConductorSignalType,
	Dictionary,
	SimulatedHappBundle,
	createConductors,
	selectDhtShard,
	selectSourceChain,
} from '@holochain-playground/simulator';
import {
	AgentPubKey,
	AnyDhtHash,
	CellId,
	DhtOp,
	Record,
} from '@holochain/client';

import { ConnectedCellStore } from './connected-playground-store.js';
import {
	CellStore,
	ConductorStore,
	PlaygroundStore,
	getFromStore,
} from './playground-store.js';
import { cellChanges } from './utils.js';

export class SimulatedCellStore implements CellStore {
	private _sourceChain = new Signal.State<Record[]>([]);
	sourceChain: AsyncSignal<Record[]> = new AsyncComputed(() => ({
		status: 'completed',
		value: this._sourceChain.get(),
	}));

	private _peers = new Signal.State<AgentPubKey[]>([]);
	peers: AsyncSignal<AgentPubKey[]> = new AsyncComputed(() => ({
		status: 'completed',
		value: this._peers.get(),
	}));

	private _dhtShard = new Signal.State<DhtOp[]>([]);
	dhtShard: AsyncSignal<DhtOp[]> = new AsyncComputed(() => ({
		status: 'completed',
		value: this._dhtShard.get(),
	}));

	badAgents = new Signal.State<AgentPubKey[]>([]);

	farPeers = new Signal.State<AgentPubKey[]>([]);

	constructor(
		public conductorStore: SimulatedConductorStore,
		public cell: Cell,
	) {
		cell.workflowExecutor.success(async () => this.update());
	}

	get dna() {
		return this.cell.getSimulatedDna();
	}

	get cellId(): CellId {
		return this.cell.cellId;
	}

	update() {
		const state = this.cell._state;
		const p2pstate = this.cell.p2p.getState();

		this._sourceChain.set(selectSourceChain(state));
		this._peers.set(p2pstate.neighbors);
		this._dhtShard.set(selectDhtShard(state));
		this.badAgents.set(p2pstate.badAgents);
		this.farPeers.set(p2pstate.farKnownPeers);
	}

	get(hash: AnyDhtHash): AsyncSignal<any | undefined> {
		return getFromStore(this, hash);
	}
}

export class SimulatedConductorStore
	implements ConductorStore<SimulatedCellStore>
{
	cells: AsyncState<CellMap<SimulatedCellStore>>;

	badAgent: Signal.Computed<BadAgent | undefined>;

	constructor(public conductor: Conductor) {
		let cellMap = this.buildStores(conductor, new CellMap());

		let unsubscribe: (() => void) | undefined;

		this.cells = new AsyncState(
			{
				status: 'completed',
				value: cellMap,
			},
			{
				[Signal.subtle.watched]: () => {
					const un = conductor.addSignalHandler(signal => {
						if (signal === ConductorSignalType.CellsChanged) {
							cellMap = this.buildStores(conductor, cellMap);
							this.cells.set({
								status: 'completed',
								value: cellMap,
							});
						}
					});
					unsubscribe = un.unsubscribe;
				},
				[Signal.subtle.unwatched]: () => {
					if (unsubscribe) unsubscribe();
				},
			},
		);
		this.badAgent = new Signal.Computed(() => this.conductor.badAgent);
	}

	get name() {
		return this.conductor.name;
	}

	buildStores(conductor: Conductor, currentCells: CellMap<SimulatedCellStore>) {
		const { cellsToAdd, cellsToRemove } = cellChanges(
			currentCells.cellIds(),
			conductor.cells.cellIds(),
		);

		for (const cellId of cellsToAdd) {
			currentCells.set(
				cellId,
				new SimulatedCellStore(this, conductor.getCell(cellId)!),
			);
		}
		for (const cellId of cellsToRemove) {
			currentCells.delete(cellId);
		}
		return currentCells;
	}
}

export class PauseSignal extends Signal.State<boolean> {
	private _awaitResume = Promise.resolve();
	private awaitResolve: any;
	constructor() {
		super(false);
	}

	pause() {
		this._awaitResume = new Promise(r => {
			this.awaitResolve = r;
		});
		this.set(true);
	}

	resume() {
		this.set(false);

		if (this.awaitResolve) this.awaitResolve();
	}

	awaitResume() {
		return this._awaitResume;
	}
}

export class SimulatedPlaygroundStore extends PlaygroundStore<SimulatedConductorStore> {
	conductors: Signal.State<Array<SimulatedConductorStore>>;

	happs: Signal.State<Dictionary<SimulatedHappBundle>>;

	paused = new PauseSignal();

	constructor(
		initialConductors: Conductor[],
		initialHapp: SimulatedHappBundle,
	) {
		super();
		this.conductors = new Signal.State(
			initialConductors.map(c => new SimulatedConductorStore(c)),
		);
		this.happs = new Signal.State({ [initialHapp.name]: initialHapp });
		this.activeDna.set(initialConductors[0].cells.cellIds()[0][0]);
	}

	static async create(
		numberOfConductors: number,
		simulatedHapp: SimulatedHappBundle,
	) {
		const initialConductors = await createConductors(
			numberOfConductors,
			[],
			simulatedHapp,
		);

		return new SimulatedPlaygroundStore(initialConductors, simulatedHapp);
	}
}
