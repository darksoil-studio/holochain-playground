import {
	ActionHash,
	ActionType,
	EntryHash,
	EntryType,
} from '@holochain/client';

export type GetOptions = {
	strategy: GetStrategy;
};
export type GetLinksOptions = {};

export enum GetStrategy {
	Latest,
	Contents,
}

export type ChainQueryFilterRange =
	| {
			Unbounded: undefined;
	  }
	| {
			ActionSeqRange: [number, number];
	  }
	| {
			ActionHashRange: [ActionHash, ActionHash];
	  }
	| {
			ActionHashTerminated: [ActionHash, number];
	  };

export interface ChainQueryFilter {
	sequence_range: ChainQueryFilterRange;
	entry_type: Array<EntryType> | undefined;
	entry_hashes: Array<EntryHash> | undefined;
	action_type: Array<ActionType> | undefined;
	include_entries: boolean;
	order_descending: boolean;
}

export type Dictionary<T> = Record<string, T>;
