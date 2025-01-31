import { SimulatedDna } from '../../../dnas/simulated-dna.js';
import { BadAgentConfig } from '../../bad-agent.js';
import { Conductor } from '../../conductor.js';
import { P2pCell } from '../../network/p2p-cell.js';
import { CellState } from '../state.js';

export interface Workspace {
	conductor_handle: Conductor;
	state: CellState;
	p2p: P2pCell;
	dna: SimulatedDna;
	badAgentConfig?: BadAgentConfig & { counterfeit_dna?: SimulatedDna };
}

export interface Workflow<D, R> {
	type: WorkflowType;
	details: D;
	task: (worskpace: Workspace) => Promise<WorkflowReturn<R>>;
}
export type WorkflowReturn<R> = {
	result: R;
	triggers: Array<Workflow<any, any>>;
};

export enum WorkflowType {
	CALL_ZOME = 'Call Zome Function',
	SYS_VALIDATION = 'System Validation',
	PUBLISH_DHT_OPS = 'Publish DHT Ops',
	PRODUCE_DHT_OPS = 'Produce DHT Ops',
	APP_VALIDATION = 'App Validation',
	AGENT_VALIDATION = 'Validate Agent',
	INTEGRATE_DHT_OPS = 'Integrate DHT Ops',
	GENESIS = 'Genesis',
	INCOMING_DHT_OPS = 'Incoming DHT Ops',
	VALIDATION_RECEIPT = 'Validation Receipt',
}

export function workflowPriority(workflowType: WorkflowType): number {
	switch (workflowType) {
		case WorkflowType.GENESIS:
			return 0;
		case WorkflowType.CALL_ZOME:
			return 1;
		default:
			return 10;
	}
}
