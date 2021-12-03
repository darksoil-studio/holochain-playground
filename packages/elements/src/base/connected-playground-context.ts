import { AdminWebsocket } from '@holochain/conductor-api';
import {} from 'lit';
import { property } from 'lit/decorators.js';
import { ConnectedPlaygroundStore } from '../store/connected-playground-store';
import { PlaygroundMode } from '../store/mode';

import { BasePlaygroundContext } from './base-playground-context';

export class ConnectedPlaygroundContext extends BasePlaygroundContext<PlaygroundMode.Connected> {
  @property()
  urls: string[];

  async buildStore() {
    return ConnectedPlaygroundStore.create(this.urls);
  }
}
