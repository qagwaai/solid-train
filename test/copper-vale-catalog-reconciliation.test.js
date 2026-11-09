'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildCopperValeSeedPlan } = require('../src/model/copper-vale-seed-lifecycle');
const { buildSeededCelestialBodiesForSolarSystem } = require('../src/model/solar-system-celestial-seed');
const { reconcileCopperValeCatalog, assertBodyMatches } = require('../src/model/copper-vale-catalog-reconciliation');

function fixture() {
  const plan = buildCopperValeSeedPlan();
  return { plan, state: { ...plan, status: 'complete', marketVerified: true, verifiedBodyIds: plan.expectedBodyIds },
    catalog: buildSeededCelestialBodiesForSolarSystem(plan.systemId, plan.epoch) };
}

test('pure reconciliation separates seed-owned spatial corruption from valid mutable gameplay/timestamps', () => {
  const { plan, state, catalog } = fixture();
  const actual = structuredClone(plan.bodies);
  actual[0].spatial.epochMs = 1794150805491;
  actual[0].updatedAt = '2026-11-08T15:13:25.491Z';
  actual[1].composition.material = 'fixture-gameplay-change';
  const before = structuredClone(actual);
  const report = reconcileCopperValeCatalog(state, actual, catalog);
  assert.equal(report.sourceVerified, true);
  assert.equal(report.writes, false);
  assert.equal(report.matches, false);
  assert.deepEqual(report.bodies[0].seedOwned, [{
    field: 'spatial.epochMs', expected: 946728000000, actual: 1794150805491, delta: 847422805491,
  }]);
  assert.equal(report.bodies[0].updatedAt.validMutableTimestamp, true);
  assert.equal(report.bodies[1].seedOwned.length, 0);
  assert.equal(report.bodies[1].gameplay.length, 1);
  assertBodyMatches(actual[1], plan.bodies[1]);
  assert.deepEqual(actual, before);
});

test('absent/incomplete/stale checkpoint and changed normal catalog source are explicit refusals', () => {
  const { plan, state, catalog } = fixture();
  for (const changed of [
    null, { ...state, status: 'applying' }, { ...state, marketVerified: false },
    { ...state, revisions: { ...state.revisions, physical: 'changed' } },
    { ...state, hashes: { ...state.hashes, sourceSha256: 'changed' } },
    { ...state, expectedBodies: {} }, { ...state, verifiedBodyIds: [] },
    { ...state, planSha256: 'changed' },
  ]) assert.throws(() => reconcileCopperValeCatalog(changed, plan.bodies, catalog), /checkpoint mismatch/);
  const refreshed = structuredClone(catalog);
  refreshed[1].physicalCatalog.meanRadiusKm += 1;
  assert.throws(() => reconcileCopperValeCatalog(state, plan.bodies, refreshed), /catalog source differs/);
  const currentTime = buildSeededCelestialBodiesForSolarSystem(plan.systemId, '2026-11-08T15:13:25.491Z');
  assert.throws(() => reconcileCopperValeCatalog(state, plan.bodies, currentTime), /catalog source differs/);
});

test('missing bodies and invalid timestamps are not hidden by gameplay allowance', () => {
  const { plan, state, catalog } = fixture();
  const actual = structuredClone(plan.bodies);
  actual[0].updatedAt = 'invalid';
  const report = reconcileCopperValeCatalog(state, actual.slice(0, -1), catalog);
  assert.equal(report.matches, false);
  assert.equal(report.bodies[0].seedOwned[0].field, 'updatedAt');
  assert.ok(report.bodies.at(-1).seedOwned.length > 0);
});
