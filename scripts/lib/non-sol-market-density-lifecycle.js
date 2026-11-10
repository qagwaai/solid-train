'use strict';

const assert = require('node:assert/strict');
const { sha256 } = require('../../src/model/copper-vale-catalog-reconciliation');
const { densityMarketIdentity, reconcileDensityMarkets, reconcilePreservedDensityMarkets } = require('../../src/model/non-sol-market-density-reconciliation');
const { preflightSystem, COLLECTIONS } = require('./non-sol-bulk-lifecycle');
const { buildDensityPlan } = require('./non-sol-market-density-plan');

const stateKey = (id) => `non-sol-market-density:${id}`;

function checkpoint(plan, sourceGuard, status) {
  const payload = { schemaVersion: plan.schemaVersion, systemId: plan.systemId,
    baselinePlanSha256: plan.baselinePlanSha256, planSha256: plan.planSha256, sourceGuard, status,
    ...(plan.schemaVersion === 'non-sol-market-density-v2' ? { preservedMarkets: plan.preservedMarkets } : {}),
    markets: plan.markets.map(densityMarketIdentity) };
  return { ...payload, checkpointSha256: sha256(payload) };
}

async function preflightDensity(db, base, plan, baselineGuard, densityGuard) {
  const { planSha256, ...payload } = plan;
  assert.equal(sha256(payload), planSha256, 'Density plan checksum mismatch');
  const build = plan.schemaVersion === 'non-sol-market-density-v2' ? require('./non-sol-market-density-v2').buildDensityPlanV2 : buildDensityPlan;
  assert.deepEqual(plan, build(base, { profile: plan.profile, target: plan.target }), 'Density plan screening drift');
  assert.equal(plan.status, 'ready', 'Density shortfall hold');
  assert.equal(plan.baselinePlanSha256, base.planSha256);
  const baseline = await preflightSystem(db, base, baselineGuard);
  assert.equal(baseline.status, 'complete', 'Generation must be complete before density');
  const bulk = await db.collection(COLLECTIONS.state).findOne({ key: `non-sol-bulk-seed:${plan.systemId}` });
  assert.ok(await db.collection(COLLECTIONS.state).countDocuments({ key: stateKey(plan.systemId) }) <= 1,
    'Duplicate density checkpoint');
  const state = await db.collection(COLLECTIONS.state).findOne({ key: stateKey(plan.systemId) });
  const escapedId = plan.systemId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const markets = await db.collection(COLLECTIONS.markets).find({ solarSystemId: new RegExp(`^${escapedId}$`, 'i') }).toArray();
  reconcilePreservedDensityMarkets(plan, markets);
  const unrelatedMarkets = markets.filter((m) =>
    m.marketId !== base.market.marketId && !(plan.preservedMarkets || []).some((e) => e.marketId === m.marketId) &&
      !plan.markets.some((e) => e.marketId === m.marketId)).map((m) => m.marketId);
  for (const expected of plan.preservedMarkets || []) {
    assert.equal(await db.collection(COLLECTIONS.markets).countDocuments({ marketId: expected.marketId }), 1,
      `Global preserved market collision: ${expected.marketId}`);
  }
  assert.equal(unrelatedMarkets.length, 0,
    `Unplanned existing markets require owner-reviewed count/placement reconciliation (never delete): ${unrelatedMarkets.join(',')}`);
  if (state) {
    assert.equal(state.value.planSha256, plan.planSha256, 'Density checkpoint plan drift');
    assert.equal(state.value.sourceGuard, densityGuard, 'Density source guard drift');
    assert.deepEqual(state.value.markets, plan.markets.map(densityMarketIdentity), 'Density expected market drift');
    reconcileDensityMarkets(state.value, markets, bulk.value);
  }
  const missing = [];
  for (const expected of plan.markets) {
    const matches = await db.collection(COLLECTIONS.markets).find({ marketId: expected.marketId }).toArray();
    assert.ok(matches.length <= 1, 'Duplicate density market ID');
    if (matches.length) {
      assert.ok(state, `Unowned density collision: ${expected.marketId}`);
      assert.equal(matches[0].solarSystemId, plan.systemId, 'Cross-system density collision');
    } else missing.push(expected.marketId);
  }
  return { systemId: plan.systemId, status: state?.value.status || 'absent', missing,
    existingMarkets: markets.length, unrelatedMarkets };
}

async function applyDensity(db, base, plan, baselineGuard, densityGuard, options = {}) {
  const before = await preflightDensity(db, base, plan, baselineGuard, densityGuard);
  if (before.status === 'complete') return before;
  const key = stateKey(plan.systemId);
  await db.collection(COLLECTIONS.state).updateOne({ _id: key },
    { $setOnInsert: { key, value: checkpoint(plan, densityGuard, 'applying') } }, { upsert: true });
  await preflightDensity(db, base, plan, baselineGuard, densityGuard);
  for (const market of plan.markets) {
    await db.collection(COLLECTIONS.markets).updateOne({ marketId: market.marketId },
      { $setOnInsert: market }, { upsert: true });
    if (options.afterMarketWrite) await options.afterMarketWrite(market.marketId);
  }
  const checked = await preflightDensity(db, base, plan, baselineGuard, densityGuard);
  assert.equal(checked.missing.length, 0, 'Density missing after insertion');
  const changed = await db.collection(COLLECTIONS.state).updateOne({ _id: key,
    'value.planSha256': plan.planSha256, 'value.sourceGuard': densityGuard },
  { $set: { value: checkpoint(plan, densityGuard, 'complete') } });
  assert.equal(changed.matchedCount, 1, 'Density checkpoint changed concurrently');
  return preflightDensity(db, base, plan, baselineGuard, densityGuard);
}

module.exports = { stateKey, checkpoint, preflightDensity, applyDensity };
