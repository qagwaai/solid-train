'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { Market, CelestialBody, GameStateDocument } = require('../src/db/models');
const { DatabaseService } = require('../src/db/service');
const { createMongoTestHarness } = require('../test-support/mongodb-test-helpers');
const { runCopperValeSeedLifecycle, buildCopperValeSeedPlan } = require('../src/model/copper-vale-seed-lifecycle');
const { COPPER_VALE_SEED_LIFECYCLE_STATE_KEY } = require('../src/db/service/copper-vale-seed-lifecycle-state-service');
const { protectedSnapshot } = require('../scripts/copper-vale-persistent-seed');
const {
  JOURNAL_KEY, buildCopperValeDensityPlan, runCopperValeDensityLifecycle,
} = require('../src/model/copper-vale-market-density-lifecycle');

let harness;
test.before(async () => { harness = await createMongoTestHarness(); });
test.after(async () => { if (harness) await harness.teardown(); });
test.beforeEach(async () => { await harness.clearDatabase(); });
const run = (options) => runCopperValeDensityLifecycle(new DatabaseService(), options);
const baseline = () => runCopperValeSeedLifecycle(harness.databaseService, { action: 'apply' });
const snapshot = () => {
  const plan = buildCopperValeDensityPlan();
  return protectedSnapshot(mongoose.connection.db, { addedMarketIds: plan.addedMarketIds, journalKey: JOURNAL_KEY });
};

test('isolated additive apply preserves ALL bodies, old station/P6, unrelated gameplay and exact canonical stock; rerun writes nothing', async () => {
  const baselinePlan = buildCopperValeSeedPlan();
  await baseline();
  await Market.updateOne({ marketId: baselinePlan.station.marketId }, {
    $set: { priceMultiplier: 1.42, 'inventory.0.stock': 7 },
  });
  await CelestialBody.collection.updateOne({ id: baselinePlan.expectedBodyIds[0] }, { $set: { ownerId: 'test-owner' } });
  await mongoose.connection.db.collection('players').insertOne({ owner: 'fixture', credits: 1234 });
  await Market.create({ ...buildCopperValeDensityPlan().markets[0], marketId: 'unrelated-future-market' });
  const before = await snapshot();
  const oldStation = await Market.findOne({ marketId: baselinePlan.station.marketId }).lean();
  const oldBodies = await CelestialBody.find({}).sort({ _id: 1 }).lean();
  const oldP6 = await GameStateDocument.findOne({ key: COPPER_VALE_SEED_LIFECYCLE_STATE_KEY }).lean();
  assert.equal((await run({ action: 'dry-run' })).readiness, 'ready');
  assert.equal(await GameStateDocument.countDocuments({ key: JOURNAL_KEY }), 0);
  const first = await run({ action: 'apply' });
  assert.equal(first.status, 'complete');
  assert.equal(first.verifiedMarketIds.length, 5);
  const plan = buildCopperValeDensityPlan();
  const added = await Market.find({ marketId: { $in: plan.addedMarketIds } }).lean();
  assert.equal(added.length, 5);
  assert.equal(added.reduce((n, market) => n + market.inventory.length, 0), 105);
  assert.equal(added.reduce((n, market) => n + market.inventory.reduce((s, item) => s + item.stock, 0), 0), 59600);
  assert.equal(added.reduce((n, market) => n + market.inventory.reduce((s, item) => s + item.restockPerInterval, 0), 0), 4755);
  assert.equal(added.reduce((n, market) => n + market.shipListings.length, 0), 5);
  assert.equal(first.initialSupply.inventoryRows, 126);
  assert.equal(first.initialSupply.aggregateStock, 71520);
  assert.equal(first.initialSupply.aggregateRestockCapacityPerInterval, 5706);
  await Market.updateOne({ marketId: plan.addedMarketIds[0] }, {
    $set: { priceMultiplier: 1.9, 'inventory.0.stock': 13, 'shipListings.0.quantityAvailable': 0 },
    $push: { ledger: {
      transactionId: 'fixture-trade', characterId: 'fixture-owner', itemId: 'iron',
      direction: 'buy', quantity: 1, unitPrice: 10, totalPrice: 10, timestamp: '2026-11-08',
    } },
  });
  // Unknown ownership/gameplay fields must also remain byte-for-byte preserved.
  await Market.collection.updateOne({ marketId: plan.addedMarketIds[0] }, { $set: { ownerId: 'fixture-owner' } });
  const allMarkets = await Market.find({}).sort({ _id: 1 }).lean();
  const journal = await GameStateDocument.findOne({ key: JOURNAL_KEY }).lean();
  assert.equal((await run({ action: 'apply' })).writes, false);
  assert.equal((await run({ action: 'readback' })).status, 'complete');
  assert.deepEqual(await Market.find({}).sort({ _id: 1 }).lean(), allMarkets);
  assert.deepEqual(await GameStateDocument.findOne({ key: JOURNAL_KEY }).lean(), journal);
  assert.deepEqual(await snapshot(), before);
  assert.deepEqual(await Market.findOne({ marketId: baselinePlan.station.marketId }).lean(), oldStation);
  assert.deepEqual(await CelestialBody.find({}).sort({ _id: 1 }).lean(), oldBodies);
  assert.deepEqual(await GameStateDocument.findOne({ key: COPPER_VALE_SEED_LIFECYCLE_STATE_KEY }).lean(), oldP6);
  assert.equal((await runCopperValeSeedLifecycle(new DatabaseService(), { action: 'dry-run' })).readiness, 'verified');
  assert.equal((await runCopperValeSeedLifecycle(new DatabaseService(), { action: 'readback' })).verifiedBodyIds.length, 57);
});

test('clean six-market readback has exact inventory, caps, ships and restock totals', async () => {
  await baseline();
  await run({ action: 'apply' });
  const markets = await Market.find({ solarSystemId: 'exo-gj-9066' }).lean();
  assert.equal(markets.length, 6);
  const inventory = markets.flatMap((market) => market.inventory);
  assert.equal(inventory.length, 126);
  assert.equal(inventory.reduce((n, item) => n + item.stock, 0), 71520);
  assert.equal(inventory.reduce((n, item) => n + item.maxStock, 0), 71520);
  assert.equal(inventory.reduce((n, item) => n + item.restockPerInterval, 0), 5706);
  const ships = markets.flatMap((market) => market.shipListings);
  assert.equal(ships.length, 6);
  assert.equal(ships.reduce((n, listing) => n + listing.quantityAvailable, 0), 6);
  assert.equal(ships.flatMap((listing) => listing.starterInventory).reduce((n, item) => n + item.quantity, 0), 36);
});

test('missing/incomplete P6, interrupted body and missing baseline station/checkpoint stop density before journal', async () => {
  assert.equal((await run({ action: 'dry-run' })).readiness, 'blocked');
  await assert.rejects(baselineWithInterruption(), /body interrupt/);
  assert.equal((await run({ action: 'dry-run' })).readiness, 'blocked');
  assert.equal(await GameStateDocument.countDocuments({ key: JOURNAL_KEY }), 0);
  await assert.rejects(runCopperValeSeedLifecycle(harness.databaseService, {
    action: 'resume', afterMarketWrite: () => { throw new Error('P6 station before checkpoint'); },
  }), /P6 station before checkpoint/);
  assert.equal(await Market.countDocuments({}), 1);
  assert.equal((await run({ action: 'dry-run' })).readiness, 'blocked');
  assert.equal(await GameStateDocument.countDocuments({ key: JOURNAL_KEY }), 0);
  await runCopperValeSeedLifecycle(harness.databaseService, { action: 'resume' });
  await Market.deleteOne({ marketId: 'copper-vale-asteroid-exchange' });
  await assert.rejects(run({ action: 'apply' }), /Missing expected seeded station/);
  assert.equal(await GameStateDocument.countDocuments({ key: JOURNAL_KEY }), 0);
  async function baselineWithInterruption() {
    return runCopperValeSeedLifecycle(harness.databaseService, {
      action: 'apply', afterBodyWrite: () => { throw new Error('body interrupt'); },
    });
  }
});

test('dirty matching and incorrect candidate IDs including cross-system collisions are never adopted without journal', async () => {
  await baseline();
  const plan = buildCopperValeDensityPlan();
  for (const market of [
    plan.markets[0],
    { ...plan.markets[0], marketName: 'wrong immutable' },
    { ...plan.markets[0], solarSystemId: 'other-system' },
  ]) {
    const inserted = await Market.create(market);
    const before = await Market.find({}).sort({ _id: 1 }).lean();
    assert.equal((await run({ action: 'dry-run' })).readiness, 'blocked');
    await assert.rejects(run({ action: 'apply' }), /Missing density checkpoint/);
    assert.deepEqual(await Market.find({}).sort({ _id: 1 }).lean(), before);
    assert.equal(await GameStateDocument.countDocuments({ key: JOURNAL_KEY }), 0);
    await Market.deleteOne({ _id: inserted._id }); // disposable test fixture only
  }
});

test('write-before-checkpoint interruption requires explicit resume and preserves gameplay; ownership prevents silent collision adoption', async () => {
  await baseline();
  const plan = buildCopperValeDensityPlan();
  const before = await snapshot();
  await assert.rejects(run({ action: 'apply', afterMarketWrite: () => { throw new Error('market interrupt'); } }), /market interrupt/);
  let journal = (await GameStateDocument.findOne({ key: JOURNAL_KEY }).lean()).value;
  assert.deepEqual(journal.verifiedMarketIds, []);
  assert.equal((await run({ action: 'dry-run' })).readiness, 'resumable');
  await assert.rejects(run({ action: 'apply' }), /explicit resume/);
  await assert.rejects(run({ action: 'readback' }), /complete durable/);
  await Market.updateOne({ marketId: plan.markets[0].marketId }, { $set: { 'inventory.0.stock': 11, priceMultiplier: 1.5 } });
  const written = await Market.findOne({ marketId: plan.markets[0].marketId }).lean();
  const resumed = await run({ action: 'resume' });
  assert.equal(resumed.status, 'complete');
  assert.deepEqual(await Market.findOne({ marketId: written.marketId }).lean(), written);
  assert.deepEqual(await snapshot(), before);
  journal = (await GameStateDocument.findOne({ key: JOURNAL_KEY }).lean()).value;
  assert.deepEqual(journal.verifiedMarketIds, plan.addedMarketIds);
  await GameStateDocument.deleteOne({ key: JOURNAL_KEY });
  await assert.rejects(run({ action: 'apply' }), /Missing density checkpoint/);
});

test('owned immutable tampering, replacement ObjectId, missing verified market and altered sources refuse without mutation', async () => {
  await baseline();
  const plan = buildCopperValeDensityPlan();
  await assert.rejects(run({ action: 'apply', afterMarketWrite: () => { throw new Error('interrupt'); } }), /interrupt/);
  const market = await Market.findOne({ marketId: plan.markets[0].marketId }).lean();
  await Market.updateOne({ _id: market._id }, { $set: { siteName: 'wrong immutable site' } });
  await assert.rejects(run({ action: 'resume' }), /mismatch|immutable/);
  await Market.updateOne({ _id: market._id }, { $set: { siteName: market.siteName } });
  await Market.deleteOne({ _id: market._id });
  const replacement = await Market.create(plan.markets[0]);
  await assert.rejects(run({ action: 'resume' }), /Unowned collision/);
  await Market.deleteOne({ _id: replacement._id });
  await Market.collection.insertOne(market);
  await run({ action: 'resume' });
  const altered = structuredClone(plan);
  altered.previewSha256 = 'unapproved-source';
  await assert.rejects(run({ action: 'apply', plan: altered }), /source\/plan changed/);
  const journal = await GameStateDocument.findOne({ key: JOURNAL_KEY }).lean();
  await GameStateDocument.updateOne({ key: JOURNAL_KEY }, { $set: { 'value.planSha256': 'altered-source' } });
  await assert.rejects(run({ action: 'readback' }), /source\/plan changed/);
  await GameStateDocument.collection.replaceOne({ _id: journal._id }, journal);
  await Market.deleteOne({ _id: market._id });
  await assert.rejects(run({ action: 'apply' }), /Missing checkpointed market/);
});

test('protected changes during interruption block resume rather than rewriting body/P6/original station', async () => {
  await baseline();
  await assert.rejects(run({ action: 'apply', afterMarketWrite: () => { throw new Error('interrupt'); } }), /interrupt/);
  await Market.updateOne({ marketId: 'copper-vale-asteroid-exchange' }, { $set: { priceMultiplier: 1.6 } });
  const before = await snapshot();
  assert.equal((await run({ action: 'dry-run' })).readiness, 'blocked');
  await assert.rejects(run({ action: 'resume' }), /Protected data changed/);
  assert.deepEqual(await snapshot(), before);
});
