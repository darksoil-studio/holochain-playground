import { assert, test } from "vitest";

import { runScenario, dhtSync, CallableCell } from '@holochain/tryorama';
import { NewEntryAction, ActionHash, Record, AppBundleSource, fakeDnaHash, fakeActionHash, fakeAgentPubKey, fakeEntryHash } from '@holochain/client';
import { decode } from '@msgpack/msgpack';

import { createComment, sampleComment } from './common.js';

test('create Comment', async () => {
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

    // Alice creates a Comment
    const record: Record = await createComment(alice.cells[0]);
    assert.ok(record);
  });
});

test('create and read Comment', async () => {
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

    const sample = await sampleComment(alice.cells[0]);

    // Alice creates a Comment
    const record: Record = await createComment(alice.cells[0], sample);
    assert.ok(record);

    // Wait for the created entry to be propagated to the other node.
    await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

    // Bob gets the created Comment
    const createReadOutput: Record = await bob.cells[0].callZome({
      zome_name: "posts",
      fn_name: "get_comment",
      payload: record.signed_action.hashed.hash,
    });
    assert.deepEqual(sample, decode((createReadOutput.entry as any).Present.entry) as any);

    // Bob gets the Posts for the new Comment
    let linksToPosts: Link[] = await bob.cells[0].callZome({
      zome_name: "posts",
      fn_name: "get_comments_for_post",
      payload: sample.post_hash
    });
    assert.equal(linksToPosts.length, 1);
    assert.deepEqual(linksToPosts[0].target, record.signed_action.hashed.hash);
  });
});


test('create and delete Comment', async () => {
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

    const sample = await sampleComment(alice.cells[0]);

    // Alice creates a Comment
    const record: Record = await createComment(alice.cells[0], sample);
    assert.ok(record);

    await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

    // Bob gets the Posts for the new Comment
    let linksToPosts: Link[] = await bob.cells[0].callZome({
      zome_name: "posts",
      fn_name: "get_comments_for_post",
      payload: sample.post_hash
    });
    assert.equal(linksToPosts.length, 1);
    assert.deepEqual(linksToPosts[0].target, record.signed_action.hashed.hash);

    // Alice deletes the Comment
    const deleteActionHash = await alice.cells[0].callZome({
      zome_name: "posts",
      fn_name: "delete_comment",
      payload: record.signed_action.hashed.hash,
    });
    assert.ok(deleteActionHash);

    // Wait for the entry deletion to be propagated to the other node.
    await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

    // Bob gets the oldest delete for the Comment
    const oldestDeleteForComment = await bob.cells[0].callZome({
      zome_name: "posts",
      fn_name: "get_oldest_delete_for_comment",
      payload: record.signed_action.hashed.hash,
    });
    assert.ok(oldestDeleteForComment);
        
    // Bob gets the deletions for Comment
    const deletesForComment = await bob.cells[0].callZome({
      zome_name: "posts",
      fn_name: "get_all_deletes_for_comment",
      payload: record.signed_action.hashed.hash,
    });
    assert.equal(deletesForComment.length, 1);

    // Bob gets the Posts for the Comment again
    linksToPosts = await bob.cells[0].callZome({
      zome_name: "posts",
      fn_name: "get_comments_for_post",
      payload: sample.post_hash
    });
    assert.equal(linksToPosts.length, 0);

    // Bob gets the deleted Posts for the Comment 
    const deletedLinksToPosts = await bob.cells[0].callZome({
      zome_name: "posts",
      fn_name: "get_deleted_comments_for_post",
      payload: sample.post_hash
    });
    assert.equal(deletedLinksToPosts.length, 1);

  });
});
