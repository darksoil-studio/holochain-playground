import { CellMap, HashType, hash, Cell } from '@holochain-playground/simulator';
import {
  AgentPubKey,
  AnyDhtHash,
  CellId,
  DhtOp,
  DhtOpType,
  DnaHash,
  getDhtOpEntry,
  getDhtOpAction,
  getDhtOpType,
  NewEntryAction,
  Record,
  SignedActionHashed,
  ActionHashed,
} from '@holochain/client';
import isEqual from 'lodash-es/isEqual';
import { derived, get, Readable, writable, Writable } from 'svelte/store';

import { PlaygroundMode } from './mode';
import { SimulatedCellStore } from './simulated-playground-store';
import { unnest } from './unnest';
import { mapDerive } from './utils';

export abstract class CellStore<T extends PlaygroundMode> {
  abstract sourceChain: Readable<Record[]>;
  abstract peers: Readable<AgentPubKey[]>;
  abstract dhtShard: Readable<Array<DhtOp>>;
  abstract cellId: CellId;

  constructor(public conductorStore: ConductorStore<T>) {}

  get(dhtHash: AnyDhtHash): any {
    return derived(
      [this.sourceChain, this.dhtShard],
      ([sourceChain, dhtShard]) => {
        for (const record of sourceChain) {
          const actionHashed: ActionHashed = record.signed_action.hashed;
          if (isEqual(actionHashed.hash, dhtHash)) {
            return actionHashed.content;
          }
          if (
            (actionHashed.content as NewEntryAction).entry_hash &&
            isEqual(
              (actionHashed.content as NewEntryAction).entry_hash,
              dhtHash
            )
          ) {
            return record.entry;
          }
        }

        for (const op of dhtShard) {
          const action = getDhtOpAction(op);
          const actionHash = hash(action, HashType.HEADER);

          if (isEqual(actionHash, dhtHash)) {
            return action;
          }

          if (
            (action as NewEntryAction).entry_hash &&
            isEqual((action as NewEntryAction).entry_hash, dhtHash)
          ) {
            const type = getDhtOpType(op);
            if (
              type === DhtOpType.StoreEntry ||
              type === DhtOpType.StoreRecord
            ) {
              return getDhtOpEntry(op);
            }
          }
        }
        return undefined;
      }
    );
  }
}

export abstract class ConductorStore<T extends PlaygroundMode> {
  abstract cells: Readable<CellMap<CellStore<T>>>;
}

export abstract class PlaygroundStore<T extends PlaygroundMode> {
  activeDna: Writable<DnaHash | undefined> = writable(undefined);
  activeAgentPubKey: Writable<AgentPubKey | undefined> = writable(undefined);
  activeDhtHash: Writable<AnyDhtHash | undefined> = writable(undefined);

  abstract conductors: Readable<Array<ConductorStore<T>>>;

  constructor() {
    let currentvalue = undefined;
    this.activeDna.subscribe((v: DnaHash) => {
      if (!isEqual(v, currentvalue)) {
        currentvalue = v;

        this.activeDhtHash.set(undefined);
        const currentConductors = get(this.conductors);

        const activePubKey = get(this.activeAgentPubKey);
        if (
          activePubKey &&
          !currentConductors.find((c) => get(c.cells).has([v, activePubKey]))
        ) {
          this.activeAgentPubKey.set(undefined);
        }
      }
    });
  }

  cell(cellId: CellId): Readable<CellStore<T> | undefined> {
    return derived(this.allCells(), (cells) => cells.get(cellId));
  }

  activeCell(): Readable<CellStore<T> | undefined> {
    return derived(
      [this.activeDna, this.activeAgentPubKey, this.allCells()],
      ([dnaHash, agentPubKey, cellMap]) => {
        if (!dnaHash || !agentPubKey) return undefined;

        return cellMap.get([dnaHash, agentPubKey]);
      }
    );
  }

  allDnas(): Readable<DnaHash[]> {
    return derived(this.allCells(), (cellMap) =>
      cellMap.cellIds().map((cellId) => cellId[0])
    );
  }

  allCells(): Readable<CellMap<CellStore<T>>> {
    return unnest(this.conductors, (conductors) =>
      derived(
        conductors.map((c) => c.cells),
        (cellMaps) =>
          cellMaps.reduce((acc, next) => {
            for (const [cellId, store] of next.entries()) {
              acc.put(cellId, store);
            }
            return acc;
          }, new CellMap())
      )
    );
  }

  activeContent(): Readable<any | undefined> {
    const contentMap = unnest(
      derived(
        [this.cellsForActiveDna(), this.activeDhtHash],
        ([cellMap, activeHash]) => mapDerive(cellMap, (c) => (c as any).get(activeHash))
      ),
      (i) => i
    );

    return derived(contentMap, (map) => {
      for (const a of map.values()) {
        if (a) {
          return a;
        }
      }
      return undefined;
    });
  }

  cellsForActiveDna(): Readable<CellMap<CellStore<T>>> {
    return derived(
      [this.activeDna, this.allCells()],
      ([activeDna, allCells]) => {
        const map = new CellMap<CellStore<T>>();

        for (const [cellId, value] of allCells.entries()) {
          if (isEqual(activeDna, cellId[0])) {
            map.put(cellId, value);
          }
        }
        return map;
      }
    );
  }

  dhtForActiveDna(): Readable<CellMap<DhtOp[]>> {
    return unnest(
      derived(this.cellsForActiveDna(), (cellMap) =>
        mapDerive<CellStore<T>, DhtOp[]>(cellMap, (cellStore) => cellStore.dhtShard)
      ),
      (i) => i
    );
  }
}
