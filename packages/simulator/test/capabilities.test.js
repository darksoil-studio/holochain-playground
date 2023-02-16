import { createConductors } from '../dist';
import { assert, describe, expect, it } from 'vitest';
import { sleep } from './utils';

const dna = {
  zomes: [
    {
      name: 'demo_entries',
      entry_defs: [],
      validation_functions: {},
      zome_functions: {
        create_cap: {
          call: ({ create_cap_grant }) => agentPubKeyToGrant => {
            return create_cap_grant({
              tag: '',
              access: {
                Assigned: {
                  secret: '',
                  assignees: [agentPubKeyToGrant],
                },
              },
              functions: [{ zome: 'demo_entries', fn_name: 'sample_fn' }],
            });
          },
          arguments: [],
        },
        sample_fn: {
          call: () => () => {
            return 'Hello';
          },
          arguments: [],
        },
        revoke_cap: {
          call: ({ delete_cap_grant }) => cap_grant_to_revoke => {
            return delete_cap_grant(cap_grant_to_revoke);
          },
          arguments: [],
        },
        call_remote: {
          call: ({ call_remote }) => agentToCall => {
            return call_remote({
              agent: agentToCall,
              zome: 'demo_entries',
              fn_name: 'sample_fn',
              cap: null,
              payload: null,
            });
          },
          arguments: [],
        },
      },
    },
  ],
};

describe('Capabilities', () => {
  it('grant, call_remote, and revoke', async () => {
    const conductors = await createConductors(2, [], {
      name: 'simulated-app',
      description: '',
      roles: {
        default: {
          dna,
          deferred: false,
        },
      },
    });

    await sleep(100);

    const aliceCell = conductors[0].getAllCells()[0];
    const bobCell = conductors[1].getAllCells()[0];

    const aliceAddress = aliceCell.cellId[1];
    const bobAddress = bobCell.cellId[1];

    let result;
    let failed = false;

    try {
      result = await conductors[1].callZomeFn({
        cellId: bobCell.cellId,
        cap: null,
        fnName: 'call_remote',
        payload: aliceAddress,
        zome: 'demo_entries',
      });
      expect(false).to.be.ok;
    } catch (e) {
      failed = true;
    }
    expect(failed).to.be.ok;

    const capGrantAddress = await conductors[0].callZomeFn({
      cellId: aliceCell.cellId,
      cap: null,
      fnName: 'create_cap',
      payload: bobAddress,
      zome: 'demo_entries',
    });

    expect(capGrantAddress).to.be.ok;

    result = await conductors[1].callZomeFn({
      cellId: bobCell.cellId,
      cap: null,
      fnName: 'call_remote',
      payload: aliceAddress,
      zome: 'demo_entries',
    });
    expect(result).to.equal('Hello');

    result = await conductors[0].callZomeFn({
      cellId: aliceCell.cellId,
      cap: null,
      fnName: 'revoke_cap',
      payload: capGrantAddress,
      zome: 'demo_entries',
    });

    expect(result).to.be.ok;

    failed = false;
    try {
      result = await conductors[1].callZomeFn({
        cellId: bobCell.cellId,
        cap: null,
        fnName: 'call_remote',
        payload: aliceAddress,
        zome: 'demo_entries',
      });
      expect(false).to.be.ok;
    } catch (e) {
      failed = true;
    }
    expect(failed).to.be.ok;
  });
});
