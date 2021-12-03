import { css } from 'lit';

export const sharedStyles = css`
  :host {
    display: flex;
    flex: 1;
  }

  .row {
    display: flex;
    flex-direction: row;
  }
  .column {
    display: flex;
    flex-direction: column;
  }
  .fill {
    height: 100%;
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

  .flex-scrollable-parent {
    position: relative;
    display: flex;
    flex: 1;
  }

  .flex-scrollable-container {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
  }

  .flex-scrollable-x {
    max-width: 100%;
    overflow-x: auto;
  }
  .flex-scrollable-y {
    max-height: 100%;
    overflow-y: auto;
  }

  .json-info {
    padding: 4px;
    max-width: 400px;
  }

  .block-card {
    width: 100%;
    height: 100%;
    position: relative;
    flex: 1;
  }

  .block-title {
    font-size: 20px;
  }

  .block-help {
    position: absolute;
    right: 8px;
    top: 8px;
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
`;
