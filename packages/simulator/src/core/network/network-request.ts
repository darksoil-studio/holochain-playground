import {
  AgentPubKeyB64,
  AnyDhtHashB64,
  Dictionary,
  DnaHashB64,
} from '@holochain-open-dev/core-types';
import { AgentPubKey, DnaHash, DhtOp } from '@holochain/conductor-api';
import { HoloHashMap } from '../../processors/holo-hash-map';
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
    dhtOps: HoloHashMap<DhtOp>;
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
