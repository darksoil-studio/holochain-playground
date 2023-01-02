
import test from 'node:test';
import assert from 'node:assert';

import { runScenario, pause } from '@holochain/tryorama';
import { NewEntryAction, ActionHash, Record, AppBundleSource } from '@holochain/client';
import { decode } from '@msgpack/msgpack';


test('create post', { concurrency: 1 }, async t => {
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
  title: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed nec eros quis enim hendrerit aliquet.',
  content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed nec eros quis enim hendrerit aliquet.'
};

    // Alice creates a post
    const record: Record = await alice.cells[0].callZome({
      zome_name: "posts",
      fn_name: "create_post",
      payload: createInput,
    });
    assert.ok(record);

  });
});


test('create and read post', { concurrency: 1 }, async t => {
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
  title: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed nec eros quis enim hendrerit aliquet.',
  content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed nec eros quis enim hendrerit aliquet.'
};

    // Alice creates a post
    const record: Record = await alice.cells[0].callZome({
      zome_name: "posts",
      fn_name: "create_post",
      payload: createInput,
    });
    assert.ok(record);
    
    // Wait for the created entry to be propagated to the other node.
    await pause(800);

    // Bob gets the created post
    const createReadOutput: Record = await bob.cells[0].callZome({
      zome_name: "posts",
      fn_name: "get_post",
      payload: record.signed_action.hashed.hash,
    });
    assert.deepEqual(createInput, decode((createReadOutput.entry as any).Present.entry) as any);
  });
});

test('create and update post', { concurrency: 1 }, async t => {
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
  title: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed nec eros quis enim hendrerit aliquet.',
  content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed nec eros quis enim hendrerit aliquet.'
};

    // Alice creates a post
    const record: Record = await alice.cells[0].callZome({
      zome_name: "posts",
      fn_name: "create_post",
      payload: createInput,
    });
    assert.ok(record);
        
    const originalActionHash = record.signed_action.hashed.hash;
 
    // Alice updates the post
    let contentUpdate: any = {
  title: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed nec eros quis enim hendrerit aliquet.',
  content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed nec eros quis enim hendrerit aliquet.'
};
    let updateInput = { 
      original_post_hash: originalActionHash,
      previous_post_hash: originalActionHash,
      updated_post: contentUpdate,
    };

    let updatedRecord: Record = await alice.cells[0].callZome({
      zome_name: "posts",
      fn_name: "update_post",
      payload: updateInput,
    });
    assert.ok(updatedRecord);


    // Wait for the updated entry to be propagated to the other node.
    await pause(800);
        
    // Bob gets the updated post
    const readUpdatedOutput0: Record = await bob.cells[0].callZome({
      zome_name: "posts",
      fn_name: "get_post",
      payload: updatedRecord.signed_action.hashed.hash,
    });
    assert.deepEqual(contentUpdate, decode((readUpdatedOutput0.entry as any).Present.entry) as any);


    // Alice updates the post again
    contentUpdate = {
  title: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed nec eros quis enim hendrerit aliquet.',
  content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed nec eros quis enim hendrerit aliquet.'
};
    updateInput = { 
      original_post_hash: originalActionHash,
      previous_post_hash: updatedRecord.signed_action.hashed.hash,
      updated_post: contentUpdate,
    };

    updatedRecord = await alice.cells[0].callZome({
      zome_name: "posts",
      fn_name: "update_post",
      payload: updateInput,
    });
    assert.ok(updatedRecord);


    // Wait for the updated entry to be propagated to the other node.
    await pause(800);
        
    // Bob gets the updated post
    const readUpdatedOutput1: Record = await bob.cells[0].callZome({
      zome_name: "posts",
      fn_name: "get_post",
      payload: updatedRecord.signed_action.hashed.hash,
    });
    assert.deepEqual(contentUpdate, decode((readUpdatedOutput1.entry as any).Present.entry) as any);

  });
});

test('create and delete post', { concurrency: 1 }, async t => {
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
  title: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed nec eros quis enim hendrerit aliquet.',
  content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed nec eros quis enim hendrerit aliquet.'
};

    // Alice creates a post
    const record: Record = await alice.cells[0].callZome({
      zome_name: "posts",
      fn_name: "create_post",
      payload: createInput,
    });
    assert.ok(record);
        
    // Alice deletes the post
    const deleteActionHash = await alice.cells[0].callZome({
      zome_name: "posts",
      fn_name: "delete_post",
      payload: record.signed_action.hashed.hash,
    });
    assert.ok(deleteActionHash);


    // Wait for the entry deletion to be propagated to the other node.
    await pause(800);
        
    // Bob tries to get the deleted post
    const readDeletedOutput = await bob.cells[0].callZome({
      zome_name: "posts",
      fn_name: "get_post",
      payload: record.signed_action.hashed.hash,
    });
    assert.equal(readDeletedOutput, undefined);

  });
});
