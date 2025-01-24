import {
	AgentPubKey,
	CapSecret,
	CellId,
	DnaHash,
	encodeHashToBase64,
} from '@holochain/client';
import { CellMap, HashType, HoloHashMap, hash } from '@tnesh-stack/utils';
import isEqual from 'lodash-es/isEqual.js';

import { BootstrapService } from '../bootstrap/bootstrap-service.js';
import { Cell, getCellId } from '../core/cell/index.js';
import {
	InstalledHapp,
	SimulatedDna,
	SimulatedHappBundle,
	hashDna,
} from '../dnas/simulated-dna.js';
import { Dictionary } from '../types.js';
import { BadAgent, BadAgentConfig } from './bad-agent.js';
import { CellState } from './cell/state.js';
import { Network, NetworkState } from './network/network.js';

export interface ConductorState {
	// DnaHash / AgentPubKey
	cellsState: CellMap<CellState>;
	networkState: NetworkState;
	registeredDnas: HoloHashMap<DnaHash, SimulatedDna>;
	installedHapps: Dictionary<InstalledHapp>;
	name: string;
	badAgent: BadAgent | undefined;
}

export enum ConductorSignalType {
	CellsChanged,
}

export type SignalCb = (type: ConductorSignalType) => void;

export class Conductor {
	readonly cells: CellMap<Cell>;
	registeredDnas!: HoloHashMap<DnaHash, SimulatedDna>;
	installedHapps!: Dictionary<InstalledHapp>;

	signalCbs: Array<SignalCb> = [];

	network: Network;
	name: string;

	badAgent: BadAgent | undefined; // If undefined, this is an honest agent

	constructor(state: ConductorState, bootstrapService: BootstrapService) {
		this.network = new Network(state.networkState, this, bootstrapService);
		this.registeredDnas = state.registeredDnas;
		this.installedHapps = state.installedHapps;
		this.name = state.name;

		this.cells = new CellMap();

		for (const [cellId, cellState] of state.cellsState.entries()) {
			this.cells.set(cellId, new Cell(cellState, this));
		}
	}

	static async create(
		bootstrapService: BootstrapService,
		name: string,
	): Promise<Conductor> {
		const state: ConductorState = {
			cellsState: new CellMap(),
			networkState: {
				p2pCellsState: new CellMap(),
			},
			registeredDnas: new HoloHashMap(),
			installedHapps: {},
			name,
			badAgent: undefined,
		};

		return new Conductor(state, bootstrapService);
	}

	addSignalHandler(signalCb: SignalCb) {
		this.signalCbs.push(signalCb);
		return {
			unsubscribe: () => {
				const index = this.signalCbs.findIndex(s => s === signalCb);
				this.signalCbs.splice(index, 1);
			},
		};
	}

	emit(signal: ConductorSignalType) {
		this.signalCbs.forEach(cb => cb(signal));
	}

	getState(): ConductorState {
		const cellsState: CellMap<CellState> = new CellMap();

		for (const [cellId, cell] of this.cells.entries()) {
			cellsState.set(cellId, cell.getState());
		}

		return {
			name: this.name,
			networkState: this.network.getState(),
			cellsState,
			registeredDnas: this.registeredDnas,
			installedHapps: this.installedHapps,
			badAgent: this.badAgent,
		};
	}

	getAllCells(): Cell[] {
		return this.cells.values();
	}

	getCells(dnaHash: DnaHash): Cell[] {
		return this.cells.valuesForDna(dnaHash);
	}

	getCell(cellId: CellId): Cell | undefined {
		return this.cells.get(cellId);
	}

	/** Bad agents */

	setBadAgent(badAgentConfig: BadAgentConfig) {
		if (!this.badAgent)
			this.badAgent = {
				config: badAgentConfig,
				counterfeitDnas: new CellMap(),
			};
		this.badAgent.config = badAgentConfig;
	}

	setCounterfeitDna(cellId: CellId, dna: SimulatedDna) {
		if (!this.badAgent) throw new Error('This is not a bad agent');

		this.badAgent.counterfeitDnas.set(cellId, dna);
	}

	/** Admin API */
	/*
  async registerDna(dna_template: SimulatedDna): Promise<Hash> {
    const templateHash = hash(dna_template, HashType.DNA);

    this.registeredDnas[templateHash] = dna_template;
    return templateHash;
  } */

	async createCloneCell(
		installedAppId: string,
		cellRole: string,
		networkSeed?: string,
		properties?: Dictionary<any>,
		membraneProof?: any,
	): Promise<Cell> {
		if (!this.installedHapps[installedAppId])
			throw new Error(`Given app id doesn't exist`);

		const installedApp = this.installedHapps[installedAppId];
		if (!installedApp.roles[cellRole])
			throw new Error(`The cell role doesn't exist for the given app id`);

		const slotToClone = installedApp.roles[cellRole];

		const hashOfDnaToClone = slotToClone.base_cell_id[0];
		const dnaToClone = this.registeredDnas.get(hashOfDnaToClone);

		if (!dnaToClone) {
			throw new Error(
				`The dna to be cloned is not registered on this conductor`,
			);
		}

		const dna: SimulatedDna = { ...dnaToClone };

		if (networkSeed) dna.networkSeed = networkSeed;
		if (properties) dna.properties = properties;

		const newDnaHash = hashDna(dna);

		if (isEqual(newDnaHash, hashOfDnaToClone))
			throw new Error(
				`Trying to clone a dna would create exactly the same DNA`,
			);
		this.registeredDnas.set(newDnaHash, dna);

		const cell = await this.createCell(
			dna,
			installedApp.agent_pub_key,
			membraneProof,
		);

		const cloneId = Object.keys(
			this.installedHapps[installedAppId].roles[cellRole].clones,
		)
			.map(cloneName => parseInt(cloneName.split('.')[1]))
			.sort((a, b) => b - a)[0];

		const cloneName = `${cellRole}.${cloneId !== undefined ? cloneId : 0}`;

		this.installedHapps[installedAppId].roles[cellRole].clones[cloneName] =
			cell.cellId;
		return cell;
	}

	async installHapp(
		happ: SimulatedHappBundle,
		membrane_proofs: Dictionary<any>, // segmented by CellRole
	): Promise<void> {
		const rand = `${Math.random().toString()}/${Date.now()}`;
		const agentId = hash(rand, HashType.AGENT);

		this.installedHapps[happ.name] = {
			agent_pub_key: agentId,
			app_id: happ.name,
			roles: {},
		};

		for (const [cellRole, dna] of Object.entries(happ.roles)) {
			let dnaHash: DnaHash | undefined = undefined;
			if (ArrayBuffer.isView(dna.dna)) {
				dnaHash = dna.dna;
				if (!this.registeredDnas.get(dnaHash))
					throw new Error(
						`Trying to reference a Dna that this conductor doesn't have registered`,
					);
			} else if (typeof dna.dna === 'object') {
				dnaHash = hashDna(dna.dna);
				this.registeredDnas.set(dnaHash, dna.dna);
			} else {
				throw new Error(
					'Bad DNA Slot: you must pass in the hash of the dna or the simulated Dna object',
				);
			}

			this.installedHapps[happ.name].roles[cellRole] = {
				base_cell_id: [dnaHash, agentId],
				is_provisioned: !dna.deferred,
				clones: {},
			};

			if (!dna.deferred) {
				const cell = await this.createCell(
					this.registeredDnas.get(dnaHash),
					agentId,
					membrane_proofs[cellRole],
				);
			}
		}
	}

	public async uninstallHapp(appId: string) {
		const happ = this.installedHapps[appId];
		for (const [roleName, appRole] of Object.entries(happ.roles)) {
			if (appRole.is_provisioned) {
				const cell = this.cells.get(appRole.base_cell_id);
				if (cell) {
					await cell.shutdown();
					this.cells.delete(appRole.base_cell_id);
				}
			}

			for (const [cloneName, cloneCell] of Object.entries(appRole.clones)) {
				const cell = this.cells.get(cloneCell);
				if (cell) {
					await cell.shutdown();
					this.cells.delete(cloneCell);
				}
			}
		}
		delete this.installedHapps[appId];
		this.emit(ConductorSignalType.CellsChanged);
	}

	private async createCell(
		dna: SimulatedDna,
		agentPubKey: AgentPubKey,
		membraneProof?: any,
	): Promise<Cell> {
		const newDnaHash = hashDna(dna);

		const cellId: CellId = [newDnaHash, agentPubKey];
		const cell = await Cell.create(this, cellId, membraneProof);

		this.cells.set(cellId, cell);

		this.emit(ConductorSignalType.CellsChanged);

		return cell;
	}

	/** App API */

	async callZomeFn(args: {
		cellId: CellId;
		zome: string;
		fnName: string;
		payload: any;
		cap: CapSecret | undefined;
	}): Promise<any> {
		const dnaHash = args.cellId[0];
		const agentPubKey = args.cellId[1];
		const cell = this.cells.get(args.cellId);

		if (!cell)
			throw new Error(
				`No cells exists with cellId ${encodeHashToBase64(dnaHash)}:${encodeHashToBase64(agentPubKey)}`,
			);

		return cell.callZomeFn({
			zome: args.zome,
			cap: args.cap,
			fnName: args.fnName,
			payload: args.payload,
			provenance: agentPubKey,
		});
	}
}
