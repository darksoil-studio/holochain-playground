import {
	DnaHash,
	decodeHashFromBase64,
	encodeHashToBase64,
} from '@holochain/client';
import '@shoelace-style/shoelace/dist/components/card/card.js';
import '@shoelace-style/shoelace/dist/components/option/option.js';
import '@shoelace-style/shoelace/dist/components/select/select.js';
import SlSelect from '@shoelace-style/shoelace/dist/components/select/select.js';
import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';

import { PlaygroundElement } from '../../base/playground-element.js';
import { sharedStyles } from '../utils/shared-styles.js';

@customElement('select-active-dna')
export class SelectActiveDna extends PlaygroundElement {
	render() {
		const allDnasResult = this.store.allDnas.get();
		const activeDna = this.store.activeDna.get();
		const allDnas =
			allDnasResult.status === 'completed' ? allDnasResult.value : [];
		return html`
			<sl-select
				.value=${activeDna &&
				!!allDnas.find(
					d => encodeHashToBase64(d) === encodeHashToBase64(activeDna),
				)
					? encodeHashToBase64(activeDna)
					: ''}
				@sl-change=${(e: any) => {
					const dna = decodeHashFromBase64(
						(e.target as SlSelect).value as string,
					);
					this.store.activeDna.set(dna);
				}}
				style="flex: 1"
			>
				<span slot="prefix">DNA</span>
				${allDnas.map(
					dna => html`
						<sl-option .value=${encodeHashToBase64(dna)}
							>${encodeHashToBase64(dna)}</sl-option
						>
					`,
				)}
				${activeDna
					? html`
							<div slot="suffix" class="row" style="align-items: center">
								<holo-identicon
									style="height: 32px"
									.hash=${activeDna}
								></holo-identicon>
							</div>
						`
					: html``}
			</sl-select>
		`;
	}

	static get styles() {
		return [
			css`
				:host {
					display: flex;
				}
			`,
			sharedStyles,
		];
	}
}
