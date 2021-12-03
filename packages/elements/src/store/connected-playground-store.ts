import { Element } from '@holochain-open-dev/core-types';
import {
  derived,
  get,
  readable,
  Readable,
  Writable,
  writable,
} from 'svelte/store';
import {
  FullStateDump,
  CellId,
  AdminWebsocket,
  AgentPubKey,
  DhtOp,
  AnyDhtHash,
  NewEntryHeader,
} from '@holochain/conductor-api';
import merge from 'lodash-es/merge';
import isEqual from 'lodash-es/isEqual';
import { CellMap, HoloHashMap } from '@holochain-playground/simulator';

import { CellStore, ConductorStore, PlaygroundStore } from './playground-store';
import { pollingStore } from './polling-store';
import { PlaygroundMode } from './mode';
import { cellChanges } from './utils';

export class ConnectedCellStore extends CellStore<PlaygroundMode.Connected> {
  _state: Readable<FullStateDump | undefined>;

  sourceChain: Readable<Element[]>;
  peers: Readable<AgentPubKey[]>;
  dhtShard: Readable<Array<DhtOp>>;

  constructor(
    conductorStore: ConnectedConductorStore,
    public cellId: CellId,
    adminWs: AdminWebsocket
  ) {
    super(conductorStore);
    this._state = pollingStore(undefined, async (currentState) => {
      const fullState = await adminWs.dumpFullState({
        cell_id: cellId,
        dht_ops_cursor: currentState
          ? currentState.integration_dump.dht_ops_cursor
          : undefined,
      });
      const integration_dump = currentState
        ? merge(currentState.integration_dump, fullState.integration_dump)
        : fullState.integration_dump;
      return {
        ...fullState,
        integration_dump,
      };
    });

    this.sourceChain = derived(this._state, (s) =>
      s
        ? s.source_chain_dump.elements.map((e) => ({
            signed_header: {
              header: {
                content: e.header,
                hash: e.header_address,
              },
              signature: e.signature,
            },
            entry: e.entry,
          }))
        : []
    );
    this.peers = derived(this._state, (s) =>
      s ? s.peer_dump.peers.map((peerDump) => peerDump.kitsune_agent) : []
    );
    this.dhtShard = derived(this._state, (s) =>
      s ? s.integration_dump.integrated : []
    );
  }
}

export class ConnectedConductorStore extends ConductorStore<PlaygroundMode.Connected> {
  cells: Readable<CellMap<ConnectedCellStore>>;

  constructor(protected adminWs: AdminWebsocket) {
    super();

    this.cells = pollingStore(
      new CellMap<ConnectedCellStore>(),
      async (currentCells) => {
        const cellIds = await adminWs.listCellIds();

        const { cellsToAdd, cellsToRemove } = cellChanges(
          currentCells.cellIds(),
          cellIds
        );

        for (const cellId of cellsToAdd) {
          currentCells.put(
            cellId,
            new ConnectedCellStore(this, cellId, adminWs)
          );
        }

        for (const cellId of cellsToRemove) {
          if (!cellIds.find((c) => isEqual(c, cellId))) {
            currentCells.delete(cellId);
          }
        }

        return currentCells;
      }
    );
  }

  get url() {
    return this.adminWs.client.socket.url;
  }
}

export class ConnectedPlaygroundStore extends PlaygroundStore<PlaygroundMode.Connected> {
  conductors: Readable<ConnectedConductorStore[]>;

  private constructor(adminWss: AdminWebsocket[]) {
    super();
    this.conductors = readable(
      adminWss.map((ws) => new ConnectedConductorStore(ws))
    );
  }

  static async create(urls: string[]): Promise<ConnectedPlaygroundStore> {
    const promises = urls.map((url) => AdminWebsocket.connect(url));
    const adminWss = await Promise.all(promises);
    return new ConnectedPlaygroundStore(adminWss);
  }
}
