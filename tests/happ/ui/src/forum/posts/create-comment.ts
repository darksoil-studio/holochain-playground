import { LitElement, html } from 'lit';
import { state, customElement, property } from 'lit/decorators.js';
import { InstalledCell, ActionHash, Record, AgentPubKey, EntryHash, AppAgentClient, DnaHash } from '@holochain/client';
import { consume } from '@lit-labs/context';
import '@material/mwc-button';
import '@material/mwc-snackbar';
import { Snackbar } from '@material/mwc-snackbar';
import '@material/mwc-textarea';

import { clientContext } from '../../contexts';
import { Comment } from './types';

@customElement('create-comment')
export class CreateComment extends LitElement {
  @consume({ context: clientContext })
  client!: AppAgentClient;

  @property()
  postHash!: ActionHash;

  @state()
  _comment: string = '';

  
  firstUpdated() {
    if (this.postHash === undefined) {
      throw new Error(`The postHash input is required for the create-comment element`);
    }
  }

  isCommentValid() {
    return true && this._comment !== '';
  }

  async createComment() {
    const comment: Comment = { 
        comment: this._comment,
        post_hash: this.postHash,
    };

    try {
      const record: Record = await this.client.callZome({
        cap_secret: null,
        role_name: 'forum',
        zome_name: 'posts',
        fn_name: 'create_comment',
        payload: comment,
      });

      this.dispatchEvent(new CustomEvent('comment-created', {
        composed: true,
        bubbles: true,
        detail: {
          commentHash: record.signed_action.hashed.hash
        }
      }));
    } catch (e: any) {
      const errorSnackbar = this.shadowRoot?.getElementById('create-error') as Snackbar;
      errorSnackbar.labelText = `Error creating the comment: ${e.data.data}`;
      errorSnackbar.show();
    }
  }

  render() {
    return html`
      <mwc-snackbar id="create-error" leading>
      </mwc-snackbar>

      <div style="display: flex; flex-direction: column">
        <span style="font-size: 18px">Create Comment</span>

          <div style="margin-bottom: 16px">
            <mwc-textarea outlined label="Comment" .value=${ this._comment } @input=${(e: CustomEvent) => { this._comment = (e.target as any).value;} } required></mwc-textarea>          
          </div>
            

        <mwc-button 
          raised
          label="Create Comment"
          .disabled=${!this.isCommentValid()}
          @click=${() => this.createComment()}
        ></mwc-button>
    </div>`;
  }
}
