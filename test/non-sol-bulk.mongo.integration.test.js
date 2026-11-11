'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { createMongoTestHarness } = require('../test-support/mongodb-test-helpers');
const { generateBulkSystem } = require('../scripts/lib/non-sol-bulk-generator');
const { preflightSystem, fullPreflight, applySystem, readbackSystem, protectedFingerprint, COLLECTIONS } =
  require('../scripts/lib/non-sol-bulk-lifecycle');
const { buildSeededCelestialBodiesForSolarSystem } = require('../src/model/solar-system-celestial-seed');
const { seedSolarSystemCelestialBodiesAsync } = require('../src/handlers/context/celestial-operations-service');
const manifest = require('../data/non-sol-celestial-generation-manifest-v1.json');

let harness;
let p;
let db;
test.before(async () => {
  harness = await createMongoTestHarness();
  db = mongoose.connection.db;
  p = await generateBulkSystem(manifest.systems.find((s) => s.id === 'exo-kepler-11'));
});
test.after(async () => { if (harness) await harness.teardown(); });
test.beforeEach(async () => {
  for (const c of Object.values(COLLECTIONS)) await db.collection(c).deleteMany({});
  await db.collection('bulk_test_protected').deleteMany({});
});

test('isolated Mongo lifecycle dry-run is write-free; interruption, fresh-service resume and readback are durable', async () => {
  const before = await protectedFingerprint(db);
  assert.equal((await preflightSystem(db, p, 'guard')).status, 'absent');
  assert.deepEqual(await protectedFingerprint(db), before);
  await assert.rejects(applySystem(db, p, 'guard', { afterBodyWrite: async () => { throw new Error('interrupted'); } }), /interrupted/);
  assert.equal((await preflightSystem(db, p, 'guard')).status, 'applying');
  assert.ok(await harness.databaseService.getNonSolBulkSeedState(p.systemId));
  await assert.rejects(readbackSystem(db, p, 'guard'), /complete/);
  assert.equal((await applySystem(db, p, 'guard')).status, 'verified');
  assert.equal((await readbackSystem(db, p, 'guard')).status, 'verified');
  assert.equal((await applySystem(db, p, 'guard')).status, 'verified');
  assert.equal(await db.collection(COLLECTIONS.bodies).countDocuments({}), p.baseBodies.length + p.generatedBodies.length);
  assert.equal(await db.collection(COLLECTIONS.markets).countDocuments({}), 1);
});

test('existing catalog epochs/gameplay and all unrelated data remain byte-identical; market history survives replay', async () => {
  const base = buildSeededCelestialBodiesForSolarSystem(p.systemId, '2026-11-08T00:00:00.000Z');
  base[1].state = 'destroyed';
  base[1].debris = [];
  base[1].destroyedReason = 'test';
  await db.collection(COLLECTIONS.bodies).insertMany(base);
  await db.collection('bulk_test_protected').insertOne({ note: 'player', date: new Date() });
  const missing = { bodies: p.generatedBodies.map((b) => b.id), markets: [p.market.marketId],
    states: [`non-sol-bulk-seed:${p.systemId}`] };
  const before = await protectedFingerprint(db, missing);
  await applySystem(db, p, 'guard');
  assert.deepEqual(await protectedFingerprint(db, missing), before);
  await db.collection(COLLECTIONS.markets).updateOne({ marketId: p.market.marketId }, { $set: { inventory: [], ledger: [{ note: 'trade' }] } });
  await db.collection(COLLECTIONS.bodies).updateOne({ id: p.generatedBodies[0].id }, { $set: { state: 'destroyed', destroyedReason: 'gameplay' } });
  const evolved = await protectedFingerprint(db);
  await applySystem(db, p, 'guard');
  assert.deepEqual(await protectedFingerprint(db), evolved);
});

test('unowned IDs, player bodies, catalog identities and changed source plans block before any checkpoint/write', async () => {
  await db.collection(COLLECTIONS.bodies).insertOne({ ...p.generatedBodies[0], isCatalogBody: false });
  await assert.rejects(applySystem(db, p, 'guard'), /Player body collision/);
  assert.equal(await db.collection(COLLECTIONS.state).countDocuments({}), 0);
  const result = await fullPreflight(db, [p], 'guard');
  assert.equal(result[0].status, 'blocked');
  await db.collection(COLLECTIONS.bodies).deleteMany({});
  await db.collection(COLLECTIONS.markets).insertOne(structuredClone(p.market));
  await assert.rejects(applySystem(db, p, 'guard'), /Unowned market ID/);
  await db.collection(COLLECTIONS.markets).deleteMany({});
  const curated = await generateBulkSystem(manifest.systems.find((s) => s.id === 'cygnus-x1'));
  assert.ok(curated.baseBodies[0].catalogIdentity);
  await db.collection(COLLECTIONS.bodies).insertOne({ ...curated.baseBodies[0], id: 'different-id' });
  await assert.rejects(applySystem(db, curated, 'guard'), /Catalog identity collision/);
  await assert.rejects(applySystem(db, { ...p, sourceSha256: 'changed' }, 'guard'), /Plan checksum/);
});

test('interruption after market insert resumes without overwriting mutable economy and pauses for source drift', async () => {
  await assert.rejects(applySystem(db, p, 'guard', { afterMarketWrite: async () => { throw new Error('market interruption'); } }), /market interruption/);
  await db.collection(COLLECTIONS.markets).updateOne({ marketId: p.market.marketId }, { $set: { inventory: [] } });
  await assert.rejects(applySystem(db, p, 'changed'), /source guard drift/);
  await applySystem(db, p, 'guard');
  assert.deepEqual((await db.collection(COLLECTIONS.markets).findOne({ marketId: p.market.marketId })).inventory, []);
});

test('ordinary system-get after bulk apply never writes a lazy seed, even with an old marker or force', async () => {
  await applySystem(db, p, 'guard');
  const before = await protectedFingerprint(db);
  const ctx = { toNonEmptyString: (v) => typeof v === 'string' ? v.trim() : '',
    getCurrentTimestamp: () => '2026-11-08T00:00:00.000Z', log: () => {},
    celestialBodiesById: new Map(), normalizeCelestialBody: (b) => b, databaseService: harness.databaseService };
  assert.equal((await seedSolarSystemCelestialBodiesAsync(ctx, { solarSystemId: p.systemId })).success, true);
  assert.equal((await seedSolarSystemCelestialBodiesAsync(ctx, { solarSystemId: p.systemId, force: true })).success, false);
  assert.deepEqual(await protectedFingerprint(db), before);
});
