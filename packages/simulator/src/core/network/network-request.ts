import { AgentPubKey, DhtOp, DnaHash } from '@holochain/client';
import { AnyDhtHashB64, DhtOpHash } from '@tnesh-stack/core-types';
import { HoloHashMap } from '@tnesh-stack/utils';

import { GetOptions } from '../../types.js';
import { Cell } from '../cell/cell.js';

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
