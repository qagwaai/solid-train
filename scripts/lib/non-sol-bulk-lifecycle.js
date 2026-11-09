'use strict';

const assert = require('node:assert/strict');
const { sha256, assertBodyMatches, projectToExpectedShape } = require('../../src/model/copper-vale-catalog-reconciliation');
const { reconcileBulkSeed } = require('../../src/model/non-sol-bulk-reconciliation');
const { CelestialBody, Market, GameStateDocument } = require('../../src/db/models');
const { buildSeededCelestialBodiesForSolarSystem } = require('../../src/model/solar-system-celestial-seed');
const { EJSON } = require('bson');
const { createHash } = require('node:crypto');
const { reconcileDensityMarkets } = require('../../src/model/non-sol-market-density-reconciliation');

const COLLECTIONS = { bodies: CelestialBody.collection.name, markets: Market.collection.name,
  state: GameStateDocument.collection.name };

function marketReadbackFields(market) {
  return Object.fromEntries(['marketId', 'solarSystemId', 'marketName', 'siteType', 'siteName',
    'stationPlacement', 'trajectory', 'spatial'].map((field) => [field, market[field]]));
}

function checkpoint(plan, sourceGuard, status, expectedBodies = [...plan.baseBodies, ...plan.generatedBodies]) {
  const payload = { schemaVersion: 'non-sol-bulk-checkpoint-v1', systemId: plan.systemId,
    epoch: plan.baseBodies[0].createdAt, planSha256: plan.planSha256, sourceGuard,
    baseSha256: plan.baseSha256, status, bodies: expectedBodies,
    bodiesSha256: sha256(expectedBodies), market: marketReadbackFields(plan.market) };
  return { ...payload, checkpointSha256: sha256(payload) };
}

function verifyMarket(actual, expected) {
  assert.ok(actual, `Missing market ${expected.marketId}`);
  assert.deepEqual(projectToExpectedShape(marketReadbackFields(actual), marketReadbackFields(expected)),
    marketReadbackFields(expected), `Market identity/trajectory mismatch: ${expected.marketId}`);
}

async function preflightSystem(db, plan, sourceGuard) {
  assert.ok(!['sol', 'exo-gj-9066'].includes(plan.systemId), 'Protected system is not a bulk target');
  const { planSha256, ...payload } = plan;
  assert.equal(sha256(payload), planSha256, 'Plan checksum mismatch');
  assert.equal(plan.baseSha256, sha256(buildSeededCelestialBodiesForSolarSystem(plan.systemId, plan.baseBodies[0].createdAt)), 'Catalog source drift');
  const bodies = db.collection(COLLECTIONS.bodies);
  const markets = db.collection(COLLECTIONS.markets);
  const state = await db.collection(COLLECTIONS.state).findOne({ key: `non-sol-bulk-seed:${plan.systemId}` });
  if (state) {
    const { checkpointSha256, ...payload } = state.value;
    assert.equal(sha256(payload), checkpointSha256, 'Checkpoint checksum mismatch');
    assert.equal(state.value.planSha256, plan.planSha256, 'Checkpoint source/plan drift');
    assert.equal(state.value.sourceGuard, sourceGuard, 'Checkpoint source guard drift');
  }
  const missingBodies = [];
  const expectedBodies = [];
  for (const body of [...plan.baseBodies, ...plan.generatedBodies]) {
    if (body.catalogIdentity) {
      const owner = await bodies.findOne({ 'spatial.solarSystemId': plan.systemId,
        'catalogIdentity.namespace': body.catalogIdentity.namespace, 'catalogIdentity.key': body.catalogIdentity.key,
        id: { $ne: body.id } });
      assert.ok(!owner, `Catalog identity collision: ${body.id}`);
      const assignment = await db.collection('catalog_identity_assignments').findOne({
        solarSystemId: plan.systemId, namespace: body.catalogIdentity.namespace, key: body.catalogIdentity.key });
      assert.ok(!assignment || assignment.catalogId === body.catalogId, `Catalog identity assignment collision: ${body.id}`);
    }
    assert.ok(await bodies.countDocuments({ id: body.id }) <= 1, `Duplicate body ID: ${body.id}`);
    const actual = await bodies.findOne({ id: body.id });
    if (!actual) { missingBodies.push(body.id); expectedBodies.push(body); continue; }
    assert.equal(actual.isCatalogBody, true, `Player body collision: ${body.id}`);
    let expected = body;
    if (plan.baseBodies.some((b) => b.id === body.id)) {
      // Existing catalog snapshots are immutable, including their original epoch.
      const epoch = new Date(actual.spatial.epochMs).toISOString();
      expected = buildSeededCelestialBodiesForSolarSystem(plan.systemId, epoch).find((b) => b.id === body.id);
    }
    assertBodyMatches(actual, expected);
    expectedBodies.push(expected);
    // Generated IDs may only be adopted from our durable checkpoint.
    if (plan.generatedBodies.some((b) => b.id === body.id)) assert.ok(state, `Unowned generated ID collision: ${body.id}`);
  }
  const actualMarket = await markets.findOne({ marketId: plan.market.marketId });
  assert.ok(await markets.countDocuments({ marketId: plan.market.marketId }) <= 1, `Duplicate market ID: ${plan.market.marketId}`);
  if (actualMarket) { assert.ok(state, `Unowned market ID collision: ${plan.market.marketId}`); verifyMarket(actualMarket, plan.market); }
  if (state?.value.status === 'complete') {
    assert.equal(missingBodies.length, 0, 'Completed checkpoint missing bodies');
    assert.ok(actualMarket, 'Completed checkpoint missing market');
    const density = await db.collection(COLLECTIONS.state).findOne({ key: `non-sol-market-density:${plan.systemId}` });
    if (density) reconcileDensityMarkets(density.value,
      await markets.find({ solarSystemId: plan.systemId }).toArray(), state.value);
  }
  return { systemId: plan.systemId, status: state?.value.status || 'absent', missingBodies,
    missingMarket: !actualMarket, planSha256: plan.planSha256,
    expectedBodiesSha256: sha256(expectedBodies) };
}

async function readbackSystem(db, plan, sourceGuard) {
  const result = await preflightSystem(db, plan, sourceGuard);
  assert.equal(result.status, 'complete', 'Readback requires complete checkpoint');
  const state = await db.collection(COLLECTIONS.state).findOne({ key: `non-sol-bulk-seed:${plan.systemId}` });
  const bodies = await db.collection(COLLECTIONS.bodies).find({ 'spatial.solarSystemId': plan.systemId }).toArray();
  reconcileBulkSeed(state.value, bodies);
  return { systemId: plan.systemId, status: 'verified', planSha256: plan.planSha256 };
}

async function applySystem(db, plan, sourceGuard, options = {}) {
  const preflight = await preflightSystem(db, plan, sourceGuard);
  if (preflight.status === 'complete') return readbackSystem(db, plan, sourceGuard);
  const states = db.collection(COLLECTIONS.state);
  const key = `non-sol-bulk-seed:${plan.systemId}`;
  const applying = checkpoint(plan, sourceGuard, 'applying');
  await states.updateOne({ _id: key }, { $setOnInsert: { key, value: applying } }, { upsert: true });
  // A checkpoint is durable BEFORE a body can be inserted. No existing body/economy fields are updated.
  await preflightSystem(db, plan, sourceGuard);
  for (const body of [...plan.baseBodies, ...plan.generatedBodies]) {
    await db.collection(COLLECTIONS.bodies).updateOne({ id: body.id },
      { $setOnInsert: body }, { upsert: true });
    const actual = await db.collection(COLLECTIONS.bodies).findOne({ id: body.id });
    const expected = plan.baseBodies.some((b) => b.id === body.id) ?
      buildSeededCelestialBodiesForSolarSystem(plan.systemId, new Date(actual.spatial.epochMs).toISOString()).find((b) => b.id === body.id) : body;
    assertBodyMatches(actual, expected);
    if (options.afterBodyWrite) await options.afterBodyWrite(body.id);
  }
  await db.collection(COLLECTIONS.markets).updateOne({ marketId: plan.market.marketId },
    { $setOnInsert: plan.market }, { upsert: true });
  verifyMarket(await db.collection(COLLECTIONS.markets).findOne({ marketId: plan.market.marketId }), plan.market);
  if (options.afterMarketWrite) await options.afterMarketWrite();
  const expectedBodies = [];
  for (const body of [...plan.baseBodies, ...plan.generatedBodies]) {
    const actual = await db.collection(COLLECTIONS.bodies).findOne({ id: body.id });
    expectedBodies.push(plan.baseBodies.some((b) => b.id === body.id) ?
      buildSeededCelestialBodiesForSolarSystem(plan.systemId, new Date(actual.spatial.epochMs).toISOString()).find((b) => b.id === body.id) : body);
  }
  const complete = checkpoint(plan, sourceGuard, 'complete', expectedBodies);
  const updated = await states.updateOne({ _id: key, 'value.planSha256': plan.planSha256,
    'value.sourceGuard': sourceGuard }, { $set: { value: complete } });
  assert.equal(updated.matchedCount, 1, 'Checkpoint changed concurrently');
  return readbackSystem(db, plan, sourceGuard);
}

// Hash every pre-existing document, including existing target gameplay/economy.
// Only newly missing exact seed IDs and our own checkpoint documents may be added.
async function protectedFingerprint(db, missing = { bodies: [], markets: [], states: [] }) {
  const result = {};
  const collections = await db.listCollections({}, { nameOnly: true }).toArray();
  for (const { name } of collections.sort((a, b) => a.name.localeCompare(b.name))) {
    if (name.startsWith('system.')) continue;
    let filter = {};
    if (name === COLLECTIONS.bodies) filter = { id: { $nin: missing.bodies } };
    if (name === COLLECTIONS.markets) filter = { marketId: { $nin: missing.markets } };
    if (name === COLLECTIONS.state) filter = { key: { $nin: missing.states || [] } };
    const digest = createHash('sha256');
    let count = 0;
    for await (const doc of db.collection(name).find(filter).sort({ _id: 1 })) {
      digest.update(sha256(EJSON.serialize(doc)));
      count++;
    }
    if (count) result[name] = { count, sha256: digest.digest('hex') };
  }
  return result;
}

async function fullPreflight(db, plans, sourceGuard) {
  const results = [];
  for (const plan of plans) {
    try { results.push(await preflightSystem(db, plan, sourceGuard)); }
    catch (error) { results.push({ systemId: plan.systemId, status: 'blocked', reason: error.message }); }
  }

  return results;
}

async function ensureIndexes(db) {
  // Match existing runtime indexes; never drop/rebuild/reset collections.
  await db.collection(COLLECTIONS.bodies).createIndex({ id: 1 }, { unique: true });
  await db.collection(COLLECTIONS.markets).createIndex({ marketId: 1, solarSystemId: 1 }, { unique: true });
  await db.collection(COLLECTIONS.state).createIndex({ key: 1 }, { unique: true });
}

module.exports = { checkpoint, preflightSystem, applySystem, readbackSystem, protectedFingerprint,
  fullPreflight, ensureIndexes, COLLECTIONS };
