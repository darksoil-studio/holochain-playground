import {
	ActionHash,
	AppClient,
	DnaHash,
	EntryHash,
	Record,
} from '@holochain/client';
import { consume } from '@lit-labs/context';
import { Task } from '@lit-labs/task';
import '@material/mwc-circular-progress';
import '@material/mwc-icon-button';
import '@material/mwc-snackbar';
import { Snackbar } from '@material/mwc-snackbar';
import { decode } from '@msgpack/msgpack';
import { LitElement, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import { clientContext } from '../../contexts';
import { Comment } from './types';

@customElement('comment-detail')
export class CommentDetail extends LitElement {
	@consume({ context: clientContext })
	client!: AppClient;

	@property({
		hasChanged: (newVal: ActionHash, oldVal: ActionHash) =>
			newVal?.toString() !== oldVal?.toString(),
	})
	commentHash!: ActionHash;

	_fetchRecord = new Task(
		this,
		([commentHash]) =>
			this.client.callZome({
				cap_secret: null,
				role_name: 'forum',
				zome_name: 'posts',
				fn_name: 'get_comment',
				payload: commentHash,
			}) as Promise<Record | undefined>,
		() => [this.commentHash],
	);

	firstUpdated() {
		if (this.commentHash === undefined) {
			throw new Error(
				`The commentHash property is required for the comment-detail element`,
			);
		}
	}

	async deleteComment() {
		try {
			await this.client.callZome({
				cap_secret: null,
				role_name: 'forum',
				zome_name: 'posts',
				fn_name: 'delete_comment',
				payload: this.commentHash,
			});
			this.dispatchEvent(
				new CustomEvent('comment-deleted', {
					bubbles: true,
					composed: true,
					detail: {
						commentHash: this.commentHash,
					},
				}),
			);
			this._fetchRecord.run();
		} catch (e: any) {
			const errorSnackbar = this.shadowRoot?.getElementById(
				'delete-error',
			) as Snackbar;
			errorSnackbar.labelText = `Error deleting the comment: ${e.data.data}`;
			errorSnackbar.show();
		}
	}

	renderDetail(record: Record) {
		const comment = decode((record.entry as any).Present.entry) as Comment;

		return html`
			<mwc-snackbar id="delete-error" leading> </mwc-snackbar>

			<div style="display: flex; flex-direction: column">
				<div style="display: flex; flex-direction: row">
					<span style="flex: 1"></span>

					<mwc-icon-button
						style="margin-left: 8px"
						icon="delete"
						@click=${() => this.deleteComment()}
					></mwc-icon-button>
				</div>

				<div style="display: flex; flex-direction: row; margin-bottom: 16px">
					<span style="margin-right: 4px"><strong>Comment: </strong></span>
					<span style="white-space: pre-line">${comment.comment}</span>
				</div>
			</div>
		`;
	}

	renderComment(maybeRecord: Record | undefined) {
		if (!maybeRecord)
			return html`<span>The requested comment was not found.</span>`;

		return this.renderDetail(maybeRecord);
	}

	render() {
		return this._fetchRecord.render({
			pending: () =>
				html`<div
					style="display: flex; flex: 1; align-items: center; justify-content: center"
				>
					<mwc-circular-progress indeterminate></mwc-circular-progress>
				</div>`,
			complete: maybeRecord => this.renderComment(maybeRecord),
			error: (e: any) =>
				html`<span>Error fetching the comment: ${e.data.data}</span>`,
		});
	}
}
