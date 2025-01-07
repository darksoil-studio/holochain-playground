export const commonGraphStyles = `
.action {
}

.entry {
  shape: round-rectangle;
}

.Dna {
  background-color: green;
}
.AgentValidationPkg {
  background-color: lime;
}
.Create {
  background-color: blue;
}
.Delete {
  background-color: red;
}
.Update {
  background-color: cyan;
}
.CreateLink {
  background-color: purple;
}
.DeleteLink {
  background-color: #fc0388;
}
.OpenChain {
  background-color: #03fc66;
}
.CloseChain {
  background-color: black;
}

.embedded-reference {
  width: 4;
  target-arrow-shape: triangle;
  curve-style: bezier;
  line-style: dotted;
}
.embedded-reference[label] {
  label: data(label);
  font-size: 7px;
  text-rotation: autorotate;
  text-margin-x: 0px;
  text-margin-y: -5px;
  text-valign: top;
  text-halign: center;
}

.explicit-link {
  width: 2;
  target-arrow-shape: triangle;
  curve-style: bezier;
}

.explicit-link[label] {
  label: data(label);
  font-size: 7px;
  text-rotation: autorotate;
  text-margin-x: 0px;
  text-margin-y: -5px;
  text-valign: top;
  text-halign: center;
}

.not-held {
  height: 1px;
  width: 1px;
}
`;
