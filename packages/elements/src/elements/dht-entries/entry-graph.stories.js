import { html } from 'lit';

export default {
  title: 'Dht Entries',
  component: 'dht-entries',
};

export const Simple = () => {
  return html`
    <holochain-playground-container
      .numberOfSimulatedConductors=${1}
      @ready=${(e) => {
        const conductor = e.detail.conductors[0];

        const cellId = conductor.getAllCells()[0].cellId;
        conductor.callZomeFn({
          cellId,
          zome: 'demo_entries',
          fnName: 'create_entry',
          payload: {
            content: { test: 'bon dia pel matí!' },
            entry_type: 'haha',
          },
          cap: null,
        });

        e.target.activeAgentPubKey = cellId[1];
      }}
    >
      <entry-graph style="flex: 1; min-height: 300px;"></entry-graph>
    </holochain-playground-container>
  `;
};
