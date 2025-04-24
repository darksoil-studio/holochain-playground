import { assert, test } from "vitest";

import { runScenario, dhtSync, CallableCell } from '@holochain/tryorama';
import { NewEntryAction, ActionHash, Record, AppBundleSource, fakeDnaHash, fakeActionHash, fakeAgentPubKey, fakeEntryHash } from '@holochain/client';
import { decode } from '@msgpack/msgpack';

import { createPost, samplePost } from './common.js';

test('create Post', async () => {
  await runScenario(async scenario => {
    // Construct proper paths for your app.
    // This assumes app bundle created by the `hc app pack` command.
    const testAppPath = process.cwd() + '/../workdir/forum.happ';

    // Set up the app to be installed 
    const appSource = { appBundleSource: { path: testAppPath } };

    // Add 2 players with the test app to the Scenario. The returned players
    // can be destructured.
    const [alice, bob] = await scenario.addPlayersWithApps([appSource, appSource]);

    // Shortcut peer discovery through gossip and register all agents in every
    // conductor of the scenario.
    await scenario.shareAllAgents();

    // Alice creates a Post
    const record: Record = await createPost(alice.cells[0]);
    assert.ok(record);
  });
});

test('create and read Post', async () => {
  await runScenario(async scenario => {
    // Construct proper paths for your app.
    // This assumes app bundle created by the `hc app pack` command.
    const testAppPath = process.cwd() + '/../workdir/forum.happ';

    // Set up the app to be installed 
    const appSource = { appBundleSource: { path: testAppPath } };

    // Add 2 players with the test app to the Scenario. The returned players
    // can be destructured.
    const [alice, bob] = await scenario.addPlayersWithApps([appSource, appSource]);

    // Shortcut peer discovery through gossip and register all agents in every
    // conductor of the scenario.
    await scenario.shareAllAgents();

    const sample = await samplePost(alice.cells[0]);

    // Alice creates a Post
    const record: Record = await createPost(alice.cells[0], sample);
    assert.ok(record);

    // Wait for the created entry to be propagated to the other node.
    await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

    // Bob gets the created Post
    const createReadOutput: Record = await bob.cells[0].callZome({
      zome_name: "posts",
      fn_name: "get_original_post",
      payload: record.signed_action.hashed.hash,
    });
    assert.deepEqual(sample, decode((createReadOutput.entry as any).Present.entry) as any);

  });
});

test('create and update Post', async () => {
  await runScenario(async scenario => {
    // Construct proper paths for your app.
    // This assumes app bundle created by the `hc app pack` command.
    const testAppPath = process.cwd() + '/../workdir/forum.happ';

    // Set up the app to be installed 
    const appSource = { appBundleSource: { path: testAppPath } };

    // Add 2 players with the test app to the Scenario. The returned players
    // can be destructured.
    const [alice, bob] = await scenario.addPlayersWithApps([appSource, appSource]);

    // Shortcut peer discovery through gossip and register all agents in every
    // conductor of the scenario.
    await scenario.shareAllAgents();

    // Alice creates a Post
    const record: Record = await createPost(alice.cells[0]);
    assert.ok(record);
        
    const originalActionHash = record.signed_action.hashed.hash;
 
    // Alice updates the Post
    let contentUpdate: any = await samplePost(alice.cells[0]);
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
    await dhtSync([alice, bob], alice.cells[0].cell_id[0]);
        
    // Bob gets the updated Post
    const readUpdatedOutput0: Record = await bob.cells[0].callZome({
      zome_name: "posts",
      fn_name: "get_latest_post",
      payload: updatedRecord.signed_action.hashed.hash,
    });
    assert.deepEqual(contentUpdate, decode((readUpdatedOutput0.entry as any).Present.entry) as any);

    // Alice updates the Post again
    contentUpdate = await samplePost(alice.cells[0]);
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
    await dhtSync([alice, bob], alice.cells[0].cell_id[0]);
        
    // Bob gets the updated Post
    const readUpdatedOutput1: Record = await bob.cells[0].callZome({
      zome_name: "posts",
      fn_name: "get_latest_post",
      payload: updatedRecord.signed_action.hashed.hash,
    });
    assert.deepEqual(contentUpdate, decode((readUpdatedOutput1.entry as any).Present.entry) as any);

    // Bob gets all the revisions for Post
    const revisions: Record[] = await bob.cells[0].callZome({
      zome_name: "posts",
      fn_name: "get_all_revisions_for_post",
      payload: originalActionHash,
    });
    assert.equal(revisions.length, 3);
    assert.deepEqual(contentUpdate, decode((revisions[2].entry as any).Present.entry) as any);
  });
});

test('create and delete Post', async () => {
  await runScenario(async scenario => {
    // Construct proper paths for your app.
    // This assumes app bundle created by the `hc app pack` command.
    const testAppPath = process.cwd() + '/../workdir/forum.happ';

    // Set up the app to be installed 
    const appSource = { appBundleSource: { path: testAppPath } };

    // Add 2 players with the test app to the Scenario. The returned players
    // can be destructured.
    const [alice, bob] = await scenario.addPlayersWithApps([appSource, appSource]);

    // Shortcut peer discovery through gossip and register all agents in every
    // conductor of the scenario.
    await scenario.shareAllAgents();

    const sample = await samplePost(alice.cells[0]);

    // Alice creates a Post
    const record: Record = await createPost(alice.cells[0], sample);
    assert.ok(record);

    await dhtSync([alice, bob], alice.cells[0].cell_id[0]);


    // Alice deletes the Post
    const deleteActionHash = await alice.cells[0].callZome({
      zome_name: "posts",
      fn_name: "delete_post",
      payload: record.signed_action.hashed.hash,
    });
    assert.ok(deleteActionHash);

    // Wait for the entry deletion to be propagated to the other node.
    await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

    // Bob gets the oldest delete for the Post
    const oldestDeleteForPost = await bob.cells[0].callZome({
      zome_name: "posts",
      fn_name: "get_oldest_delete_for_post",
      payload: record.signed_action.hashed.hash,
    });
    assert.ok(oldestDeleteForPost);
        
    // Bob gets the deletions for Post
    const deletesForPost = await bob.cells[0].callZome({
      zome_name: "posts",
      fn_name: "get_all_deletes_for_post",
      payload: record.signed_action.hashed.hash,
    });
    assert.equal(deletesForPost.length, 1);


  });
});
