import { AgentPubKey } from '@holochain/client';
import { areEqual } from '../../processors/hash.js';

import { Cell } from '../cell/cell.js';
import { NetworkRequest } from './network-request.js';

export class Connection {
  private _closed = false;

  get closed() {
    return this._closed;
  }

  close() {
    this._closed = false;
  }

  constructor(public opener: Cell, public receiver: Cell) {
    if (
      opener.p2p.badAgents.find((a) => areEqual(a, receiver.agentPubKey)) ||
      receiver.p2p.badAgents.find((a) => areEqual(a, opener.agentPubKey))
    ) {
      throw new Error('Connection closed!');
    }
  }

  sendRequest<T>(
    fromAgent: AgentPubKey,
    networkRequest: NetworkRequest<T>
  ): Promise<T> {
    if (this.closed) throw new Error('Connection closed!');

    if (areEqual(this.opener.agentPubKey, fromAgent)) {
      return networkRequest(this.receiver);
    } else if (areEqual(this.receiver.agentPubKey, fromAgent)) {
      return networkRequest(this.opener);
    }
    throw new Error('Bad request');
  }

  getPeer(myAgentPubKey: AgentPubKey): Cell {
    if (areEqual(myAgentPubKey, this.opener.agentPubKey)) return this.receiver;
    return this.opener;
  }
}
