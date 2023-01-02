
import { LitElement, html } from 'lit';
import { state, customElement, property } from 'lit/decorators.js';
import { InstalledCell, Record, AppAgentClient, EntryHash, ActionHash, AgentPubKey } from '@holochain/client';
import { consume } from '@lit-labs/context';
import '@material/mwc-circular-progress';
import { Task } from '@lit-labs/task';

import { clientContext } from '../../contexts';
import './comment-detail';

@customElement('comments-for-post')
export class CommentsForPost extends LitElement {
  @consume({ context: clientContext })
  client!: AppAgentClient;

  @property({
    hasChanged: (newVal: ActionHash, oldVal: ActionHash) => newVal.toString() !== oldVal.toString()
  })
  postHash!: ActionHash;

  _fetchComments = new Task(this, ([postHash]) => this.client.callZome({
      cap_secret: null,
      role_name: 'forum',
      zome_name: 'posts',
      fn_name: 'get_comments_for_post',
      payload: postHash,
  }) as Promise<Array<ActionHash>>, () => [this.postHash]);

  renderList(hashes: Array<ActionHash>) {
    if (hashes.length === 0) return html`<span>No comments found for this post.</span>`;
    
    return html`
      <div style="display: flex; flex-direction: column">
        ${hashes.map(hash =>
          html`<comment-detail .commentHash=${hash}></comment-detail>`
        )}
      </div>
    `;
  }

  render() {
    return this._fetchComments.render({
      pending: () => html`<div style="display: flex; flex: 1; align-items: center; justify-content: center">
        <mwc-circular-progress indeterminate></mwc-circular-progress>
      </div>`,
      complete: (hashes) => this.renderList(hashes),
      error: (e: any) => html`<span>Error fetching comments: ${e.data.data}.</span>`
    });
  }
}
