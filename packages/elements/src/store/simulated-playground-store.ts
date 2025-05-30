import { ValidationStatus } from '@darksoil-studio/holochain-core-types';
import {
	AsyncComputed,
	AsyncSignal,
	AsyncState,
	Signal,
} from '@darksoil-studio/holochain-signals';
import { CellMap } from '@darksoil-studio/holochain-utils';
import {
	AppRole,
	BadAgent,
	Cell,
	Conductor,
	ConductorSignalType,
	Dictionary,
	InstalledHapp,
	IntegrationLimboValue,
	SimulatedHappBundle,
	ValidationLimboStatus,
	createConductors,
	createConductorsWithoutHapp,
	selectSourceChain,
	simulatedRolesToCellInfo,
} from '@holochain-playground/simulator';
import {
	AgentPubKey,
	AnyDhtHash,
	AppInfo,
	CellId,
	CellInfo,
	CellType,
	DhtOp,
	DnaModifiers,
	Record,
} from '@holochain/client';
import { encode } from '@msgpack/msgpack';

import { ConnectedCellStore } from './connected-playground-store.js';
import {
	CellStore,
	ConductorStore,
	PlaygroundStore,
	getFromStore,
} from './playground-store.js';
import { pollingSignal } from './polling-store.js';
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

	dhtShard: AsyncSignal<Array<DhtOp>> = new AsyncComputed(() => {
		const queue = this.validationQueue.get();
		if (queue.status !== 'completed') return queue;
		const value = queue.value.integrated
			.filter(
				op => true, // TODO: change when the conductor returns the validation status in dump full state
			)
			.map(op => op.op);
		return {
			status: 'completed',
			value,
		};
	});
	private _validationQueue = new Signal.State<{
		integrationLimbo: Array<{
			op: DhtOp;
			status: ValidationStatus | undefined;
		}>;
		validationLimbo: Array<{
			op: DhtOp;
			status: ValidationLimboStatus | undefined;
		}>;
		integrated: Array<{
			op: DhtOp;
			status: ValidationStatus | undefined;
		}>;
	}>({
		integrationLimbo: [],
		validationLimbo: [],
		integrated: [],
	});
	validationQueue = new AsyncComputed(() => ({
		status: 'completed',
		value: this._validationQueue.get(),
	}));

	badAgents = new Signal.State<AgentPubKey[]>([]);

	farPeers = new Signal.State<AgentPubKey[]>([]);

	constructor(
		public conductorStore: SimulatedConductorStore,
		public cell: Cell,
	) {
		cell.workflowExecutor.success(async () => this.update());
		cell.p2p.networkRequestsExecutor.success(async () => this.update());
	}

	get dna() {
		return this.cell.getSimulatedDna();
	}

	get cellId(): CellId {
		return this.cell.cellId;
	}

	update() {
		const state = this.cell._state;
		if (!this.cell.p2p) return;
		const p2pstate = this.cell.p2p.getState();

		this._sourceChain.set(selectSourceChain(state));
		this._peers.set(p2pstate.neighbors);
		this._validationQueue.set({
			integrationLimbo: Array.from(state.integrationLimbo.values()).map(v => ({
				op: v.op,
				status: v.validation_status,
			})),
			validationLimbo: Array.from(state.validationLimbo.values()).map(v => ({
				op: v.op,
				status: v.status,
			})),
			integrated: Array.from(state.integratedDHTOps.values()).map(v => ({
				op: v.op,
				status: v.validation_status,
			})),
		});
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
	happs: AsyncSignal<AppInfo[]>;
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

		this.happs = pollingSignal(async apps => {
			return Object.values(this.conductor.installedHapps).map(
				h =>
					({
						agent_pub_key: h.agent_pub_key,
						installed_app_id: h.app_id,
						status: {
							type: 'running',
						},
						cell_info: simulatedRolesToCellInfo(
							h.roles,
							this.conductor.registeredDnas,
						),
						installed_at: h.installed_at,
					}) as AppInfo,
			);
		});
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
		if (this.get()) return;
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

	simulatedHapps: Signal.State<Dictionary<SimulatedHappBundle>>;

	paused = new PauseSignal();

	constructor(
		initialConductors: Conductor[],
		protected initialHapp: SimulatedHappBundle,
	) {
		super();
		this.conductors = new Signal.State(
			initialConductors.map(c => new SimulatedConductorStore(c)),
		);
		this.simulatedHapps = new Signal.State({ [initialHapp.name]: initialHapp });
		if (initialConductors.length > 0) {
			this.activeDna.set(initialConductors[0].cells.cellIds()[0][0]);
		}
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

	async createConductors(conductorsToCreate: number) {
		const conductors = this.conductors.get();
		const newConductors = await createConductorsWithoutHapp(
			conductorsToCreate,
			conductors.map(c => c.conductor),
		);
		const newConductorsStores = newConductors.map(
			c => new SimulatedConductorStore(c),
		);
		this.conductors.set([...conductors, ...newConductorsStores]);
		return newConductorsStores;
	}
}
