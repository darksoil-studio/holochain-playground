import { assert, test } from "vitest";

import { runScenario, dhtSync, CallableCell } from '@holochain/tryorama';
import { NewEntryAction, ActionHash, Record, AppBundleSource,  fakeActionHash, fakeAgentPubKey, fakeEntryHash } from '@holochain/client';
import { decode } from '@msgpack/msgpack';

import { createPost } from './common.js';

test('create a Post and get all posts', async () => {
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

    // Bob gets all posts
    let collectionOutput: Link[] = await bob.cells[0].callZome({
      zome_name: "posts",
      fn_name: "get_all_posts",
      payload: null
    });
    assert.equal(collectionOutput.length, 0);

    // Alice creates a Post
    const createRecord: Record = await createPost(alice.cells[0]);
    assert.ok(createRecord);
    
    await dhtSync([alice, bob], alice.cells[0].cell_id[0]);
    
    // Bob gets all posts again
    collectionOutput = await bob.cells[0].callZome({
      zome_name: "posts",
      fn_name: "get_all_posts",
      payload: null
    });
    assert.equal(collectionOutput.length, 1);
    assert.deepEqual(createRecord.signed_action.hashed.hash, collectionOutput[0].target);

    // Alice deletes the Post
    await alice.cells[0].callZome({
      zome_name: "posts",
      fn_name: "delete_post",
      payload: createRecord.signed_action.hashed.hash
    });

    await dhtSync([alice, bob], alice.cells[0].cell_id[0]);

    // Bob gets all posts again
    collectionOutput = await bob.cells[0].callZome({
      zome_name: "posts",
      fn_name: "get_all_posts",
      payload: null
    });
    assert.equal(collectionOutput.length, 0);
  });
});

