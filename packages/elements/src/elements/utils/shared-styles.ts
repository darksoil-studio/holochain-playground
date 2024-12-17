import { sharedStyles as nativeSharedStyles } from '@tnesh-stack/elements';
import { css, unsafeCSS } from 'lit';

export const sharedStyles = css`
	${unsafeCSS(nativeSharedStyles)}
	:host {
		display: flex;
		flex: 1;
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

	.block-card {
		flex: 1;
		display: flex;
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
`;
