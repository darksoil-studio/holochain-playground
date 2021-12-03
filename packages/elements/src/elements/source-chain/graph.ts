import { commonGraphStyles } from "../utils/common-graph-styles";

export const graphStyles = `
${commonGraphStyles}
node {
  width: 30px;
  height: 30px;
  font-size: 10px;
  label: data(label);
  text-halign: right;
  text-valign: center;
  text-margin-x: 4px;
}

.header {
  text-margin-x: -5px;
  text-halign: left;
}

.selected {
  border-width: 4px;
  border-color: black;
  border-style: solid;
}

`;
