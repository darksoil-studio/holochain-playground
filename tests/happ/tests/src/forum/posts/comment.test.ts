
import test from 'node:test';
import assert from 'node:assert';

import { runScenario, pause } from '@holochain/tryorama';
import { NewEntryAction, ActionHash, Record, AppBundleSource } from '@holochain/client';
import { decode } from '@msgpack/msgpack';


test('create comment', { concurrency: 1 }, async t => {
  await runScenario(async scenario => {

    // Construct proper paths for your app.
    // This assumes app bundle created by the `hc app pack` command.
    const testAppPath = process.cwd() + '/' + "../workdir/forum.happ";

    // Set up the app to be installed 
    const appSource = { appBundleSource: { path: testAppPath } };

    // Add 2 players with the test app to the Scenario. The returned players
    // can be destructured.
    const [alice, bob] = await scenario.addPlayersWithApps([appSource, appSource]);

    // Shortcut peer discovery through gossip and register all agents in every
    // conductor of the scenario.
    await scenario.shareAllAgents();


    const createInput = {
  comment: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed nec eros quis enim hendrerit aliquet.',
  post_hash: Buffer.from(new Uint8Array([132, 41, 36, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]))
};

    // Alice creates a comment
    const record: Record = await alice.cells[0].callZome({
      zome_name: "posts",
      fn_name: "create_comment",
      payload: createInput,
    });
    assert.ok(record);

  });
});


test('create and read comment', { concurrency: 1 }, async t => {
  await runScenario(async scenario => {

    // Construct proper paths for your app.
    // This assumes app bundle created by the `hc app pack` command.
    const testAppPath = process.cwd() + '/' + "../workdir/forum.happ";

    // Set up the app to be installed 
    const appSource = { appBundleSource: { path: testAppPath } };

    // Add 2 players with the test app to the Scenario. The returned players
    // can be destructured.
    const [alice, bob] = await scenario.addPlayersWithApps([appSource, appSource]);

    // Shortcut peer discovery through gossip and register all agents in every
    // conductor of the scenario.
    await scenario.shareAllAgents();

    const createInput: any = {
  comment: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed nec eros quis enim hendrerit aliquet.',
  post_hash: Buffer.from(new Uint8Array([132, 41, 36, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]))
};

    // Alice creates a comment
    const record: Record = await alice.cells[0].callZome({
      zome_name: "posts",
      fn_name: "create_comment",
      payload: createInput,
    });
    assert.ok(record);
    
    // Wait for the created entry to be propagated to the other node.
    await pause(800);

    // Bob gets the created comment
    const createReadOutput: Record = await bob.cells[0].callZome({
      zome_name: "posts",
      fn_name: "get_comment",
      payload: record.signed_action.hashed.hash,
    });
    assert.deepEqual(createInput, decode((createReadOutput.entry as any).Present.entry) as any);
  });
});

test('create and delete comment', { concurrency: 1 }, async t => {
  await runScenario(async scenario => {

    // Construct proper paths for your app.
    // This assumes app bundle created by the `hc app pack` command.
    const testAppPath = process.cwd() + '/' + "../workdir/forum.happ";

    // Set up the app to be installed 
    const appSource = { appBundleSource: { path: testAppPath } };

    // Add 2 players with the test app to the Scenario. The returned players
    // can be destructured.
    const [alice, bob] = await scenario.addPlayersWithApps([appSource, appSource]);

    // Shortcut peer discovery through gossip and register all agents in every
    // conductor of the scenario.
    await scenario.shareAllAgents();

    const createInput = {
  comment: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed nec eros quis enim hendrerit aliquet.',
  post_hash: Buffer.from(new Uint8Array([132, 41, 36, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]))
};

    // Alice creates a comment
    const record: Record = await alice.cells[0].callZome({
      zome_name: "posts",
      fn_name: "create_comment",
      payload: createInput,
    });
    assert.ok(record);
        
    // Alice deletes the comment
    const deleteActionHash = await alice.cells[0].callZome({
      zome_name: "posts",
      fn_name: "delete_comment",
      payload: record.signed_action.hashed.hash,
    });
    assert.ok(deleteActionHash);


    // Wait for the entry deletion to be propagated to the other node.
    await pause(800);
        
    // Bob tries to get the deleted comment
    const readDeletedOutput = await bob.cells[0].callZome({
      zome_name: "posts",
      fn_name: "get_comment",
      payload: record.signed_action.hashed.hash,
    });
    assert.equal(readDeletedOutput, undefined);

  });
});
