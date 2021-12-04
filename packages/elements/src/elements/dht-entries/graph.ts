import { commonGraphStyles } from '../utils/common-graph-styles';

export const colaConfig = {
  animate: true,
  /*   flow: {
    axis: 'x',
    minSeparation: 40,
  },
 */ ready: (e) => {
    e.cy.fit();
    e.cy.center();
  },
  edgeLength: (edge) => {
    return edge.data().headerReference ? 50 : undefined;
  },
};

export const graphStyles = `
${commonGraphStyles}

node {
  font-size: 10px;
  width: 16px;
  label: data(label);
  height: 16px;
}


.not-held {
  height: 10px;
  width: 10px;
  background-color: white;
}

.entry {
  background-color: grey;
}

.header {
  opacity: 0.6;
}

node > node {
  height: 1px;
}

.selected {
  border-width: 1px;
  border-color: black;
  border-style: solid;
}

.update-edge {
  width: 1;
  line-style: dashed;
}
.updated {
  opacity: 0.5;
}
.deleted {
  opacity: 0.3 !important;
}

`;

export const cytoscapeConfig = {
  boxSelectionEnabled: false,
  autoungrabify: false,
  userZoomingEnabled: true,
  userPanningEnabled: true,
  style: graphStyles,
};
