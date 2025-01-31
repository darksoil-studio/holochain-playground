import { sharedStyles as nativeSharedStyles } from '@tnesh-stack/elements';
import { css, unsafeCSS } from 'lit';

export const sharedStyles = css`
	${unsafeCSS(nativeSharedStyles)}
	:host {
		display: flex;
	}

	.center-content {
		align-items: center;
		justify-content: center;
		display: flex;
	}

	span {
		margin-block-start: 0;
	}

	.title {
		font-size: 20px;
	}

	.placeholder {
		color: rgba(0, 0, 0, 0.6);
	}
	.json-info {
		padding: 4px;
		max-width: 400px;
	}

	.block-title {
		font-size: 20px;
	}

	.horizontal-divider {
		background-color: grey;
		height: 1px;
		opacity: 0.3;
		margin-bottom: 0;
		width: 100%;
	}
	.vertical-divider {
		background-color: grey;
		width: 1px;
		height: 100%;
		opacity: 0.3;
		margin-bottom: 0;
	}
	sl-tab-group {
		display: flex;
	}
	sl-tab-group::part(base) {
		display: flex;
		flex: 1;
	}
	sl-tab-group::part(body) {
		display: flex;
		flex: 1;
	}
	sl-tab-panel::part(base) {
		display: flex;
		flex: 1;
		width: 100%;
		height: 100%;
	}
	sl-tab-panel {
		height: 100%;
		width: 100%;
	}

	json-viewer {
		--background-color: #transparent;
		--color: #333333;
		--string-color: #e03131;
		--number-color: #12b886;
		--boolean-color: #5f3dc4;
		--null-color: #808080;
		--property-color: #228be6;
		--preview-color: #bd5f1b;
		--highlight-color: #ff0000;
		--outline-color: #666968;
		--outline-width: 1px;
		--outline-style: dotted;

		--font-family: Nimbus Mono PS, Courier New, monospace;
		--font-size: 1rem;
		--line-height: 1.2rem;

		--indent-size: 0.5em;
		--indentguide-size: 1px;
		--indentguide-style: solid;
		--indentguide-color: #ccc;
		--indentguide-color-active: #999;
		--indentguide: var(--indentguide-size) var(--indentguide-style)
			var(--indentguide-color);
		--indentguide-active: var(--indentguide-size) var(--indentguide-style)
			var(--indentguide-color-active);
	}
`;
