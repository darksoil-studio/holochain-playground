import { LitElement, html } from 'lit';
import { state, customElement, property } from 'lit/decorators.js';
import { ActionHash, EntryHash, AgentPubKey, Record, AppAgentClient } from '@holochain/client';
import { consume } from '@lit-labs/context';
import { decode } from '@msgpack/msgpack';
import '@material/mwc-button';
import '@material/mwc-snackbar';
import { Snackbar } from '@material/mwc-snackbar';
import '@material/mwc-textarea';

import '@material/mwc-textfield';
import { clientContext } from '../../contexts';
import { Post } from './types';

@customElement('edit-post')
export class EditPost extends LitElement {

  @consume({ context: clientContext })
  client!: AppAgentClient;
  
  @property({
      hasChanged: (newVal: ActionHash, oldVal: ActionHash) => newVal?.toString() !== oldVal?.toString()
  })
  originalPostHash!: ActionHash;

  
  @property()
  currentRecord!: Record;
 
  get currentPost() {
    return decode((this.currentRecord.entry as any).Present.entry) as Post;
  }
 
  @state()
  _title!: string;

  @state()
  _content!: string;


  isPostValid() {
    return true && this._title !== undefined && this._content !== undefined;
  }
  
  connectedCallback() {
    super.connectedCallback();
    this._title = this.currentPost.title;
    this._content = this.currentPost.content;
  }

  async updatePost() {
    const post: Post = { 
      title: this._title!,
      content: this._content!,
    };

    try {
      const updateRecord: Record = await this.client.callZome({
        cap_secret: null,
        role_name: 'forum',
        zome_name: 'posts',
        fn_name: 'update_post',
        payload: {
          original_post_hash: this.originalPostHash,
          previous_post_hash: this.currentRecord.signed_action.hashed.hash,
          updated_post: post
        },
      });
  
      this.dispatchEvent(new CustomEvent('post-updated', {
        composed: true,
        bubbles: true,
        detail: {
          originalPostHash: this.originalPostHash,
          previousPostHash: this.currentRecord.signed_action.hashed.hash,
          updatedPostHash: updateRecord.signed_action.hashed.hash
        }
      }));
    } catch (e: any) {
      const errorSnackbar = this.shadowRoot?.getElementById('update-error') as Snackbar;
      errorSnackbar.labelText = `Error updating the post: ${e.data.data}`;
      errorSnackbar.show();
    }
  }

  render() {
    return html`
      <mwc-snackbar id="update-error" leading>
      </mwc-snackbar>

      <div style="display: flex; flex-direction: column">
        <span style="font-size: 18px">Edit Post</span>
          <div style="margin-bottom: 16px">
          <mwc-textfield outlined label="Title" .value=${ this._title } @input=${(e: CustomEvent) => { this._title = (e.target as any).value; } } required></mwc-textfield>    
          </div>

          <div style="margin-bottom: 16px">
          <mwc-textarea outlined label="Content" .value=${ this._content } @input=${(e: CustomEvent) => { this._content = (e.target as any).value;} } required></mwc-textarea>    
          </div>



        <div style="display: flex; flex-direction: row">
          <mwc-button
            outlined
            label="Cancel"
            @click=${() => this.dispatchEvent(new CustomEvent('edit-canceled', {
              bubbles: true,
              composed: true
            }))}
            style="flex: 1; margin-right: 16px"
          ></mwc-button>
          <mwc-button 
            raised
            label="Save"
            .disabled=${!this.isPostValid()}
            @click=${() => this.updatePost()}
            style="flex: 1;"
          ></mwc-button>
        </div>
      </div>`;
  }
}
