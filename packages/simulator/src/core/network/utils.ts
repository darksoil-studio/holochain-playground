import {
  ValidationReceipt,
  ValidationStatus,
} from '@holochain-open-dev/core-types';
import {
  AgentPubKey,
  AnyDhtHash,
  DhtOp,
  getDhtOpHeader,
} from '@holochain/conductor-api';
import { uniq } from 'lodash-es';
import { distance, location, wrap } from '../../processors/hash';
import { CellState } from '../cell';

export function getClosestNeighbors(
  peers: AgentPubKey[],
  targetHash: AnyDhtHash,
  numNeighbors: number
): AgentPubKey[] {
  const sortedPeers = peers.sort((agentA: AgentPubKey, agentB: AgentPubKey) => {
    const distanceA = distance(agentA, targetHash);
    const distanceB = distance(agentB, targetHash);
    return distanceA - distanceB;
  });

  return sortedPeers.slice(0, numNeighbors);
}

export function getFarthestNeighbors(
  peers: AgentPubKey[],
  targetHash: AnyDhtHash
): AgentPubKey[] {
  const sortedPeers = peers.sort((agentA: AgentPubKey, agentB: AgentPubKey) => {
    return (
      wrap(location(agentA) - location(targetHash)) -
      wrap(location(agentB) - location(targetHash))
    );
  });

  const index35 = Math.floor(sortedPeers.length * 0.35);
  const index50 = Math.floor(sortedPeers.length / 2);
  const index65 = Math.floor(sortedPeers.length * 0.65);

  const neighbors = [
    sortedPeers[index35],
    sortedPeers[index50],
    sortedPeers[index65],
  ].filter(n => !!n);

  return uniq(neighbors);
}

export interface BadAction {
  badAgents: AgentPubKey[];
  op: DhtOp;
  receipts: ValidationReceipt[];
}
export function getBadActions(state: CellState): Array<BadAction> {
  const badActions: Array<BadAction> = [];

  for (const [dhtOpHash, receipts] of state.validationReceipts.entries()) {
    const myReceipt = receipts.get(state.agentPubKey);
    if (myReceipt) {
      const dhtOp = state.integratedDHTOps.get(dhtOpHash).op;
      const badAction: BadAction = {
        badAgents: [],
        op: dhtOp,
        receipts: receipts.values(),
      };

      if (myReceipt.validation_status === ValidationStatus.Rejected) {
        badAction.badAgents.push(getDhtOpHeader(dhtOp).author);
      }
      for (const [validatorAgent, receipt] of receipts.entries()) {
        if (receipt.validation_status !== myReceipt.validation_status) {
          badAction.badAgents.push(receipt.validator);
        }
      }

      if (badAction.badAgents.length > 0) {
        badActions.push(badAction);
      }
    }
  }
  return badActions;
}

export function getBadAgents(state: CellState): AgentPubKey[] {
  const actions = getBadActions(state);

  const badAgents: AgentPubKey[] = actions.reduce(
    (acc, next) => [...acc, ...next.badAgents],
    [] as AgentPubKey[]
  );

  return uniq(badAgents);
}
