import { html } from 'lit';

export default {
  title: 'Entry Contents',
  component: 'entry-contents',
};

export const Simple = () => {
  return html`
    <holochain-playground-container
      .numberOfSimulatedConductors=${1}
      @ready=${(e) => {
        const conductor = e.detail.conductors[0];

        const cellId = conductor.getAllCells()[0].cellId;

        e.target.activeAgentPubKey = cellId[1];
        e.target.activeHash = cellId[1];
      }}
    >
      <entry-contents style="flex: 1; min-height: 300px;"></entry-contents>
    </holochain-playground-container>
  `;
};
