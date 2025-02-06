import '@shoelace-style/shoelace/dist/components/button/button.js';
import '@shoelace-style/shoelace/dist/components/card/card.js';
import '@shoelace-style/shoelace/dist/components/spinner/spinner.js';
import { TemplateResult, css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';

import { PlaygroundElement } from '../../base/playground-element.js';
import { SimulatedPlaygroundStore } from '../../store/simulated-playground-store.js';
import { sharedStyles } from '../utils/shared-styles.js';

export interface Step {
	title: (context: PlaygroundElement) => string;
	run: (context: PlaygroundElement) => Promise<void>;
}

@customElement('run-steps')
export class RunSteps extends PlaygroundElement<SimulatedPlaygroundStore> {
	@property({ type: Array })
	steps!: Array<Step>;

	@state()
	_runningStepIndex: number | undefined = undefined;

	@state()
	_running = false;

	async runSteps() {
		this._running = true;

		await this.awaitNetworkConsistency();

		for (let i = 0; i < this.steps.length; i++) {
			this._runningStepIndex = i;
			await this.steps[i].run(this);
			await this.awaitNetworkConsistency();
		}
		this._running = false;
	}

	async awaitNetworkConsistency() {
		return new Promise(resolve => {
			const cellsStores = this.store.cellsForActiveDna.get();
			if (cellsStores.status !== 'completed') {
				resolve(null);
				return;
			}

			const cells = cellsStores.value.values().map(c => c.cell);

			const checkConsistency = (consistencyCheckCount = 0) => {
				for (const cell of cells) {
					for (const triggers of Object.values(cell._triggers)) {
						if (triggers.running || triggers.triggered) return;
					}
				}
				if (consistencyCheckCount === 3) resolve(null);
				else setTimeout(() => checkConsistency(consistencyCheckCount + 1), 200);
			};

			for (const cell of cells) {
				cell.workflowExecutor.success(async () => checkConsistency());
				cell.workflowExecutor.error(async () => checkConsistency());
			}
		});
	}

	renderContent(): TemplateResult {
		const cells = this.store.cellsForActiveDna.get();
		switch (cells.status) {
			case 'pending':
				return html`<div class="fill center-content">
					<mwc-circular-progress></mwc-circular-progress>
				</div>`;
			case 'error':
				return html`<display-error
					.error=${cells.error}
					headline="Error loading the cells"
				></display-error>`;
			case 'completed':
				if (!this.steps)
					return html`<div class="center-content" style="flex: 1;">
						<span class="placeholder">There are no steps to run.</span>
					</div>`;
				return html`
					<div class="row">
						${this.steps.map(
							(step, index) =>
								html`<span
									class=${classMap({
										future: this._runningStepIndex! < index,
									})}
									.activated=${this._running &&
									this._runningStepIndex === index}
									>${index + 1}. ${step.title(this)}</span
								>`,
						)}
					</div>
				`;
		}
	}

	render(): TemplateResult {
		return html`
			<div class="column" style="margin: 16px; flex: 1;">
				<div class="row">
					<span class="block-title" style="flex: 1;">Run Steps</span>
					<sl-button
						variant="primary"
						.disabled=${this._running ||
						this.store.cellsForActiveDna.get().status !== 'completed'}
						@click=${() => this.runSteps()}
					>
						${this._running ? 'RUNNING...' : 'RUN'}
					</sl-button>
				</div>
				${this.renderContent()}
			</div>
		`;
	}

	static get styles() {
		return [
			css`
				:host {
					display: flex;
					flex: 1;
				}
				.future {
					opacity: 0.7;
				}
			`,
			sharedStyles,
		];
	}
}
