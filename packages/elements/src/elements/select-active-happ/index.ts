import { DnaHash, encodeHashToBase64 } from '@holochain/client';
import '@shoelace-style/shoelace/dist/components/card/card.js';
import '@shoelace-style/shoelace/dist/components/select/select.js';
import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import isEqual from 'lodash-es/isEqual.js';

import { PlaygroundElement } from '../../base/playground-element.js';
import { sharedStyles } from '../utils/shared-styles.js';

@customElement('select-active-happ')
export class SelectActiveHapp extends PlaygroundElement {
	selectHapp(happ: string) {
		this.store.activeHapp.set(happ);
	}

	renderHapp(dna: DnaHash) {
		const strDna = encodeHashToBase64(dna);
		const activeDna = this.store.activeDna.get();

		return html` <sl-option .value=${strDna}>${strDna}</sl-option> `;
	}

	render() {
		const allDnasResult = this.store.allDnas.get();
		const allDnas =
			allDnasResult.status === 'completed' ? allDnasResult.value : [];
		return html`
			<sl-card class="block-card">
				<div class="column" style="margin: 16px;">
					<span class="block-title" style="margin-bottom: 16px;"
						>Select Active Dna</span
					>
					<sl-select
						@selected=${(e: any) => this.selectDNA(allDnas[e.detail.index])}
					>
						${allDnas.map(dna => this.renderDna(dna))}
					</sl-select>
				</div>
			</sl-card>
		`;
	}

	static get styles() {
		return [
			css`
				:host {
					display: flex;
					flex: 1;
				}
			`,
			sharedStyles,
		];
	}
}
