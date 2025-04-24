import {
	AgentPubKey,
	AnyDhtHash,
	CapSecret,
	CellId,
	DhtOp,
	DnaHash,
	EntryHash,
	LinkType,
	Record,
} from '@holochain/client';
import { DhtOpHash } from '@darksoil-studio/holochain-core-types';
import { HashType, getHashType, hash } from '@darksoil-studio/holochain-utils';
import { HoloHashMap } from '@darksoil-studio/holochain-utils';
import { cloneDeep, isEqual, uniqWith } from 'lodash-es';

import { sleep } from '../../executor/delay-middleware.js';
import { MiddlewareExecutor } from '../../executor/middleware-executor.js';
import {
	ChainQueryFilter,
	Dictionary,
	GetLinksOptions,
	GetOptions,
} from '../../types.js';
import { Conductor } from '../conductor.js';
import {
	ActivityRequest,
	AgentActivity,
} from '../hdk/host-fn/get_agent_activity.js';
import { ChainFilter } from '../hdk/host-fn/must_get_agent_activity.js';
import { DhtArc } from '../network/dht_arc.js';
import { GossipData } from '../network/gossip/types.js';
import { P2pCell } from '../network/p2p-cell.js';
import { getBadAgents } from '../network/utils.js';
import { Authority } from './cascade/authority.js';
import { GetLinksResponse, GetResult } from './cascade/types.js';
import {
	MustGetAgentActivityResponse,
	hasDhtOpBeenProcessed,
} from './dht/get.js';
import { putValidationReceipt } from './dht/put.js';
import { CellState, query_dht_ops } from './state.js';
import { getDhtOpBasis } from './utils.js';
import {
	app_validation_task,
	run_agent_validation_callback,
} from './workflows/app_validation.js';
import { call_zome_fn_workflow } from './workflows/call_zome_fn.js';
import { genesis_task } from './workflows/genesis.js';
import { incoming_dht_ops_task } from './workflows/incoming_dht_ops.js';
import { publish_dht_ops_task } from './workflows/publish_dht_ops.js';
import { triggeredWorkflowFromType } from './workflows/trigger.js';
import { Workflow, WorkflowType, Workspace } from './workflows/workflows.js';

export type CellSignal = 'after-workflow-executed' | 'before-workflow-executed';
export type CellSignalListener = (payload: any) => void;

export class Cell {
	_triggers: Dictionary<{ running: boolean; triggered: boolean }> = {
		[WorkflowType.INTEGRATE_DHT_OPS]: { running: false, triggered: true },
		[WorkflowType.PRODUCE_DHT_OPS]: { running: false, triggered: true },
		[WorkflowType.PUBLISH_DHT_OPS]: { running: false, triggered: true },
		[WorkflowType.SYS_VALIDATION]: { running: false, triggered: true },
		[WorkflowType.APP_VALIDATION]: { running: false, triggered: true },
		[WorkflowType.VALIDATION_RECEIPT]: { running: false, triggered: true },
	};

	workflowExecutor = new MiddlewareExecutor<Workflow<any, any>>();

	constructor(
		public _state: CellState,
		public conductor: Conductor,
	) {
		// Let genesis be run before actually joining

		setTimeout(() => {
			setInterval(() => this._runWorkflow(publish_dht_ops_task()), 60000);
		}, 60000);
	}

	get cellId(): CellId {
		return [this._state.dnaHash, this._state.agentPubKey];
	}

	get agentPubKey(): AgentPubKey {
		return this.cellId[1];
	}

	get dnaHash(): DnaHash {
		return this.cellId[0];
	}

	get p2p(): P2pCell {
		return this.conductor.network.p2pCells.get(this.cellId) as P2pCell;
	}

	getState(): CellState {
		return cloneDeep(this._state);
	}

	getSimulatedDna() {
		return this.conductor.registeredDnas.get(this.dnaHash);
	}

	static async create(
		conductor: Conductor,
		cellId: CellId,
		membrane_proof: any,
	): Promise<Cell> {
		const newCellState: CellState = {
			dnaHash: cellId[0],
			agentPubKey: cellId[1],
			CAS: new HoloHashMap(),
			integrationLimbo: new HoloHashMap(),
			metadata: {
				link_meta: [],
				misc_meta: new HoloHashMap(),
				system_meta: new HoloHashMap(),
				activity: new HoloHashMap(),
			},
			validationLimbo: new HoloHashMap(),
			integratedDHTOps: new HoloHashMap(),
			authoredDHTOps: new HoloHashMap(),
			validationReceipts: new HoloHashMap(),
			sourceChain: [],
			badAgents: [],
		};

		const cell = new Cell(newCellState, conductor);

		conductor.network.createP2pCell(cell);

		await cell._runWorkflow(genesis_task(cellId, membrane_proof));

		return cell;
	}

	async shutdown() {
		await this.p2p.leave();
		this.conductor.network.removeP2pCell(this.cellId);
	}

	/** Workflows */

	callZomeFn(args: {
		zome: string;
		fnName: string;
		payload: any;
		cap: CapSecret | undefined;
		provenance: AgentPubKey;
	}): Promise<any> {
		return this._runWorkflow(
			call_zome_fn_workflow(
				args.zome,
				args.fnName,
				args.payload,
				args.provenance,
			),
		);
	}

	/** Network handlers */
	// https://github.com/holochain/holochain/blob/develop/crates/holochain/src/conductor/cell.rs#L429

	public handle_publish(
		from_agent: AgentPubKey,
		request_validation_receipt: boolean,
		ops: HoloHashMap<DhtOpHash, DhtOp>,
	): Promise<void> {
		return this._runWorkflow(
			incoming_dht_ops_task(from_agent, request_validation_receipt, ops),
		);
	}

	public async handle_get(
		dht_hash: AnyDhtHash,
		options: GetOptions,
	): Promise<GetResult | undefined> {
		const authority = new Authority(this._state, this.p2p);

		const hashType = getHashType(dht_hash);
		if (hashType === HashType.ENTRY || hashType === HashType.AGENT) {
			return authority.handle_get_entry(dht_hash, options);
		} else if (hashType === HashType.ACTION) {
			return authority.handle_get_record(dht_hash, options);
		}
		return undefined;
	}

	public async handle_get_links(
		base_address: EntryHash,
		link_type: LinkType,
		options: GetLinksOptions,
	): Promise<GetLinksResponse> {
		const authority = new Authority(this._state, this.p2p);
		return authority.handle_get_links(base_address, link_type, options);
	}

	public async handle_get_agent_activity(
		agent: AgentPubKey,
		query: ChainQueryFilter,
		request: ActivityRequest,
	): Promise<AgentActivity> {
		const authority = new Authority(this._state, this.p2p);
		return authority.handle_get_agent_activity(agent, query, request);
	}

	public async handle_must_get_agent_activity(
		agent: AgentPubKey,
		filter: ChainFilter,
	): Promise<MustGetAgentActivityResponse> {
		const authority = new Authority(this._state, this.p2p);
		return authority.handle_must_get_agent_activity(agent, filter);
	}

	public async handle_call_remote(
		from_agent: AgentPubKey,
		zome_name: string,
		fn_name: string,
		cap: CapSecret | undefined,
		payload: any,
	): Promise<any> {
		return this.callZomeFn({
			zome: zome_name,
			cap: cap as CapSecret,
			fnName: fn_name,
			payload,
			provenance: from_agent,
		});
	}

	/** Gossips */

	public handle_fetch_op_hashes_for_constraints(
		dht_arc: DhtArc,
		since: number | undefined,
		until: number | undefined,
	): Array<DhtOpHash> {
		return query_dht_ops(this._state.integratedDHTOps, since, until, dht_arc);
	}

	public handle_fetch_op_hash_data(
		op_hashes: Array<DhtOpHash>,
	): HoloHashMap<DhtOpHash, DhtOp> {
		const result: HoloHashMap<DhtOpHash, DhtOp> = new HoloHashMap();
		for (const opHash of op_hashes) {
			const value = this._state.integratedDHTOps.get(opHash);
			if (value) {
				result.set(opHash, value.op);
			}
		}
		return result;
	}

	public handle_gossip_ops(
		op_hashes: Array<DhtOpHash>,
	): HoloHashMap<DhtOpHash, DhtOp> {
		const result: HoloHashMap<DhtOpHash, DhtOp> = new HoloHashMap();
		for (const opHash of op_hashes) {
			const value = this._state.integratedDHTOps.get(opHash);
			if (value) {
				result.set(opHash, value.op);
			}
		}
		return result;
	}

	async handle_gossip(from_agent: AgentPubKey, gossip: GossipData) {
		const dhtOpsToProcess: HoloHashMap<DhtOpHash, DhtOp> = new HoloHashMap();

		for (const badAction of gossip.badActions) {
			const dhtOpHash = hash(badAction.op, HashType.DHTOP);
			if (!hasDhtOpBeenProcessed(this._state, dhtOpHash)) {
				dhtOpsToProcess.set(dhtOpHash, badAction.op);
			}

			for (const receipt of badAction.receipts) {
				putValidationReceipt(dhtOpHash, receipt)(this._state);
			}
		}

		for (const [dhtOpHash, validatedOp] of gossip.validated_dht_ops.entries()) {
			for (const receipt of validatedOp.validation_receipts) {
				putValidationReceipt(dhtOpHash, receipt)(this._state);
			}

			// TODO: fix for when sharding is implemented
			if (
				!hasDhtOpBeenProcessed(this._state, dhtOpHash) &&
				this.p2p.shouldWeHold(getDhtOpBasis(validatedOp.op))
			) {
				dhtOpsToProcess.set(dhtOpHash, validatedOp.op);
			}
		}

		if (Array.from(dhtOpsToProcess.keys()).length > 0) {
			await this.handle_publish(from_agent, false, dhtOpsToProcess);
		}

		const previousCount = this._state.badAgents.length;

		const badAgents = getBadAgents(this._state);
		this._state.badAgents = uniqWith(
			[...this._state.badAgents, ...badAgents],
			isEqual,
		);

		if (this._state.badAgents.length > previousCount) {
			// We have added bad agents: resync the neighbors
			await this.p2p.syncNeighbors();
		}
	}

	// Check if the agent we are trying to connect with passes the membrane rules for this Dna
	async handle_check_agent(firstRecords: Record[]): Promise<void> {
		const result = await this.workflowExecutor.execute(
			() => run_agent_validation_callback(this.buildWorkspace(), firstRecords),
			app_validation_task(true),
		);

		if (!result.resolved) throw new Error('Unresolved in agent validate?');
		else if (!result.valid) throw new Error('Agent is invalid in this Dna');
	}

	/** Workflow internal execution */

	triggerWorkflow(workflow: Workflow<any, any>) {
		this._triggers[workflow.type].triggered = true;

		setTimeout(() => this._runPendingWorkflows());
	}

	async _runPendingWorkflows() {
		const pendingWorkflows: WorkflowType[] = Object.entries(this._triggers)
			.filter(([type, t]) => t.triggered && !t.running)
			.map(([type, t]) => type as WorkflowType);

		const workflowsToRun = pendingWorkflows.map(triggeredWorkflowFromType);

		const promises = Object.values(workflowsToRun).map(async w => {
			this._triggers[w.type].triggered = false;
			this._triggers[w.type].running = true;
			await this._runWorkflow(w);
			this._triggers[w.type].running = false;

			this._runPendingWorkflows();
		});

		await Promise.all(promises);
	}

	async _runWorkflow(workflow: Workflow<any, any>): Promise<any> {
		const result = await this.workflowExecutor.execute(
			() => workflow.task(this.buildWorkspace()),
			workflow,
		);

		result.triggers.forEach(triggeredWorkflow =>
			this.triggerWorkflow(triggeredWorkflow),
		);
		return result.result;
	}

	/** Private helpers */

	private buildWorkspace(): Workspace {
		let badAgentConfig;

		let dna = this.getSimulatedDna();
		if (this.conductor.badAgent) {
			badAgentConfig = this.conductor.badAgent.config;

			const badDna = this.conductor.badAgent.counterfeitDnas.get(this.cellId);
			if (badDna) {
				dna = badDna;
			}
		}

		return {
			conductor_handle: this.conductor,
			state: this._state,
			p2p: this.p2p,
			dna,
			badAgentConfig,
		};
	}
}
