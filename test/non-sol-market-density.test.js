'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { bulkFixture } = require('../test-support/non-sol-bulk-fixture');
const { allocations, buildDensityPlan, supply, policy } = require('../scripts/lib/non-sol-market-density-plan');
const { parseArguments } = require('../scripts/non-sol-market-density');
const { verifyArtifacts } = require('../scripts/lib/non-sol-bulk-artifacts');
const { sha256 } = require('../src/model/copper-vale-catalog-reconciliation');
const { reconcileDensityMarkets } = require('../src/model/non-sol-market-density-reconciliation');
const { checkpoint } = require('../scripts/lib/non-sol-market-density-lifecycle');
const { Market } = require('../src/db/models');
const input = 'artifacts/non-sol-bulk-v1-delivery';
let base;
test.before(async () => { base = await bulkFixture('exo-kepler-11'); });

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

test('16-market target is additive, canonical and physically screened without changing baseline', async () => {
  const original = sha256(base);
  const p = await buildDensityPlan(base, { profile: 'major-trade-center', target: 16 });
  assert.deepEqual(p, await buildDensityPlan(base, { profile: p.profile, target: p.target }));
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

test('frontier one adds nothing; impossible placement reports explicit hold, never clamps target', async () => {
  assert.equal((await buildDensityPlan(base, { profile: 'frontier', target: 1 })).markets.length, 0);
  const noHosts = { ...base, generatedBodies: [], baseBodies: base.baseBodies.filter((b) => b.bodyType === 'star') };
  const p = await buildDensityPlan(noHosts, { profile: 'major-trade-center', target: 16 });
  assert.equal(p.status, 'hold');
  assert.equal(p.shortfall, 15);
  assert.equal(p.target, 16);
  await assert.rejects(buildDensityPlan({ ...base, systemId: 'exo-gj-9066' }, { target: 2 }));
});

test('density planning awaits market validation and records a rejected placement', async (t) => {
  const validation = t.mock.method(Market.prototype, 'validate', async () => {
    throw new Error('validation failed');
  });
  const plan = await buildDensityPlan(base, { profile: 'developing', target: 3 });
  assert.ok(validation.mock.callCount() > 0);
  assert.equal(plan.status, 'hold');
  assert.ok(plan.rejected['unknown-geometry:validation failed'] > 0);
});

test('guarded CLI refuses remote/default write targets, absent receipts and input overwrite', () => {
  assert.equal(parseArguments([]).action, 'prepare');
  for (const args of [
    ['--action=apply'], ['--action=dry-run'], ['--target=mongodb://remote:27017/x', '--action=apply'],
    ['--target=mongodb://localhost:27017/solid-train', '--action=apply'],
    [`--out=${input}`], ['--unknown=true'], ['--action=prepare', '--approve=' + 'a'.repeat(64)],
  ]) assert.throws(() => parseArguments(args));
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'density-guard-'));
  try {
    fs.writeFileSync(path.join(out, 'header.json'), JSON.stringify({ sourceGuard: 'outdated' }));
    const record = { systemId: 'fixture', previous: null };
    fs.writeFileSync(path.join(out, 'progress.jsonl'), JSON.stringify({ ...record, recordSha256: sha256(record) }) + '\n');
    assert.throws(() => verifyArtifacts(out), /Source guard drift/);
    assert.throws(() => verifyArtifacts(out, 'a'.repeat(64)), /Source guard drift/);
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});

test('density reconciliation is exact checkpoint identity, not a prefix whitelist', async () => {
  const p = await buildDensityPlan(base, { profile: 'developing', target: 3 });
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
