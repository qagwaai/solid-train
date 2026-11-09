'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const mongoose = require('mongoose');
const { createMongoTestHarness } = require('../test-support/mongodb-test-helpers');
const { Market, GameStateDocument } = require('../src/db/models');
const { runCopperValeSeedLifecycle } = require('../src/model/copper-vale-seed-lifecycle');
const { JOURNAL_KEY, buildCopperValeDensityPlan, runCopperValeDensityLifecycle } = require('../src/model/copper-vale-market-density-lifecycle');
const { assertForgeStopped, protectedSnapshot } = require('../scripts/copper-vale-persistent-seed');
const execute = promisify(execFile);
const script = path.resolve(__dirname, '..', 'scripts', 'copper-vale-persistent-density.js');

test('density CLI rejects targets/actions/write confirmation before connecting', async () => {
  for (const args of [
    [], ['--target=mongodb://example.invalid:27017/solid-train'],
    ['--target=mongodb://localhost:27017/solid-train', '--action=apply'],
    ['--target=mongodb://localhost:27017/solid-train', '--action=drop'],
    ['--target=mongodb://localhost:27017/solid-train', '--action=dry-run', '--confirm-write=exo-gj-9066'],
  ]) {
    await assert.rejects(execute(process.execPath, [script, ...args]));
  }
});

test('density CLI temporary Mongo preflight/readback and Forge-stop guard; roundtrip only when stopped', async (t) => {
  const harness = await createMongoTestHarness();
  try {
    const target = harness.mongoServer.getUri(mongoose.connection.db.databaseName);
    const run = (action, confirmed = false) => execute(process.execPath, [
      script, `--target=${target}`, `--action=${action}`, ...(confirmed ? ['--confirm-write=exo-gj-9066'] : []),
    ]);
    await runCopperValeSeedLifecycle(harness.databaseService, { action: 'apply' });
    assert.match((await run('dry-run')).stdout, /"readiness":"ready"/);
    const plan = buildCopperValeDensityPlan();
    const snapshotOptions = { addedMarketIds: plan.addedMarketIds, journalKey: JOURNAL_KEY };
    const before = await protectedSnapshot(mongoose.connection.db, snapshotOptions);
    let stopped = true;
    try { await assertForgeStopped(); } catch (error) {
      assert.match(error.message, /Stop Forge/);
      stopped = false;
    }
    if (stopped) {
      assert.match((await run('apply', true)).stdout, /"status":"complete"/);
      assert.match((await run('apply', true)).stdout, /"readiness":"verified"/);
    } else {
      await assert.rejects(run('apply', true), /Stop Forge/);
      assert.equal(await GameStateDocument.countDocuments({ key: JOURNAL_KEY }), 0);
      assert.equal(await Market.countDocuments({}), 1);
      // Exercise actual additive persistence in disposable Mongo, not a CLI
      // guard bypass. The production command still refused to connect/write.
      await runCopperValeDensityLifecycle(harness.databaseService, { action: 'apply' });
      t.diagnostic('Forge is listening: CLI write roundtrip blocked; refusal validated. Additive lifecycle and CLI readback validated on temporary Mongo.');
    }
    const readback = await run('readback');
    assert.match(readback.stdout, /"status":"complete"/);
    assert.match(readback.stdout, /"protectedDataUnchanged":true/);
    assert.match((await run('dry-run')).stdout, /"readiness":"verified"/);
    assert.deepEqual(await protectedSnapshot(mongoose.connection.db, snapshotOptions), before);
  } finally {
    await harness.teardown();
  }
});

test('density snapshot protects whole old station, ALL bodies, P6 and raw BSON Dates, excluding only additions/journal', async () => {
  const harness = await createMongoTestHarness();
  try {
    await runCopperValeSeedLifecycle(harness.databaseService, { action: 'apply' });
    const db = mongoose.connection.db;
    const plan = buildCopperValeDensityPlan();
    const options = { addedMarketIds: plan.addedMarketIds, journalKey: JOURNAL_KEY };
    await db.collection('unknown-gameplay').insertOne({ recordedAt: new Date(1000), nested: { untouched: true } });
    const before = await protectedSnapshot(db, options);
    await runCopperValeDensityLifecycle(harness.databaseService, { action: 'apply' });
    assert.deepEqual(await protectedSnapshot(db, options), before);
    await db.collection('unknown-gameplay').updateOne({}, { $set: { recordedAt: new Date(2000) } });
    assert.notDeepEqual(await protectedSnapshot(db, options), before);
  } finally {
    await harness.teardown();
  }
});
