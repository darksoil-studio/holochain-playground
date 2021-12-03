import { html } from 'lit';

export default {
  title: 'Source Chain',
  component: 'source-chain',
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
      <source-chain
        style="flex: 1; min-height: 400px;"
      ></source-chain>
    </holochain-playground-container>
  `;
};
