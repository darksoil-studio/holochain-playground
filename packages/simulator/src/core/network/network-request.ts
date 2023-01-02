import { AnyDhtHashB64, DhtOpHash } from '@holochain-open-dev/core-types';
import { HoloHashMap } from '@holochain-open-dev/utils';
import { AgentPubKey, DnaHash, DhtOp } from '@holochain/client';
import { GetOptions } from '../../types';
import { Cell } from '../cell/cell';

export enum NetworkRequestType {
  CALL_REMOTE = 'Call Remote',
  PUBLISH_REQUEST = 'Publish Request',
  GET_REQUEST = 'Get Request',
  WARRANT = 'Warrant',
  GOSSIP = 'Gossip',
  CONNECT = 'Connect',
}

export type NetworkRequest<T> = (cell: Cell) => Promise<T>;

export interface NetworkRequestInfo<T extends NetworkRequestType, D> {
  dnaHash: DnaHash;
  fromAgent: AgentPubKey;
  toAgent: AgentPubKey;
  type: T;
  details: D;
}

export type PublishRequestInfo = NetworkRequestInfo<
  NetworkRequestType.PUBLISH_REQUEST,
  {
    dhtOps: HoloHashMap<DhtOpHash, DhtOp>;
  }
>;

export type GetRequestInfo = NetworkRequestInfo<
  NetworkRequestType.GET_REQUEST,
  {
    hash: AnyDhtHashB64;
    options: GetOptions;
  }
>;

export type CallRemoteRequestInfo = NetworkRequestInfo<
  NetworkRequestType.CALL_REMOTE,
  {}
>;
