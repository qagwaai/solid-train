'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createMongoTestHarness } = require('../test-support/mongodb-test-helpers');
const { seedPlayer } = require('../test-support/message-handler-test-helpers');
const { DatabaseService } = require('../src/db/service');
const { CelestialBody, Market, GameStateDocument } = require('../src/db/models');
const { MessageHandlerContext } = require('../src/handlers/message-handler-context');
const { SolarSystemGetMessageHandler } = require('../src/handlers/solar-system-get-message-handler');
const { buildCopperValeSeedPlan, runCopperValeSeedLifecycle } = require('../src/model/copper-vale-seed-lifecycle');
const { runCopperValeDensityLifecycle } = require('../src/model/copper-vale-market-density-lifecycle');
const { getSolarSystemCelestialSeedVersion } = require('../src/model/solar-system-celestial-seed');
const { COPPER_VALE_SEED_LIFECYCLE_STATE_KEY } = require('../src/db/service/copper-vale-seed-lifecycle-state-service');

const SYSTEM_ID = 'exo-gj-9066';
let harness;
test.before(async () => { harness = await createMongoTestHarness(); });
test.after(async () => { if (harness) await harness.teardown(); });
test.beforeEach(async () => { await harness.clearDatabase(); });
function context() {
  const ctx = new MessageHandlerContext({ databaseService: new DatabaseService(), log: () => {},
    getCurrentTimestamp: () => '2026-11-08T15:13:25.491Z' });
  seedPlayer(ctx, { playerName: 'FixturePilot', characters: [] });
  return ctx;
}
const bodies = () => CelestialBody.find({}).sort({ id: 1 }).lean();
const markets = () => Market.find({}).sort({ marketId: 1 }).lean();
const states = () => GameStateDocument.find({}).sort({ key: 1 }).lean();

test('normal first get after P6 and restarted contexts preserve 57 bodies and six markets without baseline reset', async () => {
  const plan = buildCopperValeSeedPlan();
  await runCopperValeSeedLifecycle(harness.databaseService, { action: 'apply' });
  assert.equal(await harness.databaseService.getSolarSystemCelestialSeedState(SYSTEM_ID), null);
  await runCopperValeDensityLifecycle(harness.databaseService, { action: 'apply' });
  await Market.updateOne({ marketId: plan.station.marketId }, { $set: { priceMultiplier: 1.42, 'inventory.0.stock': 7 } });
  await CelestialBody.collection.updateOne({ id: plan.bodies[2].id }, {
    $set: { ownerId: 'fixture-owner', state: 'destroyed', updatedAt: '2026-11-08T15:00:00.000Z' },
  });
  const beforeBodies = await bodies();
  const beforeMarkets = await markets();
  const beforeP6 = await harness.databaseService.getCopperValeSeedLifecycleState();
  for (let i = 0; i < 2; i++) {
    const result = await new SolarSystemGetMessageHandler(context()).buildResponse({
      playerName: 'FixturePilot', solarSystemId: SYSTEM_ID,
    });
    assert.equal(result.success, true, result.message);
    assert.equal(result.bodies.length, 57);
    assert.equal(result.stars.length, 1);
    assert.equal(result.bodies.find(b => b.id === plan.bodies[0].id).spatial.epochMs, 946728000000);
    assert.deepEqual(await bodies(), beforeBodies);
    assert.deepEqual(await markets(), beforeMarkets);
    assert.deepEqual(await harness.databaseService.getCopperValeSeedLifecycleState(), beforeP6);
  }
  const marker = await harness.databaseService.getSolarSystemCelestialSeedState(SYSTEM_ID);
  assert.equal(marker.seedVersion, getSolarSystemCelestialSeedVersion(SYSTEM_ID));
  const allStates = await states();
  const forced = await context().seedSolarSystemCelestialBodiesAsync({ solarSystemId: SYSTEM_ID, force: true });
  assert.equal(forced.success, false);
  assert.match(forced.message, /Force catalog refresh.*blocked/);
  assert.deepEqual(await bodies(), beforeBodies);
  assert.deepEqual(await markets(), beforeMarkets);
  assert.deepEqual(await states(), allStates);
  assert.equal((await runCopperValeSeedLifecycle(new DatabaseService(), { action: 'readback' })).status, 'complete');
  assert.equal((await runCopperValeDensityLifecycle(new DatabaseService(), { action: 'readback' })).status, 'complete');
});

test('already-current normal marker cannot hide corrupted P6 snapshots; no marker or body repair', async () => {
  const plan = buildCopperValeSeedPlan();
  await runCopperValeSeedLifecycle(harness.databaseService, { action: 'apply' });
  await context().seedSolarSystemCelestialBodiesAsync({ solarSystemId: SYSTEM_ID });
  await CelestialBody.updateOne({ id: plan.bodies[0].id }, { $set: { 'spatial.epochMs': 1794150805491 } });
  const before = await bodies();
  const beforeStates = await states();
  const result = await new SolarSystemGetMessageHandler(context()).buildResponse({
    playerName: 'FixturePilot', solarSystemId: SYSTEM_ID,
  });
  assert.equal(result.success, false);
  assert.equal(result.reason, 'CELESTIAL_SEED_FAILED');
  assert.match(result.message, /owner reconciliation required.*spatial.epochMs/);
  assert.deepEqual(await bodies(), before);
  assert.deepEqual(await states(), beforeStates);
});

test('incomplete or source-mismatched journal blocks ordinary and force seeding before normal marker adoption', async () => {
  await runCopperValeSeedLifecycle(harness.databaseService, { action: 'apply' });
  for (const patch of [
    { 'value.status': 'applying' },
    { 'value.status': 'complete', 'value.hashes.sourceSha256': 'unreviewed-source' },
  ]) {
    await GameStateDocument.updateOne({ key: COPPER_VALE_SEED_LIFECYCLE_STATE_KEY }, { $set: patch });
    const before = await bodies();
    const beforeStates = await states();
    for (const force of [false, true]) {
      const result = await context().seedSolarSystemCelestialBodiesAsync({ solarSystemId: SYSTEM_ID, force });
      assert.equal(result.success, false);
      assert.match(result.message, /source\/checkpoint mismatch/);
      assert.equal(await harness.databaseService.getSolarSystemCelestialSeedState(SYSTEM_ID), null);
      assert.deepEqual(await bodies(), before);
      assert.deepEqual(await states(), beforeStates);
    }
  }
});
