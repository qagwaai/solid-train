'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseArguments, protectedSnapshot, assertForgeStopped } = require('../scripts/copper-vale-persistent-seed');
const { createMongoTestHarness } = require('../test-support/mongodb-test-helpers');
const mongoose = require('mongoose');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const path = require('node:path');
const execute = promisify(execFile);

test('persistent command rejects implicit targets, remote targets, destructive actions and unconfirmed writes', () => {
  for (const args of [
    [], ['--target=mongodb://example.com:27017/solid-train'],
    ['--target=mongodb://localhost:27017/solid-train', '--action=rollback'],
    ['--target=mongodb://localhost:27017/solid-train', '--action=apply'],
    ['--target=mongodb://user:password@localhost:27017/solid-train'],
    ['--target=mongodb://localhost:27017/solid-train?x=y'],
  ]) assert.throws(() => parseArguments(args));
  assert.equal(parseArguments([
    '--target=mongodb://localhost:27017/solid-train', '--action=apply',
    '--confirm-write=exo-gj-9066',
  ]).writes, true);
});

test('protection snapshot excludes only Copper Vale seed scope and detects unrelated changes', async () => {
  const harness = await createMongoTestHarness();
  try {
    const db = mongoose.connection.db;
    await db.collection('players').insertOne({ name: 'protected-test-player' });
    const before = await protectedSnapshot(db);
    await db.collection('cb').insertOne({ id: 'pilot', spatial: { solarSystemId: 'exo-gj-9066' } });
    assert.deepEqual(await protectedSnapshot(db), before);
    await db.collection('players').updateOne({}, { $set: { name: 'changed' } });
    assert.notDeepEqual(await protectedSnapshot(db), before);
  } finally {
    await harness.teardown();
  }
});

test('persistent CLI uses explicit temporary target and honors Forge stopped write guard', async (t) => {
  const harness = await createMongoTestHarness();
  try {
    const target = harness.mongoServer.getUri('persistent-cli-test');
    const script = path.resolve(__dirname, '..', 'scripts', 'copper-vale-persistent-seed.js');
    const run = (args) => execute(process.execPath, [script, `--target=${target}`, ...args]);
    const dryRun = await run(['--action=dry-run']);
    assert.match(dryRun.stdout, /"readiness":"ready"/);
    try {
      await assertForgeStopped();
    } catch (error) {
      assert.match(error.message, /Stop Forge/);
      await assert.rejects(run(['--action=apply', '--confirm-write=exo-gj-9066']), /Stop Forge/);
      t.diagnostic('Forge is listening: verified write refusal; CLI apply/readback roundtrip blocked, not bypassed');
      return;
    }
    const applied = await run(['--action=apply', '--confirm-write=exo-gj-9066']);
    assert.match(applied.stdout, /"status":"complete"/);
    assert.match(applied.stdout, /"protectedDataUnchanged":true/);
    const readback = await run(['--action=readback']);
    assert.match(readback.stdout, /"status":"complete"/);
    const rerun = await run(['--action=apply', '--confirm-write=exo-gj-9066']);
    assert.match(rerun.stdout, /"readiness":"verified"/);
  } finally {
    await harness.teardown();
  }
});
