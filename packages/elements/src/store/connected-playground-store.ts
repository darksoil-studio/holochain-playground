import { ValidationStatus } from '@darksoil-studio/holochain-core-types';
import {
	AsyncComputed,
	AsyncSignal,
	Signal,
} from '@darksoil-studio/holochain-signals';
import {
	AGENT_PREFIX,
	CellMap,
	locationBytes,
} from '@darksoil-studio/holochain-utils';
import { ValidationLimboStatus } from '@holochain-playground/simulator';
import {
	AdminWebsocket,
	AgentPubKey,
	AnyDhtHash,
	AppInfo,
	CellId,
	DhtOp,
	FullIntegrationStateDump,
	FullStateDump,
	Record,
	decodeHashFromBase64,
	encodeHashToBase64,
} from '@holochain/client';
import { Base64 } from 'js-base64';
import isEqual from 'lodash-es/isEqual.js';

import { kitsuneAgentToAgentPubKey } from '../utils.js';
import {
	CellStore,
	ConductorStore,
	PlaygroundStore,
	getFromStore,
} from './playground-store.js';
import { pollingSignal } from './polling-store.js';
import { cellChanges } from './utils.js';

export class ConnectedCellStore implements CellStore {
	private _state: AsyncSignal<FullStateDump>;

	sourceChain: AsyncSignal<Record[]>;

	peers: AsyncSignal<AgentPubKey[]>;

	validationQueue: AsyncSignal<{
		validationLimbo: Array<{
			op: DhtOp;
			status: ValidationLimboStatus | undefined;
		}>;
		integrationLimbo: Array<{
			op: DhtOp;
			status: ValidationStatus | undefined;
		}>;
		integrated: Array<{
			op: DhtOp;
			status: ValidationStatus | undefined;
		}>;
	}>;

	dhtShard: AsyncSignal<Array<DhtOp>>;

	constructor(
		public conductorStore: ConnectedConductorStore,
		public cellId: CellId,
		adminWs: AdminWebsocket,
	) {
		this._state = pollingSignal(async currentState => {
			const fullState = await adminWs.dumpFullState({
				cell_id: cellId,
				dht_ops_cursor: currentState
					? currentState.integration_dump.dht_ops_cursor
					: undefined,
			});
			const currentIntegration: FullIntegrationStateDump | undefined =
				currentState?.integration_dump;

			const integration_dump: FullIntegrationStateDump = {
				dht_ops_cursor: fullState.integration_dump.dht_ops_cursor,
				integrated: currentState
					? [
							...(currentIntegration ? currentIntegration.integrated : []),
							...fullState.integration_dump.integrated,
						]
					: fullState.integration_dump.integrated,
				validation_limbo: currentState
					? [
							...(currentIntegration
								? currentIntegration.validation_limbo
								: []),
							...fullState.integration_dump.validation_limbo,
						]
					: fullState.integration_dump.validation_limbo,
				integration_limbo: currentState
					? [
							...(currentIntegration
								? currentIntegration.integration_limbo
								: []),
							...fullState.integration_dump.integration_limbo,
						]
					: fullState.integration_dump.integration_limbo,
			};

			return {
				...fullState,
				integration_dump,
			} as FullStateDump;
		});

		this.sourceChain = new AsyncComputed<Record[]>(() => {
			const state = this._state.get();
			if (state.status !== 'completed') return state;
			const value = state.value
				? state.value.source_chain_dump.records.map(
						r =>
							({
								signed_action: {
									hashed: {
										hash: r.action_address,
										content: r.action,
									},
									signature: r.signature,
								},
								entry: {
									Present: r.entry,
								},
							}) as Record,
					)
				: [];

			return {
				status: 'completed',
				value,
			};
		});

		this.peers = new AsyncComputed(() => {
			const state = this._state.get();
			if (state.status !== 'completed') return state;
			const value = state.value
				? state.value.peer_dump.peers.map(peerDump =>
						kitsuneAgentToAgentPubKey(
							peerDump.kitsune_agent as unknown as string,
						),
					)
				: [];

			return {
				status: 'completed',
				value,
			};
		});
		this.validationQueue = new AsyncComputed(() => {
			const state = this._state.get();
			if (state.status !== 'completed') return state;

			const integrationLimbo = state.value
				? state.value.integration_dump.integration_limbo.map(op => ({
						op,
						status: undefined as ValidationStatus | undefined,
					}))
				: [];
			const validationLimbo = state.value
				? state.value.integration_dump.validation_limbo.map(op => ({
						op,
						status: undefined as ValidationLimboStatus | undefined,
					}))
				: [];
			const integrated = state.value
				? state.value.integration_dump.integrated.map(op => ({
						op,
						status: undefined as ValidationStatus | undefined,
					}))
				: [];
			return {
				status: 'completed',
				value: {
					integrationLimbo,
					validationLimbo,
					integrated,
				},
			};
		});
		this.dhtShard = new AsyncComputed(() => {
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
	}

	get(hash: AnyDhtHash): AsyncSignal<any | undefined> {
		return getFromStore(this, hash);
	}
}

export class ConnectedConductorStore
	implements ConductorStore<ConnectedCellStore>
{
	happs: AsyncSignal<Array<AppInfo>>;
	cells: AsyncSignal<CellMap<ConnectedCellStore>>;

	constructor(protected adminWs: AdminWebsocket) {
		this.cells = pollingSignal(async currentCells => {
			if (!currentCells) {
				currentCells = new CellMap<ConnectedCellStore>();
			}
			const cellIds = await adminWs.listCellIds();

			const { cellsToAdd, cellsToRemove } = cellChanges(
				currentCells.cellIds(),
				cellIds,
			);

			for (const cellId of cellsToAdd) {
				currentCells.set(cellId, new ConnectedCellStore(this, cellId, adminWs));
			}

			for (const cellId of cellsToRemove) {
				if (!cellIds.find(c => isEqual(c, cellId))) {
					currentCells.delete(cellId);
				}
			}

			return currentCells;
		});
		this.happs = pollingSignal(async currentHapps => {
			const apps = await adminWs.listApps({});
			return apps;
		});
	}

	get url() {
		return this.adminWs.client.socket.url;
	}
}

export class ConnectedPlaygroundStore extends PlaygroundStore<ConnectedConductorStore> {
	conductors = new Signal.State<ConnectedConductorStore[]>([]);

	public async setConductors(urls: string[]) {
		const normalizedUrls = urls.map(u => normalizeUrl(u));

		const currentUrls = this.conductors.get().map(c => c.url);

		const toAdd = normalizedUrls.filter(u => !currentUrls.includes(u));
		const toRemove = currentUrls.filter(u => !normalizedUrls.includes(u));

		const promises = toAdd.map(async url => {
			try {
				const ws = await AdminWebsocket.connect({
					url: new URL(url),
				});
				return ws;
			} catch (e) {
				console.error('COULD NOT CONNECT TO ADMINWEBSOCKET AT URL ', url);
				return false;
			}
		});
		const maybeAdminWss = await Promise.all(promises);
		const adminWss = maybeAdminWss.filter(ws => !!ws) as AdminWebsocket[];

		if (toAdd.length > 0 || toRemove.length > 0) {
			const conductors = this.conductors.get();
			this.conductors.set([
				...conductors.filter(c => !toRemove.includes(c.url)),
				...adminWss.map(ws => new ConnectedConductorStore(ws)),
			]);
		}
	}
}

function normalizeUrl(url: string): string {
	if (url.endsWith('/')) return url;
	return `${url}/`;
}
