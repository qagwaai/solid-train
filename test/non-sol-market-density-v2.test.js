'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { bulkFixture } = require('../test-support/non-sol-bulk-fixture');
const { allocationsV2, buildDensityPlanV2, evidence } = require('../scripts/lib/non-sol-market-density-v2');
const { allocations, peerClearanceEvidence, supply } = require('../scripts/lib/non-sol-market-density-plan');
const { sha256 } = require('../src/model/copper-vale-catalog-reconciliation');
const manifest = require('../data/non-sol-celestial-generation-manifest-v1.json');
const { parseArguments } = require('../scripts/non-sol-market-density');

test('v2 overrides Alpha only for profile allocation; Barnard stays eight and all other hash assignments are stable', () => {
  const ids = manifest.systems.filter((s) => s.id !== 'exo-gj-9066').map((s) => s.id);
  const old = allocations(ids);
  const current = allocationsV2(ids);
  assert.deepEqual(current.get('alpha-centauri'), { profile: 'developing', target: 3 });
  assert.deepEqual(current.get('barnards-star'), { profile: 'established', target: 8 });
  for (const id of ids.filter((id) => id !== 'alpha-centauri')) assert.deepEqual(current.get(id), old.get(id), id);
});

test('Alpha preserves exactly three baseline markets, zero additions and explicitly unresolved existing geometry', async () => {
  const b = await bulkFixture('alpha-centauri');
  const before = sha256(b);
  const plan = await buildDensityPlanV2(b, { profile: 'developing', target: 3 });
  assert.equal(plan.status, 'ready');
  assert.equal(plan.existingMarketCount, 3);
  assert.equal(plan.markets.length, 0);
  assert.equal(plan.shortfall, 0);
  assert.equal(plan.screens.length, 0);
  assert.deepEqual(plan.preservedMarkets.map((m) => m.marketId), ['ac-belt-01', 'ac-proxima-station']);
  assert.equal(plan.legacyGeometryFindings[0].status, 'unresolved-existing-only');
  assert.equal(plan.legacyGeometryFindings[1].surfaceClearanceAtPeriapsisKm, -104140.94);
  assert.equal(sha256(b), before);
  await assert.rejects(buildDensityPlanV2(b, { profile: 'frontier', target: 2 }), /override/);
});

test('Barnard counts both baselines and screens all six additions against the legacy elliptical station', async () => {
  const b = await bulkFixture('barnards-star');
  const plan = await buildDensityPlanV2(b, { profile: 'established', target: 8 });
  assert.equal(plan.status, 'ready');
  assert.equal(plan.existingMarketCount, 2);
  assert.equal(plan.markets.length, 6);
  assert.equal(supply(plan.markets).stockUnits, 6 * 11920);
  for (const [index, screen] of plan.screens.entries()) {
    assert.equal(screen.stationEnvelopeScreens.length, 2 + index);
    assert.ok(screen.stationEnvelopeScreens.every((s) => s.status === 'screened' && s.minimumSeparationKm >= 1000));
    const old = screen.stationEnvelopeScreens.find((s) => s.marketId === 'bs-main-station');
    assert.equal(old.peerPeriapsisKm, 2716);
    assert.equal(old.peerApoapsisKm, 2884);
    assert.equal(old.method, 'common-primary-all-phase-radial-envelopes');
  }
  assert.equal(plan.legacyGeometryFindings[0].surfaceClearanceAtPeriapsisKm, -1871.12);
});

test('elliptical same-host envelope uses apoapsis, and unknown anchor never passes for a proposed addition', () => {
  const host = { id: 'host' };
  const peer = { marketId: 'old', trajectory: { orbit: { anchorBodyId: 'host', semiMajorAxisKm: 10000, eccentricity: 0.5 } } };
  assert.equal(peerClearanceEvidence(host, 14000, [peer], [host])[0].status, 'blocked');
  assert.equal(peerClearanceEvidence(host, 16000, [peer], [host])[0].status, 'screened');
  assert.equal(peerClearanceEvidence(host, 16000, [peer], [])[0].reason, 'unresolved-peer-anchor-or-envelope');
  assert.equal(evidence.readOnly, true);
});

test('persistent CLI selects v2 explicitly, requires a receipt and does not infer a local target or approval', () => {
  const parsed = parseArguments([]);
  assert.equal(parsed.version, 'v2');
  assert.equal(parsed.action, 'prepare');
  assert.match(parsed.out, /non-sol-market-density-v2$/);
  assert.throws(() => parseArguments(['--version=v3']), /Unsupported density version/);
  assert.throws(() => parseArguments(['--version=v2', '--action=apply', '--target=mongodb://localhost:27017/solid-train']), /receipt approval/);
  assert.throws(() => parseArguments(['--action=dry-run']), /explicit local target/);
});
