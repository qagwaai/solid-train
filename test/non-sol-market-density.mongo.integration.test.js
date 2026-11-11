'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { bulkFixture } = require('../test-support/non-sol-bulk-fixture');
const mongoose = require('mongoose');
const { createMongoTestHarness } = require('../test-support/mongodb-test-helpers');
const { buildDensityPlan } = require('../scripts/lib/non-sol-market-density-plan');
const { preflightDensity, applyDensity, stateKey } = require('../scripts/lib/non-sol-market-density-lifecycle');
const { applySystem, readbackSystem, protectedFingerprint, COLLECTIONS } = require('../scripts/lib/non-sol-bulk-lifecycle');
const { seedSolarSystemCelestialBodiesAsync } = require('../src/handlers/context/celestial-operations-service');
let base; let plan;
let harness; let db;
test.before(async () => {
  base = await bulkFixture('exo-kepler-11');
  plan = await buildDensityPlan(base, { profile: 'major-trade-center', target: 16 });
  harness = await createMongoTestHarness(); db = mongoose.connection.db;
});
test.after(async () => { if (harness) await harness.teardown(); });
test.beforeEach(async () => {
  await harness.clearDatabase();
  await applySystem(db, base, 'accepted-guard');
});

test('read-only preflight, interrupted insert, resumable replay preserve all baseline and evolved fields', async () => {
  await db.collection(COLLECTIONS.markets).updateOne({ marketId: base.market.marketId },
    { $set: { inventory: [], shipListings: [], ledger: [{ event: 'existing trade' }], customGameplay: { x: 7 } } });
  const excluded = { bodies: [], markets: plan.markets.map((m) => m.marketId), states: [stateKey(plan.systemId)] };
  const before = await protectedFingerprint(db, excluded);
  const allBefore = await protectedFingerprint(db);
  assert.equal((await preflightDensity(db, base, plan, 'accepted-guard', 'density-guard')).status, 'absent');
  assert.deepEqual(await protectedFingerprint(db), allBefore);
  await assert.rejects(applyDensity(db, base, plan, 'accepted-guard', 'density-guard',
    { afterMarketWrite: async () => { throw new Error('interrupted'); } }), /interrupted/);
  const first = plan.markets[0];
  await db.collection(COLLECTIONS.markets).updateOne({ marketId: first.marketId },
    { $set: { inventory: [], shipListings: [], ledger: [{ event: 'new trade' }], customGameplay: 'keep' } });
  await assert.rejects(applyDensity(db, base, plan, 'accepted-guard', 'changed'), /source guard drift/);
  assert.equal((await applyDensity(db, base, plan, 'accepted-guard', 'density-guard')).status, 'complete');
  assert.deepEqual(await protectedFingerprint(db, excluded), before);
  const evolved = await protectedFingerprint(db);
  await applyDensity(db, base, plan, 'accepted-guard', 'density-guard');
  assert.deepEqual(await protectedFingerprint(db), evolved);
  const persisted = await db.collection(COLLECTIONS.markets).findOne({ marketId: first.marketId });
  assert.deepEqual(persisted.inventory, []);
  assert.deepEqual(persisted.shipListings, []);
  assert.equal(persisted.customGameplay, 'keep');
  assert.equal(await db.collection(COLLECTIONS.markets).countDocuments({ solarSystemId: base.systemId }), 16);
});

test('bulk readback and normal lazy-seed tolerate exact additive density without any writes', async () => {
  await applyDensity(db, base, plan, 'accepted-guard', 'density-guard');
  const before = await protectedFingerprint(db);
  assert.equal((await readbackSystem(db, base, 'accepted-guard')).status, 'verified');
  const ctx = { toNonEmptyString: (v) => typeof v === 'string' ? v.trim() : '',
    getCurrentTimestamp: () => '2026-11-08T00:00:00.000Z', log: () => {},
    celestialBodiesById: new Map(), normalizeCelestialBody: (b) => b, databaseService: harness.databaseService };
  assert.equal((await seedSolarSystemCelestialBodiesAsync(ctx, { solarSystemId: base.systemId })).success, true);
  assert.deepEqual(await protectedFingerprint(db), before);
  await db.collection(COLLECTIONS.markets).updateOne({ marketId: plan.markets[0].marketId },
    { $set: { marketName: 'tampered' } });
  await assert.rejects(readbackSystem(db, base, 'accepted-guard'), /Density identity/);
  assert.equal((await seedSolarSystemCelestialBodiesAsync(ctx, { solarSystemId: base.systemId })).success, false);
});

test('unowned market collision and missing generation reject before any density checkpoint write', async () => {
  await db.collection(COLLECTIONS.markets).insertOne(structuredClone(plan.markets[0]));
  await assert.rejects(applyDensity(db, base, plan, 'accepted-guard', 'density-guard'), /Unowned density collision/);
  assert.equal(await db.collection(COLLECTIONS.state).countDocuments({ key: stateKey(base.systemId) }), 0);
  await db.collection(COLLECTIONS.markets).deleteOne({ marketId: plan.markets[0].marketId });
  await db.collection(COLLECTIONS.state).deleteOne({ key: `non-sol-bulk-seed:${base.systemId}` });
  await assert.rejects(applyDensity(db, base, plan, 'accepted-guard', 'density-guard'));
  assert.equal(await db.collection(COLLECTIONS.state).countDocuments({ key: stateKey(base.systemId) }), 0);
});

test('unplanned mixed-case existing markets hold count and geometry for owner reconciliation without mutation', async () => {
  await db.collection(COLLECTIONS.markets).insertOne({ ...base.market, solarSystemId: base.systemId.toUpperCase(),
    marketId: 'player-existing-market' });
  const before = await protectedFingerprint(db);
  await assert.rejects(applyDensity(db, base, plan, 'accepted-guard', 'density-guard'), /Unplanned existing markets/);
  assert.deepEqual(await protectedFingerprint(db), before);
});

test('completed missing market, changed plan and baseline identity cannot be adopted on resume', async () => {
  await applyDensity(db, base, plan, 'accepted-guard', 'density-guard');
  await db.collection(COLLECTIONS.markets).deleteOne({ marketId: plan.markets[0].marketId });
  await assert.rejects(applyDensity(db, base, plan, 'accepted-guard', 'density-guard'), /missing market/);
  await assert.rejects(preflightDensity(db, base, { ...plan, target: 15 }, 'accepted-guard', 'density-guard'), /checksum/);
});
