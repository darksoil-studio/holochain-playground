import { DnaHash, encodeHashToBase64 } from '@holochain/client';
import { Card, ListItem, Select } from '@scoped-elements/material-web';
import { css, html } from 'lit';
import isEqual from 'lodash-es/isEqual.js';

import { PlaygroundElement } from '../../base/playground-element.js';
import { sharedStyles } from '../utils/shared-styles.js';

export class SelectActiveDna extends PlaygroundElement {
	selectDNA(dna: DnaHash) {
		this.store.activeDna.set(dna);
	}

	renderDna(dna: DnaHash) {
		const strDna = encodeHashToBase64(dna);
		const activeDna = this.store.activeDna.get();

		return html`
			<mwc-list-item ?selected=${isEqual(activeDna, dna)} .value=${strDna}
				>${strDna}</mwc-list-item
			>
		`;
	}

	render() {
		const allDnasResult = this.store.allDnas.get();
		const allDnas =
			allDnasResult.status === 'completed' ? allDnasResult.value : [];
		return html`
			<mwc-card class="block-card">
				<div class="column" style="margin: 16px;">
					<span class="block-title" style="margin-bottom: 16px;"
						>Select Active Dna</span
					>
					<mwc-select
						outlined
						fullwidth
						@selected=${(e: any) => this.selectDNA(allDnas[e.detail.index])}
					>
						${allDnas.map(dna => this.renderDna(dna))}
					</mwc-select>
				</div>
			</mwc-card>
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

	static get scopedElements() {
		return {
			'mwc-list-item': ListItem,
			'mwc-select': Select,
			'mwc-card': Card,
		};
	}
}
