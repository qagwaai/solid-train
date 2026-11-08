'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const policy = require('../data/non-sol-scientific-policy-v2.json');
const legacyPolicy = require('../data/non-sol-scientific-policy-v1.json');
const {
  previewExpandedNonSolSystem, validateExpandedPreview, countBodies, planetCandidate,
} = require('../src/model/non-sol-expanded-augmentation');
const {
  stream, makeBody, density, stellarRejection, moonRejection, orbitEnvelope,
  hillRadiusKm, fluidRocheKm, equilibriumTemperatureK,
} = require('../src/model/non-sol-augmentation');
const { buildSeededCelestialBodiesForSolarSystem } = require('../src/model/solar-system-celestial-seed');
const { validateCelestialBody } = require('../src/model/celestial-body-validation');
const { AU_KM, orbitalPeriodSecFromAu } = require('../src/model/procedural-system-generator');
const { parseArgs, buildReport } = require('../scripts/non-sol-celestial-preview');

const bounds = { ...legacyPolicy.bounds, ...policy.bounds };
const original = previewExpandedNonSolSystem('exo-gj-9066');
const allBodies = [...original.baseBodies, ...original.generatedBodies];
const star = original.baseBodies.find((body) => body.bodyType === 'star');

test('all five expanded pilots preserve exact baseline and blockers, not false completion', () => {
  const report = buildReport(parseArgs(['--expanded']));
  assert.equal(report.targetCount, 5);
  assert.equal(report.validPreviews, 1);
  assert.equal(report.blockedPreviews, 4);
  assert.equal(report.occurrenceCalibrated, false);
  assert.equal(report.runtimeEnabled, false);
  assert.equal(report.databaseWrites, false);
  assert.deepEqual(report.summary.map((row) => row.systemId), [...policy.scope].sort());
  assert.equal(report.counts.existing.total, 20);
  assert.deepEqual(report.counts.existing.byType, {
    star: 7, 'black-hole': 1, planet: 12, 'dwarf-planet': 0,
    moon: 0, asteroid: 0, tno: 0, comet: 0,
  });
  for (const preview of report.details) {
    assert.deepEqual(preview.baseBodies,
      buildSeededCelestialBodiesForSolarSystem(preview.systemId, policy.epoch));
    assert.equal(preview.coverage.playableMiningVerified, false);
    assert.equal(preview.coverage.stationVerified, false);
    assert.deepEqual(preview.familyBlockers.map((entry) => entry.family).sort(),
      Object.keys(policy.familyBlockers).sort());
    if (policy.systemExclusions[preview.systemId]) {
      assert.equal(preview.generatedBodies.length, 0);
      assert.equal(preview.ringProposals.length, 0);
      assert.equal(preview.populationDescriptors.length, 0);
      assert.equal(preview.status, 'blocked');
      assert.ok(preview.exclusions.some((entry) => entry.code === policy.systemExclusions[preview.systemId].code));
      assert.ok(preview.exclusions.some((entry) => entry.code === 'REQUIRED_ASTEROID_COVERAGE_BLOCKED'));
    }
  }
  assert.equal(report.counts.combined.planetAppearances['hot-jupiter'], 4,
    'HR 8799 appearance stays preserved, not silently corrected');
});

test('expanded report accounts for existing, additions and combined types, subclasses and separate structures', () => {
  const report = buildReport(parseArgs(['--expanded']));
  for (const stage of ['existing', 'additions', 'combined']) {
    const counts = report.counts[stage];
    assert.equal(Object.values(counts.byType).reduce((a, b) => a + b, 0), counts.total);
    assert.equal(Object.values(counts.planetAppearances).reduce((a, b) => a + b, 0), counts.byType.planet);
    assert.equal(Object.values(counts.moonAppearances).reduce((a, b) => a + b, 0), counts.byType.moon);
    for (const type of Object.keys(counts.byType))
      assert.equal(counts.byType[type], report.summary.reduce((sum, row) => sum + row.bodyCounts[stage].byType[type], 0));
  }
  for (const type of Object.keys(report.counts.combined.byType))
    assert.equal(report.counts.combined.byType[type], report.counts.existing.byType[type] + report.counts.additions.byType[type]);
  assert.equal(report.structures.proposedRings, report.details.reduce((sum, preview) => sum + preview.ringProposals.length, 0));
  assert.equal(report.structures.proposedPopulations, report.details.reduce((sum, preview) => sum + preview.populationDescriptors.length, 0));
  const { reportSha256, ...content } = report;
  assert.equal(reportSha256, createHash('sha256').update(JSON.stringify(content)).digest('hex'));
  assert.deepEqual(buildReport(parseArgs(['--expanded'])), report);
  const persisted = JSON.parse(JSON.stringify(report));
  assert.deepEqual(persisted, report, 'Persisted report must match in-memory output without undefined fields');
  for (const preview of persisted.details) assert.equal(validateExpandedPreview(preview), true);
});

test('expanded candidate generator covers calibrated physical planet regimes without forcing every family into pilot', () => {
  const seen = new Set();
  const rng = stream('candidate-calibration', star.id, 'planet-physical');
  for (let index = 0; index < 1000; index++) {
    const candidate = planetCandidate(rng, star, [AU_KM, 10 * AU_KM]);
    assert.ok(candidate.massKg / 5.9722e24 >= bounds.planetMassEarth[0]);
    assert.ok(candidate.massKg / 5.9722e24 <= bounds.planetMassEarth[1]);
    assert.ok(Math.abs(density(candidate.massKg, candidate.radiusKm) / candidate.densityKgM3 - 1) < 1e-12);
    assert.ok(candidate.densityKgM3 >= bounds.planetDensityKgM3[0]);
    assert.ok(candidate.densityKgM3 <= bounds.planetDensityKgM3[1]);
    seen.add(candidate.surfaceArchetype);
    const body = makeBody('exo-gj-9066', star, 'planet', `calibration-${index}`, candidate,
      '0'.repeat(64), policy.epoch, policy);
    assert.ok(validateCelestialBody(body), JSON.stringify(validateCelestialBody.errors));
  }
  for (const family of ['rocky', 'super-earth', 'sub-neptune', 'ice-giant', 'gas-giant'])
    assert.ok(seen.has(family), `No physical calibration example of ${family}`);
  assert.ok(original.generatedBodies.some((body) => body.surfaceArchetype === 'super-earth'));
  assert.ok(original.generatedBodies.some((body) => body.surfaceArchetype === 'sub-neptune'));
  assert.equal(original.counts.additions.planetAppearances['hot-jupiter'], 0);
});

test('expanded pilot meets provisional actual-count and giant-host moon thresholds, not just requested counts', () => {
  const counts = original.counts.additions.byType;
  assert.ok(counts.planet <= policy.budgets.planets[1]);
  assert.ok(counts.asteroid >= policy.budgets.asteroids[0] && counts.asteroid <= policy.budgets.asteroids[1]);
  assert.ok(counts.comet <= policy.budgets.comets[1]);
  assert.ok(counts.tno + counts['dwarf-planet'] <= policy.budgets.outerMinorBodies[1]);
  assert.ok(counts['dwarf-planet'] <= policy.budgets.dwarfSubset);
  assert.ok(counts.tno > 0);
  assert.ok(original.counts.additions.planetAppearances['gas-giant'] <= policy.budgets.additionalGiants);
  const knownGiant = original.baseBodies.find((body) => body.bodyType === 'planet');
  const giantMoons = original.generatedBodies.filter((body) => body.bodyType === 'moon' && body.parentBodyId === knownGiant.id);
  assert.ok(giantMoons.length > 4 && giantMoons.length <= policy.budgets.moonsPerGiant[1]);
  for (const host of allBodies.filter((body) => ['planet', 'dwarf-planet'].includes(body.bodyType))) {
    const moons = original.generatedBodies.filter((body) => body.bodyType === 'moon' && body.parentBodyId === host.id);
    const isGiant = ['gas-giant', 'ice-giant', 'super-jupiter'].includes(host.surfaceArchetype);
    assert.ok(moons.length <= (isGiant ? policy.budgets.moonsPerGiant[1] : policy.budgets.moonsPerOtherHost[1]));
    assert.ok(moons.reduce((sum, body) => sum + body.physicalCatalog.massKg, 0) <= host.physicalCatalog.massKg * bounds.satelliteMassFraction);
  }
});

test('expanded generated bodies pass canonical schemas, numeric physics, source, epoch and ownership requirements', () => {
  const byId = new Map(allBodies.map((body) => [body.id, body]));
  for (const body of original.generatedBodies) {
    assert.ok(validateCelestialBody(body), JSON.stringify(validateCelestialBody.errors));
    const parent = byId.get(body.parentBodyId);
    assert.equal(body.orbitalElements.anchorBodyId, parent.id);
    const period = orbitalPeriodSecFromAu(body.orbitalElements.semiMajorAxisKm / AU_KM,
      body.physicalCatalog.massKg + parent.physicalCatalog.massKg);
    assert.ok(Math.abs(body.orbitalElements.orbitalPeriodSec / period - 1) < 1e-8);
    assert.equal(body.physical.estimatedMassKg, body.physicalCatalog.massKg);
    assert.equal(body.physical.estimatedDiameterM, body.physicalCatalog.meanRadiusKm * 2000);
    assert.equal(body.universeMetadata.generation.sourceSha256, original.sourceSha256);
    assert.equal(body.universeMetadata.provenance.origin, 'hypothetical');
    assert.equal(body.universeMetadata.generation.generatorVersion, policy.version);
    if (body.bodyType === 'tno') {
      assert.equal(body.surfaceArchetype, 'icy-moon');
      assert.equal(body.universeMetadata.population, undefined, 'P1 population contract only supports asteroid/comet members');
      assert.ok(body.orbitalElements.semiMajorAxisKm / AU_KM >= bounds.outerMinAxisAu);
    }
    const record = original.evidence.find((entry) => entry.bodyId === body.id);
    const candidate = {
      radiusKm: body.physicalCatalog.meanRadiusKm, massKg: body.physicalCatalog.massKg,
      densityKgM3: record.densityKgM3, orbit: body.orbitalElements,
      icy: body.physicalCatalog.compositionTags.includes('ice'),
    };
    if (body.bodyType === 'moon') {
      const siblings = original.generatedBodies.filter((entry) => entry.bodyType === 'moon' &&
        entry.parentBodyId === parent.id && entry.id !== body.id);
      const ring = original.ringProposals.find((entry) => entry.hostBodyId === parent.id);
      assert.equal(moonRejection(candidate, parent, star, siblings,
        siblings.reduce((sum, entry) => sum + entry.physicalCatalog.massKg, 0),
        ring?.rings.outerRadiusKm || parent.rings?.outerRadiusKm || 0, bounds), null);
    } else {
      const peers = allBodies.filter((entry) => ['planet', 'dwarf-planet'].includes(entry.bodyType) &&
        entry.parentBodyId === star.id && entry.id !== body.id);
      assert.equal(stellarRejection(candidate, body.bodyType, star, peers, bounds), null);
    }
  }
  for (const ring of original.ringProposals) {
    const host = byId.get(ring.hostBodyId);
    assert.equal(host.rings, undefined);
    assert.ok(ring.rings.innerRadiusKm >= host.physicalCatalog.meanRadiusKm * 1.2);
    assert.ok(ring.rings.outerRadiusKm > ring.rings.innerRadiusKm);
    assert.ok(ring.rings.outerRadiusKm <= fluidRocheKm(host.physicalCatalog.meanRadiusKm,
      density(host.physicalCatalog.massKg, host.physicalCatalog.meanRadiusKm), 1000) * 0.9);
    assert.ok(ring.rings.outerRadiusKm <= hillRadiusKm(host.orbitalElements, host.physicalCatalog.massKg,
      star.physicalCatalog.massKg) * bounds.ringHillFraction);
    assert.ok(equilibriumTemperatureK(star.luminositySolar, orbitEnvelope(host.orbitalElements).periapsisKm) <= bounds.maxIceTemperatureK);
  }
});

test('expanded identity, physical families and relative trajectories are deterministic across epochs', () => {
  assert.deepEqual(previewExpandedNonSolSystem('exo-gj-9066'), original);
  const later = previewExpandedNonSolSystem('exo-gj-9066', { epoch: '2026-11-07T00:00:00.000Z' });
  assert.deepEqual(later.generatedBodies.map((body) => [body.id, body.physicalCatalog, body.orbitalElements]),
    original.generatedBodies.map((body) => [body.id, body.physicalCatalog, body.orbitalElements]));
  assert.notDeepEqual(later.generatedBodies[0].spatial, original.generatedBodies[0].spatial);
  assert.equal(validateExpandedPreview(later), true);
});

test('expanded replay validation rejects tampered counts, provenance, orbit, physical output, structures and blocker claims', () => {
  for (const mutate of [
    (preview) => { preview.counts.combined.total++; },
    (preview) => { preview.baseBodies[0].displayName = 'Changed'; },
    (preview) => { preview.generatedBodies[0].physicalCatalog.massKg *= 2; },
    (preview) => { preview.generatedBodies[0].orbitalElements.orbitalPeriodSec *= 2; },
    (preview) => { preview.generatedBodies[0].spatial.positionKm.x++; },
    (preview) => { preview.generatedBodies[0].surfaceArchetype = 'ocean'; },
    (preview) => { preview.generatedBodies[0].universeMetadata.provenance.origin = 'catalog'; },
    (preview) => { preview.ringProposals[0].rings.outerRadiusKm *= 100; },
    (preview) => { preview.populationDescriptors = []; },
    (preview) => { preview.familyBlockers = []; },
    (preview) => { preview.runtimeEnabled = true; },
    (preview) => { preview.occurrenceCalibrated = true; },
    (preview) => { preview.status = 'blocked'; },
    (preview) => { preview.outputSha256 = '0'.repeat(64); },
  ]) {
    const invalid = structuredClone(original);
    mutate(invalid);
    assert.throws(() => validateExpandedPreview(invalid), /replay/);
  }
  const blocked = previewExpandedNonSolSystem('exo-hr-8799');
  blocked.exclusions = [];
  assert.throws(() => validateExpandedPreview(blocked), /replay/);
  assert.equal(validateExpandedPreview(original), true);
});

test('expanded CLI stays opt-in and scoped while historical v1 retains its four-system behavior', () => {
  const historical = buildReport(parseArgs([]));
  assert.equal(historical.schemaVersion, 'non-sol-preview-report-v1');
  assert.equal(historical.targetCount, 4);
  assert.equal(historical.validPreviews, 2);
  assert.equal(historical.blockedPreviews, 2);
  assert.equal(historical.counts, undefined);
  for (const args of [['--expanded', '--all'], ['--expanded', '--expanded']])
    assert.throws(() => parseArgs(args));
  assert.throws(() => buildReport({ ...parseArgs(['--expanded']), all: true }), /not authorized/);
  for (const system of ['sol', 'sirius', 'missing', 'Alpha-Centauri'])
    assert.throws(() => previewExpandedNonSolSystem(system), /five approved/);
  for (const epoch of ['bad-date', '2026-11-07', '2026-11-07T00:00:00Z'])
    assert.throws(() => previewExpandedNonSolSystem('exo-gj-9066', { epoch }), /epoch/);
  const result = spawnSync(process.execPath, [
    path.resolve(__dirname, '..', 'scripts', 'non-sol-celestial-preview.js'),
    '--expanded', '--system', 'exo-gj-9066',
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /existing=.*combined=/);
  assert.match(result.stdout, /not observed composition/);
  assert.deepEqual(countBodies([]).byType, {
    star: 0, 'black-hole': 0, planet: 0, 'dwarf-planet': 0,
    moon: 0, asteroid: 0, tno: 0, comet: 0,
  });
});
