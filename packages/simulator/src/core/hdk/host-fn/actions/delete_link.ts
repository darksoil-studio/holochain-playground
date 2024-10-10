import { ActionHash, CreateLink, Record } from '@holochain/client';

import { GetStrategy } from '../../../../types.js';
import {
	buildDeleteLink,
	buildShh,
} from '../../../cell/source-chain/builder-actions.js';
import { putRecord } from '../../../cell/source-chain/put.js';
import { HostFn, HostFnWorkspace } from '../../host-fn.js';

export type DeleteLinkFn = (deletes_address: ActionHash) => Promise<ActionHash>;

// Creates a new Create action and its entry in the source chain
export const delete_link: HostFn<DeleteLinkFn> =
	(worskpace: HostFnWorkspace): DeleteLinkFn =>
	async (deletes_address): Promise<ActionHash> => {
		const elementToDelete = await worskpace.cascade.dht_get(deletes_address, {
			strategy: GetStrategy.Contents,
		});

		if (!elementToDelete)
			throw new Error('Could not find element to be deleted');

		const baseAddress = (
			elementToDelete.signed_action.hashed.content as CreateLink
		).base_address;

		if (!baseAddress)
			throw new Error('Action for the given hash is not a CreateLink action');

		const deleteAction = buildDeleteLink(
			worskpace.state,
			baseAddress,
			deletes_address,
		);

		const element: Record = {
			signed_action: buildShh(deleteAction),
			entry: { NotApplicable: undefined },
		};
		putRecord(element)(worskpace.state);

		return element.signed_action.hashed.hash;
	};
