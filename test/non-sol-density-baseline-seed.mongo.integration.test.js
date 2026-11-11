'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const mongoose = require('mongoose');
const { createMongoTestHarness } = require('../test-support/mongodb-test-helpers');
const { baselinePreflight, seedBaseline } = require('../scripts/non-sol-density-baseline-seed');
const { applySystem, COLLECTIONS, protectedFingerprint } = require('../scripts/lib/non-sol-bulk-lifecycle');
const { buildDensityPlanV2 } = require('../scripts/lib/non-sol-market-density-v2');
const { applyDensity, preflightDensity } = require('../scripts/lib/non-sol-market-density-lifecycle');
const { MessageHandlerContext } = require('../src/handlers/message-handler-context');
const { createSeedMarketPayload } = require('../src/handlers/context/context-bootstrap-service');
const evidence = require('../data/non-sol-market-density-baseline-v2.json');
let harness; let db;
test.before(async () => { harness = await createMongoTestHarness(); db = mongoose.connection.db; });
test.after(async () => { if (harness) await harness.teardown(); });
test.beforeEach(async () => { await harness.clearDatabase(); });

test('insert-only baseline restore unblocks Alpha/Barnard density without changing existing data', async () => {
  const bases = [];
  for (const [id, profile, target] of [
    ['alpha-centauri', 'developing', 3], ['barnards-star', 'established', 8],
  ]) {
    const base = JSON.parse(fs.readFileSync(`artifacts/non-sol-bulk-v1-delivery/${id}.json`, 'utf8'));
    await applySystem(db, base, 'bulk-guard');
    bases.push({ base, plan: buildDensityPlanV2(base, { profile, target }), target });
  }
  const before = await protectedFingerprint(db);
  assert.ok((await baselinePreflight(db)).every((row) => row.status === 'missing'));
  assert.deepEqual(await protectedFingerprint(db), before);
  const protectedBefore = await protectedFingerprint(db, { bodies: [], states: [],
    markets: evidence.markets.map((market) => market.marketId) });
  assert.equal((await seedBaseline(db)).inserted.length, 3);
  assert.deepEqual(await protectedFingerprint(db, { bodies: [], states: [],
    markets: evidence.markets.map((market) => market.marketId) }), protectedBefore);
  for (const { base, plan, target } of bases) {
    await preflightDensity(db, base, plan, 'bulk-guard', 'density-guard');
    await applyDensity(db, base, plan, 'bulk-guard', 'density-guard');
    assert.equal(await db.collection(COLLECTIONS.markets).countDocuments({ solarSystemId: base.systemId }), target);
  }
  await db.collection(COLLECTIONS.markets).updateOne({ marketId: 'bs-main-station' },
    { $set: { 'inventory.0.stock': 7, ledger: [{ trade: 'keep' }], shipListings: [], customGameplay: true } });
  const after = await protectedFingerprint(db);
  assert.deepEqual((await seedBaseline(db)).inserted, []);
  assert.deepEqual(await protectedFingerprint(db), after);
});

test('partial baseline seed preserves existing inventory and initializes complete missing market payloads', async () => {
  const ctx = new MessageHandlerContext({ databaseService: {}, log: () => {} });
  const seed = createSeedMarketPayload(ctx, evidence.markets[0], evidence.inspectionAt);
  seed.inventory[0].stock = 5;
  seed.customGameplay = true;
  await db.collection(COLLECTIONS.markets).insertOne(seed);
  const original = await db.collection(COLLECTIONS.markets).findOne({ marketId: seed.marketId });
  assert.equal((await seedBaseline(db)).inserted.length, 2);
  assert.deepEqual(await db.collection(COLLECTIONS.markets).findOne({ marketId: seed.marketId }), original);
  const inserted = await db.collection(COLLECTIONS.markets).findOne({ marketId: 'bs-main-station' });
  assert.equal(inserted.inventory.length, 21);
  assert.equal(inserted.shipListings.length, 1);
  assert.deepEqual(inserted.ledger, []);
});

test('different geometry or cross-system collision refuses before inserting any missing baseline market', async () => {
  for (const changed of [
    { ...evidence.markets[0], siteName: 'different geometry' },
    { ...evidence.markets[0], solarSystemId: 'other-system' },
  ]) {
    await harness.clearDatabase();
    await db.collection(COLLECTIONS.markets).insertOne(changed);
    const before = await protectedFingerprint(db);
    await assert.rejects(seedBaseline(db), /geometry drift/);
    assert.deepEqual(await protectedFingerprint(db), before);
  }
});

test('new environment snapshot epochs are accepted initially and then bound exactly to the density checkpoint', async () => {
  const base = JSON.parse(fs.readFileSync('artifacts/non-sol-bulk-v1-delivery/barnards-star.json', 'utf8'));
  await applySystem(db, base, 'bulk-guard');
  await seedBaseline(db);
  const snapshotEpoch = Date.parse('2026-11-10T20:27:38.558Z');
  await db.collection(COLLECTIONS.markets).updateOne({ marketId: 'bs-main-station' },
    { $set: { 'spatial.epochMs': snapshotEpoch, 'spatial.positionKm': { x: -470419, y: 3496232, z: -41068 } } });
  await db.collection(COLLECTIONS.markets).updateOne({ marketId: 'ac-belt-01' },
    { $set: { 'spatial.epochMs': snapshotEpoch, 'trajectory.orbit.epoch': new Date(snapshotEpoch).toISOString() } });
  assert.ok((await baselinePreflight(db)).every((row) => row.status === 'existing'));
  const existing = await db.collection(COLLECTIONS.markets).findOne({ marketId: 'bs-main-station' });
  const plan = buildDensityPlanV2(base, { profile: 'established', target: 8 });
  await applyDensity(db, base, plan, 'bulk-guard', 'density-guard');
  assert.deepEqual(await db.collection(COLLECTIONS.markets).findOne({ marketId: existing.marketId }), existing);
  await preflightDensity(db, base, plan, 'bulk-guard', 'density-guard');
  await db.collection(COLLECTIONS.markets).updateOne({ marketId: existing.marketId },
    { $set: { 'spatial.epochMs': snapshotEpoch + 1000 } });
  await assert.rejects(preflightDensity(db, base, plan, 'bulk-guard', 'density-guard'), /geometry drift/);
});
