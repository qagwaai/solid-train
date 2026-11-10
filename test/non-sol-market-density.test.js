'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { allocations, buildDensityPlan, supply, policy } = require('../scripts/lib/non-sol-market-density-plan');
const { parseArguments } = require('../scripts/non-sol-market-density');
const { verifyArtifacts } = require('../scripts/lib/non-sol-bulk-artifacts');
const { sha256 } = require('../src/model/copper-vale-catalog-reconciliation');
const { reconcileDensityMarkets } = require('../src/model/non-sol-market-density-reconciliation');
const { checkpoint } = require('../scripts/lib/non-sol-market-density-lifecycle');
const input = 'artifacts/non-sol-bulk-v1-delivery';
const base = JSON.parse(fs.readFileSync(`${input}/exo-kepler-11.json`, 'utf8'));

test('Hamilton full cohort mix is deterministic, complete and within accepted profile ranges', () => {
  const ids = Array.from({ length: 4843 }, (_, i) => `system-${i}`);
  const result = allocations(ids);
  assert.deepEqual(result, allocations([...ids].reverse()));
  const counts = {};
  for (const a of result.values()) {
    const p = policy.profiles.find((p) => p.id === a.profile);
    assert.ok(a.target >= p.min && a.target <= p.max);
    counts[a.profile] = (counts[a.profile] || 0) + 1;
  }
  assert.deepEqual(counts, { frontier: 1937, developing: 1695, established: 969, 'major-trade-center': 242 });
});

test('16-market target is additive, canonical and physically screened without changing baseline', () => {
  const original = sha256(base);
  const p = buildDensityPlan(base, { profile: 'major-trade-center', target: 16 });
  assert.deepEqual(p, buildDensityPlan(base, { profile: p.profile, target: p.target }));
  assert.equal(p.status, 'ready');
  assert.equal(p.markets.length, 15);
  assert.equal(sha256(base), original);
  assert.equal(new Set(p.markets.map((m) => m.marketId)).size, 15);
  for (const s of p.screens) {
    assert.ok(s.surfaceClearanceKm >= 1000 && s.hillFraction <= 0.1);
    assert.ok(s.moonAndRingGaps.every((g) => g.gapKm >= 1000));
    assert.ok(s.sameHostStationGaps.every((g) => g.gapKm >= 1000));
  }
  const s = supply(p.markets);
  assert.equal(s.stockUnits, 15 * 11920);
  assert.equal(s.restockUnitsPerHour, 15 * 951);
  assert.equal(s.shipsAvailable, 15);
  assert.equal(s.inventoryRows, 15 * 21);
  assert.ok(p.markets.every((m) => m.inventory.length === 21 && m.shipListings.length === 1));
});

test('frontier one adds nothing; impossible placement reports explicit hold, never clamps target', () => {
  assert.equal(buildDensityPlan(base, { profile: 'frontier', target: 1 }).markets.length, 0);
  const noHosts = { ...base, generatedBodies: [], baseBodies: base.baseBodies.filter((b) => b.bodyType === 'star') };
  const p = buildDensityPlan(noHosts, { profile: 'major-trade-center', target: 16 });
  assert.equal(p.status, 'hold');
  assert.equal(p.shortfall, 15);
  assert.equal(p.target, 16);
  assert.throws(() => buildDensityPlan({ ...base, systemId: 'exo-gj-9066' }, { target: 2 }));
});

test('guarded CLI refuses remote/default write targets, absent receipts and input overwrite', () => {
  assert.equal(parseArguments([]).action, 'prepare');
  for (const args of [
    ['--action=apply'], ['--action=dry-run'], ['--target=mongodb://remote:27017/x', '--action=apply'],
    ['--target=mongodb://localhost:27017/solid-train', '--action=apply'],
    [`--out=${input}`], ['--unknown=true'], ['--action=prepare', '--approve=' + 'a'.repeat(64)],
  ]) assert.throws(() => parseArguments(args));
  assert.throws(() => verifyArtifacts(input), /Source guard drift/);
  assert.throws(() => verifyArtifacts(input, 'a'.repeat(64)), /Source guard drift/);
});

test('density reconciliation is exact checkpoint identity, not a prefix whitelist', () => {
  const p = buildDensityPlan(base, { profile: 'developing', target: 3 });
  const state = checkpoint(p, 'guard', 'complete');
  const all = [...p.markets, base.market];
  assert.doesNotThrow(() => reconcileDensityMarkets(state, all, base));
  const bad = structuredClone(all);
  bad[0].trajectory.orbit.semiMajorAxisKm += 1;
  assert.throws(() => reconcileDensityMarkets(state, bad, base), /placement drift/);
  assert.throws(() => reconcileDensityMarkets(state, all.slice(1), base), /missing market/);
  assert.throws(() => reconcileDensityMarkets({ ...state, sourceGuard: 'tampered' }, all, base), /checksum/);
  assert.throws(() => reconcileDensityMarkets(state, p.markets, base), /baseline market/);
});
