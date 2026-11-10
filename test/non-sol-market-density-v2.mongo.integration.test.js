'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const mongoose = require('mongoose');
const { createMongoTestHarness } = require('../test-support/mongodb-test-helpers');
const { buildDensityPlanV2 } = require('../scripts/lib/non-sol-market-density-v2');
const { applyDensity, preflightDensity, stateKey } = require('../scripts/lib/non-sol-market-density-lifecycle');
const { applySystem, readbackSystem, protectedFingerprint, COLLECTIONS } = require('../scripts/lib/non-sol-bulk-lifecycle');
const { MessageHandlerContext } = require('../src/handlers/message-handler-context');
const { createSeedMarketPayload } = require('../src/handlers/context/context-bootstrap-service');
const { seedSolarSystemCelestialBodiesAsync } = require('../src/handlers/context/celestial-operations-service');
let harness; let db;
test.before(async () => { harness = await createMongoTestHarness(); db = mongoose.connection.db; });
test.after(async () => { if (harness) await harness.teardown(); });
test.beforeEach(async () => { await harness.clearDatabase(); });

async function fixture(id, profile, target) {
  const base = JSON.parse(fs.readFileSync(`artifacts/non-sol-bulk-v1-delivery/${id}.json`, 'utf8'));
  await applySystem(db, base, 'accepted-guard');
  const plan = buildDensityPlanV2(base, { profile, target });
  const context = new MessageHandlerContext({ databaseService: {}, log: () => {} });
  for (const m of plan.preservedMarkets) {
    const seed = createSeedMarketPayload(context, m, '2000-01-01T12:00:00.000Z');
    seed.inventory[0].stock = 17;
    seed.ledger = [{ event: 'preserved legacy trade' }];
    seed.shipListings = [];
    seed.customGameplay = { keep: true };
    await db.collection(COLLECTIONS.markets).insertOne(seed);
  }
  return { base, plan };
}

for (const [id, profile, target, added] of [
  ['alpha-centauri', 'developing', 3, 0], ['barnards-star', 'established', 8, 6],
]) test(`${id}: exact baseline counted; additive apply/replay and lazy seed preserve ALL existing stocks and raw fields`, async () => {
  const { base, plan } = await fixture(id, profile, target);
  const allBefore = await protectedFingerprint(db);
  assert.equal((await preflightDensity(db, base, plan, 'accepted-guard', 'density-guard')).missing.length, added);
  assert.deepEqual(await protectedFingerprint(db), allBefore);
  const exclusions = { bodies: [], markets: plan.markets.map((m) => m.marketId), states: [stateKey(id)] };
  const before = await protectedFingerprint(db, exclusions);
  if (added) {
    await assert.rejects(applyDensity(db, base, plan, 'accepted-guard', 'density-guard',
      { afterMarketWrite: () => { throw new Error('interrupted'); } }), /interrupted/);
  }
  await applyDensity(db, base, plan, 'accepted-guard', 'density-guard');
  assert.deepEqual(await protectedFingerprint(db, exclusions), before);
  assert.equal(await db.collection(COLLECTIONS.markets).countDocuments({ solarSystemId: id }), target);
  const after = await protectedFingerprint(db);
  await applyDensity(db, base, plan, 'accepted-guard', 'density-guard');
  await readbackSystem(db, base, 'accepted-guard');
  const ctx = { toNonEmptyString: (v) => typeof v === 'string' ? v.trim() : '',
    getCurrentTimestamp: () => '2026-11-09T00:00:00.000Z', log: () => {}, celestialBodiesById: new Map(),
    normalizeCelestialBody: (b) => b, databaseService: harness.databaseService };
  assert.equal((await seedSolarSystemCelestialBodiesAsync(ctx, { solarSystemId: id })).success, true);
  assert.deepEqual(await protectedFingerprint(db), after);
});

test('missing/changed legacy baseline and unplanned market refuse without creating density checkpoints', async () => {
  const { base, plan } = await fixture('barnards-star', 'established', 8);
  await db.collection(COLLECTIONS.markets).updateOne({ marketId: 'bs-main-station' },
    { $set: { 'trajectory.orbit.semiMajorAxisKm': 3000 } });
  const before = await protectedFingerprint(db);
  await assert.rejects(applyDensity(db, base, plan, 'accepted-guard', 'density-guard'), /geometry drift/);
  assert.deepEqual(await protectedFingerprint(db), before);
  assert.equal(await db.collection(COLLECTIONS.state).countDocuments({ key: stateKey(base.systemId) }), 0);
  await db.collection(COLLECTIONS.markets).deleteOne({ marketId: 'bs-main-station' });
  await assert.rejects(preflightDensity(db, base, plan, 'accepted-guard', 'density-guard'), /missing\/duplicate/);
});

test('completed legacy baseline tampering is refused by ordinary bulk readback, not grandfathered by ID', async () => {
  const { base, plan } = await fixture('alpha-centauri', 'developing', 3);
  await applyDensity(db, base, plan, 'accepted-guard', 'density-guard');
  await db.collection(COLLECTIONS.markets).updateOne({ marketId: 'ac-belt-01' }, { $set: { siteName: 'tampered' } });
  await assert.rejects(readbackSystem(db, base, 'accepted-guard'), /geometry drift/);
});
