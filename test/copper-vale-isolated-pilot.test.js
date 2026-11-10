'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { launchIsolatedPilot, requireOptIn, childEnvironment } = require('../scripts/copper-vale-isolated-pilot');

test('pilot requires explicit isolated opt-in and rejects endpoint overrides', () => {
  for (const args of [[], ['--isolated', '--port=3000'], ['--uri=mongodb://localhost/solid-train']]) {
    assert.throws(() => requireOptIn(args), /Explicit opt-in/);
  }
  assert.doesNotThrow(() => requireOptIn(['--isolated']));
  assert.ok(Object.keys(childEnvironment()).every((key) =>
    /^(path|systemroot|windir|temp|tmp|home|userprofile|localappdata)$/i.test(key)));
});

test('isolated pilot verifies durable P4 data, serves real transport, and cleans up', { timeout: 180000 }, async () => {
  const pilot = await launchIsolatedPilot(['--isolated']);
  try {
    assert.equal(pilot.systemId, 'exo-gj-9066');
    assert.equal(pilot.bodyCount, 57);
    assert.equal(pilot.stationId, 'copper-vale-asteroid-exchange');
    assert.match(pilot.p4OutputSha256, /^[a-f0-9]{64}$/);
    assert.match(pilot.baseUrl, /^http:\/\/127\.0\.0\.1:\d+$/);
    assert.notEqual(pilot.port, 3000);
    const dryRun = await pilot.runSeedLifecycle('dry-run');
    assert.equal(dryRun.writes, false);
    assert.equal(dryRun.expectedBodyCount, 57);
    const readback = await pilot.runSeedLifecycle('readback');
    assert.equal(readback.status, 'complete');
    assert.equal(readback.verifiedBodyIds.length, 57);
    const health = await fetch(`${pilot.baseUrl}/health`);
    assert.equal((await health.json()).status, 'ok');
  } finally {
    await pilot.stop();
  }
  await assert.rejects(fetch(`${pilot.baseUrl}/health`, { signal: AbortSignal.timeout(2000) }));
  await pilot.stop();
});
