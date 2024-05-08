import {
	AsyncComputed,
	AsyncSignal,
	Signal,
} from '@holochain-open-dev/signals';
import { AGENT_PREFIX, CellMap } from '@holochain-open-dev/utils';
import {
	AdminWebsocket,
	AgentPubKey,
	AnyDhtHash,
	CellId,
	DhtOp,
	FullIntegrationStateDump,
	FullStateDump,
	Record,
} from '@holochain/client';
import { Base64 } from 'js-base64';
import isEqual from 'lodash-es/isEqual.js';

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
				? state.value.peer_dump.peers.map(
						peerDump =>
							new Uint8Array([
								...Base64.toUint8Array(AGENT_PREFIX),
								...peerDump.kitsune_agent,
							]),
					)
				: [];

			return {
				status: 'completed',
				value,
			};
		});
		this.dhtShard = new AsyncComputed(() => {
			const state = this._state.get();
			if (state.status !== 'completed') return state;

			const value = state.value ? state.value.integration_dump.integrated : [];
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
	}

	get url() {
		return this.adminWs.client.socket.url;
	}
}

export class ConnectedPlaygroundStore extends PlaygroundStore<ConnectedConductorStore> {
	conductors = new Signal.State<ConnectedConductorStore[]>([]);

	static async create(urls: string[]): Promise<ConnectedPlaygroundStore> {
		const store = new ConnectedPlaygroundStore();
		await store.setConductors(urls);
		return store;
	}

	async setConductors(urls: string[]) {
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
