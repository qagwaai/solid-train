'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const policy = require('../../data/non-sol-market-density-policy-v1.json');
const manifest = require('../../data/non-sol-celestial-generation-manifest-v1.json');
const { sha256 } = require('../../src/model/copper-vale-catalog-reconciliation');
const { screenCircularOrbit } = require('../../src/model/copper-vale-market-density-preview');
const { screeningClone } = require('./non-sol-bulk-generator');
const { MessageHandlerContext } = require('../../src/handlers/message-handler-context');
const { createSeedMarketPayload } = require('../../src/handlers/context/context-bootstrap-service');
const { Market } = require('../../src/db/models');
const { readJournal, atomicWrite, sourceGuard, acquireLock } = require('./non-sol-bulk-artifacts');

function allocations(ids) {
  const ranked = [...ids].sort((a, b) =>
    sha256([policy.version, a]).localeCompare(sha256([policy.version, b])) || a.localeCompare(b));
  const quotas = policy.profiles.map((p, index) => ({ ...p, index,
    count: Math.floor(ids.length * p.percent / 100), remainder: ids.length * p.percent % 100 }));
  let left = ids.length - quotas.reduce((s, p) => s + p.count, 0);
  for (const q of [...quotas].sort((a, b) => b.remainder - a.remainder || a.index - b.index)) {
    if (left-- > 0) q.count++;
  }
  let offset = 0;
  return new Map(quotas.flatMap((p) => ranked.slice(offset, offset += p.count).map((id) =>
    [id, { profile: p.id, target: p.min + parseInt(sha256([id, policy.version, 'total']).slice(0, 8), 16) % (p.max - p.min + 1) }])));
}

function envelope(host, radius) {
  const o = host.orbitalElements;
  assert.ok(o && o.semiMajorAxisKm > 0 && o.eccentricity >= 0 && o.eccentricity < 1, 'Unknown peer orbit');
  return [o.semiMajorAxisKm * (1 - o.eccentricity) - radius,
    o.semiMajorAxisKm * (1 + o.eccentricity) + radius];
}

function peerClearance(host, radius, peers, bodies) {
  return peerClearanceEvidence(host, radius, peers, bodies).every((s) => s.status === 'screened');
}

function peerClearanceEvidence(host, radius, peers, bodies) {
  return peers.map((peer) => {
    const other = bodies.find((b) => b.id === (peer.stationPlacement?.primaryBodyId || peer.trajectory?.orbit?.anchorBodyId));
    const orbit = peer.trajectory?.orbit;
    const r = orbit?.semiMajorAxisKm;
    const e = orbit?.eccentricity;
    const result = { marketId: peer.marketId, anchorBodyId: other?.id || orbit?.anchorBodyId };
    if (!other || !(r > 0) || !(e >= 0 && e < 1))
      return { ...result, status: 'blocked', reason: 'unresolved-peer-anchor-or-envelope' };
    const peerPeriapsisKm = r * (1 - e);
    const peerApoapsisKm = r * (1 + e);
    if (other.id === host.id) {
      const gap = Math.max(peerPeriapsisKm - radius, radius - peerApoapsisKm, 0);
      return { ...result, method: 'same-anchor-all-phase-radial-envelopes', peerPeriapsisKm, peerApoapsisKm,
        minimumSeparationKm: gap, status: gap >= policy.clearanceKm ? 'screened' : 'blocked' };
    }
    if (host.parentBodyId !== other.parentBodyId)
      return { ...result, status: 'blocked', reason: 'unresolved-common-primary' };
    const a = envelope(host, radius);
    const b = envelope(other, peerApoapsisKm);
    const gap = Math.max(a[0] - b[1], b[0] - a[1], 0);
    return { ...result, method: 'common-primary-all-phase-radial-envelopes',
      peerPeriapsisKm, peerApoapsisKm, candidateEnvelopeKm: a, peerEnvelopeKm: b,
      minimumSeparationKm: gap, status: gap >= policy.clearanceKm ? 'screened' : 'blocked' };
  });
}

function buildDensityPlan(base, allocation, options = {}) {
  assert.equal(base.status, 'ready');
  assert.ok(!['sol', 'exo-gj-9066'].includes(base.systemId));
  const profile = policy.profiles.find((p) => p.id === allocation.profile);
  assert.ok(profile && Number.isInteger(allocation.target) &&
    allocation.target >= profile.min && allocation.target <= profile.max, 'Invalid density profile/target');
  const assumptions = [];
  const bodies = [...base.baseBodies, ...base.generatedBodies].map((b) => screeningClone(b, assumptions));
  const byId = new Map(bodies.map((b) => [b.id, b]));
  const peers = [base.market, ...(options.existing || [])];
  const existingCount = peers.length;
  const markets = [];
  const screens = [];
  const rejected = {};
  const context = new MessageHandlerContext({ databaseService: {}, log: () => {}, getCurrentTimestamp: () => policy.epoch });
  // Generated hosts first; fully specified catalog hosts are a bounded fallback.
  // Never replace a catalog host's missing physical constraints with analog values.
  const hosts = [...base.generatedBodies, ...base.baseBodies].filter((b) => b.bodyType === 'planet' &&
    b.physicalCatalog?.meanRadiusKm > 0 && b.physicalCatalog?.massKg > 0);
  for (const host of hosts) {
    const star = byId.get(host.parentBodyId);
    if (!star) continue;
    for (let attempt = 0; attempt < policy.attemptsPerHost && peers.length < allocation.target; attempt++) {
      const radius = host.physicalCatalog.meanRadiusKm + policy.clearanceKm + attempt * policy.radiusStepKm;
      try {
        const screen = screenCircularOrbit({ host, starMassKg: star.physicalCatalog.massKg,
          radiusKm: radius, bodies, peerStations: peers.map((peer) => ({
            ...peer, stationPlacement: peer.stationPlacement || { primaryBodyId: peer.trajectory?.orbit?.anchorBodyId }
          })), epoch: policy.epoch });
        if (screen.status !== 'screened' || !peerClearance(host, radius, peers, bodies)) {
          const reason = screen.failures.join(',') || 'other-station-envelope';
          rejected[reason] = (rejected[reason] || 0) + 1;
          if (screen.failures.includes('orbit-exceeds-0.1-periapsis-hill-radius')) break;
          continue;
        }
        const ordinal = markets.length + 1;
        const role = policy.roles[(ordinal - 1) % policy.roles.length];
        const suffix = options.version === 'non-sol-market-density-v2' ? 'v2' : 'v1';
        const station = { marketId: `${base.systemId}-density-${suffix}-${ordinal}`, solarSystemId: base.systemId,
          marketName: `${base.market.marketName.replace(/ Initial Exchange$/, '')} ${role} ${ordinal}`,
          siteName: `${host.displayName} ${role} ${ordinal}`, siteType: 'station', isStarterMarket: false,
          priceMultiplier: 1, driftPercentPerHour: 4, restockIntervalMinutes: 60,
          stationPlacement: { ...screen.placement, provenance: options.version || policy.version,
            reason: 'Screened hypothetical density station; descriptive role only.' },
          trajectory: { kind: 'orbital-elements', orbit: screen.orbit }, spatial: screen.spatial };
        const market = createSeedMarketPayload(context, station, policy.epoch);
        assert.ifError(new Market(market).validateSync());
        markets.push(market);
        peers.push(market);
        screens.push({ marketId: market.marketId, ...screen.clearance, peerMarketIds: peers.slice(0, -1).map((m) => m.marketId),
          ...(options.version ? { stationEnvelopeScreens: peerClearanceEvidence(host, radius, peers.slice(0, -1), bodies) } : {}) });
      } catch (error) {
        rejected[`unknown-geometry:${error.message}`] = (rejected[`unknown-geometry:${error.message}`] || 0) + 1;
        break;
      }
    }
    if (peers.length === allocation.target) break;
  }
  const payload = { schemaVersion: options.version || policy.version, systemId: base.systemId, ...allocation,
    ...(options.version ? { existingMarketCount: existingCount, preservedMarkets: options.existing || [],
      legacyGeometryFindings: options.legacyGeometryFindings || [],
      baselineEvidenceSha256: options.baselineEvidenceSha256 } : {}),
    baselinePlanSha256: base.planSha256, baselineMarketId: base.market.marketId,
    status: peers.length === allocation.target ? 'ready' : 'hold',
    shortfall: Math.max(0, allocation.target - peers.length), markets, screens, rejected, assumptions };
  return { ...payload, planSha256: sha256(payload) };
}

function supply(markets) {
  const result = { markets: 0, inventoryRows: 0, stockUnits: 0, maxStockUnits: 0,
    restockUnitsPerHour: 0, shipListingRows: 0, shipsAvailable: 0, shipStarterInventoryUnits: 0, byItem: {} };
  for (const m of markets) {
    result.markets++;
    result.inventoryRows += m.inventory.length;
    for (const i of m.inventory) {
      const row = result.byItem[i.itemId] ||= { stock: 0, maxStock: 0, restockPerHour: 0 };
      row.stock += i.stock; row.maxStock += i.maxStock;
      row.restockPerHour += i.restockPerInterval * 60 / m.restockIntervalMinutes;
      result.stockUnits += i.stock; result.maxStockUnits += i.maxStock;
      result.restockUnitsPerHour += i.restockPerInterval * 60 / m.restockIntervalMinutes;
    }
    result.shipListingRows += m.shipListings.length;
    result.shipsAvailable += m.shipListings.reduce((s, i) => s + i.quantityAvailable, 0);
    result.shipStarterInventoryUnits += m.shipListings.reduce((s, i) => s + i.quantityAvailable *
      i.starterInventory.reduce((n, item) => n + item.quantity, 0), 0);
  }
  return result;
}

// Immutable accepted input validation, deliberately NOT a claim that the old broad source guard matches.
function acceptedInputs(input) {
  const header = JSON.parse(fs.readFileSync(path.join(input, 'header.json'), 'utf8'));
  const records = readJournal(input);
  assert.deepEqual(records.map((r) => r.systemId), manifest.systems.map((s) => s.id), 'Full accepted cohort required');
  assert.equal(header.manifestSha256, manifest.manifestSha256);
  assert.equal(records.filter((r) => r.status === 'ready').length, 4843);
  return { header, records };
}

function readAccepted(input, record) {
  const base = JSON.parse(fs.readFileSync(path.join(input, `${record.systemId}.json`), 'utf8'));
  assert.equal(sha256(base), record.artifactSha256, 'Accepted artifact checksum mismatch');
  if (base.status === 'ready') {
    const { planSha256, ...payload } = base;
    assert.equal(sha256(payload), planSha256, 'Accepted plan checksum mismatch');
  }
  return base;
}

async function prepareDensity(input, out, options = {}) {
  assert.notEqual(path.resolve(input), path.resolve(out), 'Never overwrite accepted artifacts');
  const v2 = options.version === 'v2' ? require('./non-sol-market-density-v2') : null;
  const version = v2 ? v2.policy.version : policy.version;
  const reportFile = path.join(out, 'offline-report.json');
  if (fs.existsSync(reportFile)) assert.equal(JSON.parse(fs.readFileSync(reportFile, 'utf8')).schemaVersion, version,
    'Different version evidence must never be overwritten');
  fs.mkdirSync(out, { recursive: true });
  const lock = path.join(out, '.prepare.lock');
  const fd = acquireLock(lock);
  try {
    const { header, records } = acceptedInputs(input);
    const guard = sourceGuard();
    const migration = { oldSourceGuard: header.sourceGuard, currentSourceGuard: guard,
      acceptedJournalSha256: records.at(-1).recordSha256 };
    const allocation = (v2 ? v2.allocationsV2 : allocations)(records.filter((r) => r.status === 'ready').map((r) => r.systemId));
    const report = { schemaVersion: version, action: 'offline-full-cohort', databaseWrites: 0,
      scope: 4843, protectedCopperValeMarkets: 6, assumptions: [...policy.assumptions, ...(v2 ? v2.policy.assumptions : [])], profileCounts: {},
      profileTotals: {}, targetHistogram: {}, holds: [], baselineMarkets: 0, addedMarkets: 0, targetMarkets: 0,
      sourceMigration: migration, sourceMigrationApprovalSha256: sha256(migration),
      baselineReconciliationHolds: v2 ? [] : manifest.systems.filter((s) => s.id !== 'exo-gj-9066' && s.markets.length)
        .map((s) => ({ systemId: s.id, existingNonBulkMarketIds: s.markets.map((m) => m.id),
          status: 'conditional-target-hold',
          acceptedBulkBaseline: 1, preservedBaselineIfPresent: 1 + s.markets.length,
          selectedTarget: allocation.get(s.id).target,
          excessPreservedBaseline: Math.max(0, 1 + s.markets.length - allocation.get(s.id).target),
          reason: 'If present on target, preserve and hold for owner-reviewed total-count and clearance reconciliation; no automatic adoption/deletion.' })),
      deploymentApproved: false, targetPreflightRun: false,
      deploymentStatus: v2 ? 'STOPPED: owner source-migration and full-target receipt approval required; legacy defects preserved explicitly, not repaired or certified' :
        'STOPPED: owner density/source-migration approval required; known Alpha/Barnard baseline markets require target reconciliation if present',
      sourceGuard: guard, input: path.resolve(input), artifacts: [] };
    if (v2) {
      report.policyOverrides = v2.policy.overrides;
      report.baselineEvidence = v2.evidence;
      report.baselineEvidenceSha256 = sha256(v2.evidence);
      report.legacyGeometryFindings = v2.evidence.legacyGeometryFindings;
      const replay = JSON.parse(fs.readFileSync(path.join(out, 'semantic-replay.json'), 'utf8'));
      const { reportSha256, ...payload } = replay;
      assert.equal(sha256(payload), reportSha256, 'Semantic replay checksum mismatch');
      assert.equal(replay.sourceGuard, guard, 'Semantic replay source drift');
      assert.equal(replay.acceptedJournalSha256, migration.acceptedJournalSha256);
      assert.equal(replay.verifiedSystems, 4843);
      assert.equal(replay.mismatches.length, 0, 'Semantic generation replay mismatch');
      assert.deepEqual(replay.preservation, header.preservation, 'Pilot output drift');
      report.semanticReplaySha256 = reportSha256;
    }
    const baseline = []; const additions = [];
    for (const record of records) {
      const base = readAccepted(input, record);
      if (base.status !== 'ready') continue;
      const plan = (v2 ? v2.buildDensityPlanV2 : buildDensityPlan)(base, allocation.get(base.systemId));
      const file = path.join(out, `${base.systemId}.json`);
      if (fs.existsSync(file)) assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), plan, 'Density resume source drift');
      else atomicWrite(file, plan);
      report.artifacts.push({ systemId: plan.systemId, planSha256: plan.planSha256 });
      report.profileCounts[plan.profile] = (report.profileCounts[plan.profile] || 0) + 1;
      const totals = report.profileTotals[plan.profile] ||= { systems: 0, baseline: 0, target: 0, added: 0, shortfall: 0 };
      const baselineCount = plan.existingMarketCount || 1;
      totals.systems++; totals.baseline += baselineCount; totals.target += plan.target;
      totals.added += plan.markets.length; totals.shortfall += plan.shortfall;
      report.targetHistogram[plan.target] = (report.targetHistogram[plan.target] || 0) + 1;
      if (plan.status !== 'ready') report.holds.push({ systemId: plan.systemId, shortfall: plan.shortfall, rejected: plan.rejected });
      report.baselineMarkets += baselineCount; report.addedMarkets += plan.markets.length; report.targetMarkets += plan.target;
      baseline.push(base.market); additions.push(...plan.markets);
      if (v2) {
        const context = new MessageHandlerContext({ databaseService: {}, log: () => {}, getCurrentTimestamp: () => policy.epoch });
        baseline.push(...plan.preservedMarkets.map((m) => createSeedMarketPayload(context, m, policy.epoch)));
      }
      if (report.baselineMarkets % 100 === 0) await new Promise((resolve) => setImmediate(resolve));
      if (report.baselineMarkets % 500 === 0) console.log(`DENSITY_PROGRESS ${report.baselineMarkets}/4843`);
    }
    report.supply = { baseline: supply(baseline), added: supply(additions), combined: supply([...baseline, ...additions]),
      note: v2 ? 'Baseline includes three inspected legacy Alpha/Barnard markets; their observed stock matched canonical values at inspection. These are canonical capacity/initial-supply figures, not a promise of future live stock. Excludes Copper Vale and Sol. Restock capped by maxStock; ships are not hourly production.' :
        'Accepted bulk-artifact canonical baseline only, not a snapshot of live stocks; excludes Copper Vale and non-bulk baseline markets. Known Alpha/Barnard extras are explicit target reconciliation holds. Restock is capped by maxStock, ships are initial listings, not automatic hourly ship production.' };
    assert.equal(sourceGuard(), guard, 'Sources changed during offline planning');
    const final = { ...report, reportSha256: sha256(report) };
    atomicWrite(path.join(out, 'offline-report.json'), final);
    return final;
  } finally { fs.closeSync(fd); fs.unlinkSync(lock); }
}

module.exports = { policy, allocations, buildDensityPlan, peerClearance, peerClearanceEvidence, supply, acceptedInputs, readAccepted, prepareDensity };
