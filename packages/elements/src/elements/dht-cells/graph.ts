import { commonGraphStyles } from '../utils/common-graph-styles.js';

export const layoutConfig = {
	startAngle: (4 / 2) * Math.PI,
	ready: (e: any) => {
		e.cy.resize();
	},
};

export const graphStyles = `
  ${commonGraphStyles}
  node {
    background-color: lightblue;
    border-color: black;
    border-width: 2px;
    label: data(label);
    font-size: 20px;
    width: 50px;
    height: 50px;
  }
  
  .selected {
    border-width: 4px;
    border-color: black;
    border-style: solid;
  }

  .highlighted {
    background-color: yellow;
  }

  edge {
    width: 1;
  }

  .network-request {
    target-arrow-shape: triangle;
    label: data(label);
    width: 10px;
    height: 10px;
    background-color: grey;
    border-width: 0px;
  }

  .neighbor-edge {
    line-style: solid;
  }

  .far-neighbor-edge {
    line-style: dashed;
  }

  .not-held {
    height: 10px;
    width: 10px;
    background-color: grey;
    opacity: 0.3;
  }
`;

export const cytoscapeOptions = {
	boxSelectionEnabled: false,
	autoungrabify: true,
	userPanningEnabled: false,
	userZoomingEnabled: false,
	style: graphStyles,
};
