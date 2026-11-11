'use strict';

const assert = require('node:assert/strict');
const { sha256, projectToExpectedShape } = require('./copper-vale-catalog-reconciliation');

/** Identity/placement only: inventory, ledger, stock and ship sales are gameplay-owned.
 * @param {any} market */
function densityMarketIdentity(market) {
  return Object.fromEntries(['marketId', 'solarSystemId', 'marketName', 'siteType', 'siteName',
    'stationPlacement', 'trajectory', 'spatial'].filter((field) => market[field] !== undefined)
    .map((field) => [field, market[field]]));
}

/** @param {any} actual @param {any} expected */
function assertBaselineSnapshot(actual, expected) {
  const stable = (market) => {
    const value = JSON.parse(JSON.stringify(densityMarketIdentity(market)));
    delete value.spatial.positionKm;
    delete value.spatial.epochMs;
    if (value.siteType === 'free-floating') delete value.trajectory.orbit.epoch;
    return value;
  };
  assert.deepEqual(stable(actual), stable(expected), `Baseline orbital geometry drift: ${expected.marketId}`);
  assert.ok(Number.isSafeInteger(actual.spatial.epochMs), 'Invalid baseline snapshot epoch');
  assert.ok(['x', 'y', 'z'].every((axis) => Number.isFinite(actual.spatial.positionKm[axis])),
    'Invalid baseline snapshot position');
  if (actual.siteType === 'free-floating') {
    assert.equal(Date.parse(actual.trajectory.orbit.epoch), actual.spatial.epochMs,
      'Free-floating baseline orbit/snapshot epochs differ');
  }
  if (actual.spatial.epochMs === expected.spatial.epochMs) {
    assert.deepEqual(actual.spatial, expected.spatial, 'Baseline position changed without a new snapshot epoch');
  }
}

/** @param {any} state @param {any[]} markets */
function reconcilePreservedDensityMarkets(state, markets) {
  const isV2 = state.schemaVersion === 'non-sol-market-density-v2';
  const expected = isV2 ? require('../../data/non-sol-market-density-baseline-v2.json').markets
    .filter((m) => m.solarSystemId === state.systemId) : [];
  const preserved = state.preservedMarkets || [];
  assert.deepEqual(preserved.map((m) => m.marketId), expected.map((m) => m.marketId),
    'Density preserved baseline evidence drift');
  for (const [index, e] of expected.entries()) {
    assertBaselineSnapshot(preserved[index], e);
    const matches = markets.filter((m) => m.marketId === e.marketId);
    assert.equal(matches.length, 1, `Preserved density baseline missing/duplicate: ${e.marketId}`);
    const actual = densityMarketIdentity(matches[0]);
    if (['applying', 'complete'].includes(state.status)) {
      assert.deepEqual(actual, preserved[index], `Preserved density baseline identity/geometry drift: ${e.marketId}`);
    } else {
      assertBaselineSnapshot(actual, e);
    }
  }
}

/** Exact checkpoint-owned IDs only; no prefix whitelist.
 * @param {any} state @param {any[]} markets @param {any} bulkState */
function reconcileDensityMarkets(state, markets, bulkState) {
  if (!state) return;
  const { checkpointSha256, ...payload } = state;
  assert.equal(sha256(payload), checkpointSha256, 'Density checkpoint checksum mismatch');
  assert.ok(['non-sol-market-density-v1', 'non-sol-market-density-v2'].includes(state.schemaVersion), 'Unsupported density schema');
  assert.ok(['applying', 'complete'].includes(state.status), 'Invalid density status');
  assert.equal(state.systemId, bulkState.systemId);
  assert.equal(state.baselinePlanSha256, bulkState.planSha256, 'Density baseline drift');
  assert.ok(!['sol', 'exo-gj-9066'].includes(state.systemId), 'Protected density system');
  const baseline = markets.filter((m) => m.marketId === bulkState.market.marketId);
  assert.equal(baseline.length, 1, 'Density baseline market missing/duplicate');
  const expectedBaseline = densityMarketIdentity(bulkState.market);
  assert.deepEqual(projectToExpectedShape(densityMarketIdentity(baseline[0]), expectedBaseline),
    expectedBaseline, 'Density baseline market identity/placement drift');
  reconcilePreservedDensityMarkets(state, markets);
  const ids = new Set();
  for (const [index, expected] of state.markets.entries()) {
    const suffix = state.schemaVersion === 'non-sol-market-density-v2' ? 'v2' : 'v1';
    assert.equal(expected.marketId, `${state.systemId}-density-${suffix}-${index + 1}`, 'Invalid density ownership');
    assert.equal(expected.solarSystemId, state.systemId);
    assert.ok(!ids.has(expected.marketId), 'Duplicate density ID');
    ids.add(expected.marketId);
    const matches = markets.filter((m) => m.marketId === expected.marketId);
    assert.ok(matches.length <= 1, 'Duplicate persisted density market');
    if (!matches.length) {
      assert.equal(state.status, 'applying', `Completed density missing market ${expected.marketId}`);
      continue;
    }
    assert.deepEqual(projectToExpectedShape(densityMarketIdentity(matches[0]), expected), expected,
      `Density identity/placement drift: ${expected.marketId}`);
  }
}

module.exports = { densityMarketIdentity, assertBaselineSnapshot, reconcileDensityMarkets, reconcilePreservedDensityMarkets };
