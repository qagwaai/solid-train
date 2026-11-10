'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { spawnSync } = require('node:child_process');
const {
  previewNonSolSystem,
  validatePreview,
  hillRadiusKm,
  fluidRocheKm,
  equilibriumTemperatureK,
  clearingDiscriminant,
  density,
  massFromDensity,
  stream,
  stellarRejection,
  moonRejection,
} = require('../src/model/non-sol-augmentation');
const {
  buildSeededCelestialBodiesForSolarSystem,
} = require('../src/model/solar-system-celestial-seed');
const { getSolarSystemRegistry } = require('../src/model/solar-system-registry');
const { parseArgs, buildReport, publishReport } = require('../scripts/non-sol-celestial-preview');
const policy = require('../data/non-sol-scientific-policy-v1.json');

test('analytic calibration matches numerical Earth/Sun reference values and dimensional identities', () => {
  assert.ok(Math.abs(equilibriumTemperatureK(1, 149597870.7) - 271.094) < 0.01);
  assert.ok(
    Math.abs(
      hillRadiusKm({ semiMajorAxisKm: 149597870.7, eccentricity: 0.0167 }, 5.9722e24, 1.98847e30) /
        1471580 -
        1
    ) < 0.002
  );
  assert.equal(fluidRocheKm(100, 1000, 1000), 244);
  assert.ok(Math.abs(clearingDiscriminant(5.9722e24, 149597870.7, 1.98847e30) - 807) < 1e-10);
  assert.ok(Math.abs(density(massFromDensity(500, 1800), 500) - 1800) < 1e-10);
});

test('preview is deterministic, RNG streams are purpose-isolated and epochs do not change identity/physical families', () => {
  const first = previewNonSolSystem('exo-gj-9066');
  assert.deepEqual(previewNonSolSystem('exo-gj-9066'), first);
  const later = previewNonSolSystem('exo-gj-9066', { epoch: '2026-11-01T00:00:00.000Z' });
  assert.deepEqual(
    later.generatedBodies.map((b) => [b.id, b.physicalCatalog, b.orbitalElements]),
    first.generatedBodies.map((b) => [b.id, b.physicalCatalog, b.orbitalElements])
  );
  assert.notDeepEqual(later.generatedBodies[0].spatial, first.generatedBodies[0].spatial);
  const a = stream('system', 'parent', 'moon:slot-01');
  const b = stream('system', 'parent', 'moon:slot-01');
  const unrelated = stream('system', 'parent', 'comet:slot-01');
  unrelated();
  unrelated();
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
});

test('four selected pilots preserve the catalog and disclose unresolved binary/remnant models', () => {
  for (const id of ['alpha-centauri', 'barnards-star', 'exo-gj-9066', 'cygnus-x1']) {
    const preview = previewNonSolSystem(id);
    assert.deepEqual(
      preview.baseBodies,
      buildSeededCelestialBodiesForSolarSystem(id, policy.epoch)
    );
    assert.equal(preview.runtimeEnabled, false);
    assert.equal(preview.databaseWrites, false);
    assert.equal(preview.coverage.playableMiningVerified, false);
    assert.equal(preview.coverage.stationVerified, false);
    if (['alpha-centauri', 'cygnus-x1'].includes(id)) {
      assert.equal(preview.status, 'blocked');
      assert.equal(preview.generatedBodies.length, 0);
      assert.ok(preview.exclusions.some((e) => e.code === 'REQUIRED_ASTEROID_COVERAGE_BLOCKED'));
    } else {
      assert.equal(preview.status, 'preview-valid');
      assert.ok(preview.coverage.representativeAsteroids >= 1);
    }
    for (const body of preview.generatedBodies) {
      assert.equal(body.universeMetadata.provenance.origin, 'hypothetical');
      assert.equal(body.universeMetadata.naming.lane, 'systematic');
      assert.deepEqual(body.universeMetadata.naming.aliases, []);
      assert.equal(
        body.observability.scanState,
        ['asteroid', 'comet'].includes(body.bodyType) ? 'unscanned' : 'scanned'
      );
      if (body.universeMetadata.population)
        assert.equal(body.universeMetadata.population.estimatedTotalCount, null);
    }
  }
});

test('known Sirius B companion blocks augmentation even though the fixture has only Sirius A', () => {
  const preview = previewNonSolSystem('sirius');
  assert.equal(preview.baseBodies.filter((body) => body.bodyType === 'star').length, 1);
  assert.equal(preview.status, 'blocked');
  assert.equal(preview.generatedBodies.length, 0);
  assert.ok(
    preview.exclusions.some(
      (entry) =>
        entry.code === 'KNOWN_COMPANION_MODEL_REQUIRED' &&
        entry.source === 'https://esahubble.org/news/heic0516/'
    )
  );
  assert.deepEqual(
    preview.baseBodies,
    buildSeededCelestialBodiesForSolarSystem('sirius', policy.epoch)
  );
});

test('validator checks exact physical, orbit, coverage and immutable baseline requirements', () => {
  const original = previewNonSolSystem('barnards-star');
  const mutations = [
    (p) => {
      p.baseBodies[0].displayName = 'Renamed';
    },
    (p) => {
      p.generatedBodies[0].physicalCatalog.massKg *= 2;
    },
    (p) => {
      p.generatedBodies[0].physical.estimatedDiameterM *= 2;
    },
    (p) => {
      p.generatedBodies[0].orbitalElements.orbitalPeriodSec *= 2;
    },
    (p) => {
      p.generatedBodies[0].spatial.positionKm.x += 1;
    },
    (p) => {
      p.generatedBodies[0].orbitalElements.anchorBodyId = 'missing';
    },
    (p) => {
      p.generatedBodies[0].physicalCatalog.meanRadiusKm = -1;
    },
    (p) => {
      p.evidence[0].densityKgM3 = NaN;
    },
    (p) => {
      p.countPlan.asteroid = 0;
    },
    (p) => {
      p.runtimeEnabled = true;
    },
    (p) => {
      p.coverage.playableMiningVerified = true;
    },
    (p) => {
      p.status = 'blocked';
    },
    (p) => {
      p.ringProposals[0].rings.outerRadiusKm *= 100;
    },
    (p) => {
      p.ringProposals.push(p.ringProposals[0]);
    },
    (p) => {
      p.generatedBodies[0].universeMetadata.generation.seedKey =
        '["other","host","planet","slot-01"]';
    },
    (p) => {
      p.generatedBodies[0].orbitalElements.epoch = '2026-11-01T00:00:00.000Z';
    },
    (p) => {
      p.outputSha256 = 'tampered';
    },
  ];
  for (const mutate of mutations) {
    const invalid = structuredClone(original);
    mutate(invalid);
    assert.throws(() => validatePreview(invalid));
  }
  const moved = structuredClone(original);
  moved.generatedBodies[0].orbitalElements.semiMajorAxisKm = 1;
  assert.throws(() => validatePreview(moved), /scientific screen/);
});

test('physical screens enforce numeric Hill/Roche, mass, temperature and clearing thresholds', () => {
  const star = {
    id: 'star',
    bodyType: 'star',
    luminositySolar: 1,
    physicalCatalog: { massKg: 1.98847e30, meanRadiusKm: 695700 },
  };
  const host = {
    id: 'host',
    parentBodyId: star.id,
    orbitalElements: { semiMajorAxisKm: 149597870.7, eccentricity: 0 },
    physicalCatalog: { massKg: 5.9722e24, meanRadiusKm: 6371 },
  };
  const moon = {
    radiusKm: 100,
    densityKgM3: 3000,
    icy: false,
    massKg: massFromDensity(100, 3000),
    orbit: { semiMajorAxisKm: 100000, eccentricity: 0 },
  };
  assert.equal(moonRejection(moon, host, star, [], 0, 0), null);
  const hillBoundary =
    hillRadiusKm(host.orbitalElements, host.physicalCatalog.massKg, star.physicalCatalog.massKg) *
    0.3;
  assert.equal(
    moonRejection(
      { ...moon, orbit: { semiMajorAxisKm: hillBoundary, eccentricity: 0 } },
      host,
      star,
      [],
      0,
      0
    ),
    'MOON_ROCHE_HILL_CLEARANCE'
  );
  assert.equal(
    moonRejection(
      { ...moon, orbit: { semiMajorAxisKm: 6371, eccentricity: 0 } },
      host,
      star,
      [],
      0,
      0
    ),
    'MOON_ROCHE_HILL_CLEARANCE'
  );
  assert.equal(
    moonRejection(moon, host, star, [], host.physicalCatalog.massKg * 0.0001, 0),
    'MOON_MASS_BUDGET'
  );
  assert.equal(moonRejection({ ...moon, icy: true }, host, star, [], 0, 0), 'MOON_THERMAL_BOUNDS');
  const particle = { ...moon, orbit: { semiMajorAxisKm: 149597870.7, eccentricity: 0 } };
  assert.equal(stellarRejection(particle, 'asteroid', star, []), null);
  assert.equal(
    stellarRejection(
      { ...particle, orbit: { semiMajorAxisKm: 200 * 149597870.7, eccentricity: 0 } },
      'asteroid',
      star,
      []
    ),
    'STELLAR_CLEARANCE_OR_EXTENT'
  );
  assert.equal(stellarRejection({ ...particle, icy: true }, 'comet', star, []), 'THERMAL_BOUNDS');
  assert.equal(stellarRejection(particle, 'planet', star, []), 'PLANET_CLEARING_PROXY');
});

test('deterministic diversity sample stays within approved budgets with optional absences and bounded rejection', () => {
  const systems = getSolarSystemRegistry()
    .filter((s) => s.id !== 'sol')
    .sort((a, b) => a.id.localeCompare(b.id, 'en'));
  const sample = systems.filter((_, index) => index % 41 === 0).map((s) => s.id);
  const abundances = new Set();
  const cometCounts = new Set();
  const moonCounts = new Set();
  let rings = 0;
  for (const id of sample) {
    const preview = previewNonSolSystem(id);
    abundances.add(preview.abundance);
    const counts = {};
    for (const body of preview.generatedBodies)
      counts[body.bodyType] = (counts[body.bodyType] || 0) + 1;
    cometCounts.add(counts.comet || 0);
    moonCounts.add(counts.moon || 0);
    rings += preview.ringProposals.length;
    for (const type of ['asteroid', 'comet', 'planet', 'dwarf-planet']) {
      assert.ok((counts[type] || 0) <= preview.countPlan[type]);
    }
    assert.ok((counts.moon || 0) <= 16);
    assert.ok(preview.rejected.every((r) => r.attempts <= 32));
    assert.equal(validatePreview(preview), true);
  }
  assert.equal(abundances.size, 3);
  assert.ok(cometCounts.has(0) && cometCounts.size >= 4);
  assert.ok(moonCounts.has(0) && moonCounts.size >= 4);
  assert.ok(rings > 0);
});

test('CLI is strictly offline, rejects unsafe scope/arguments and publishes exclusive reproducible evidence', () => {
  for (const args of [
    ['--all', '--system', 'alpha-centauri'],
    ['--wat'],
    ['--out'],
    ['--system', 'alpha-centauri', '--system', 'alpha-centauri'],
  ])
    assert.throws(() => parseArgs(args));
  for (const id of ['sol', 'Alpha-Centauri', 'missing-system', ' alpha-centauri']) {
    assert.throws(() => previewNonSolSystem(id));
  }
  for (const epoch of ['not-a-date', '2026-11-01', '2026-11-01T00:00:00+00:00']) {
    assert.throws(() => previewNonSolSystem('alpha-centauri', { epoch }));
  }
  const report = buildReport(parseArgs([]));
  assert.equal(report.targetCount, 4);
  assert.equal(report.blockedPreviews, 2);
  assert.deepEqual(buildReport(parseArgs([])), report);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'non-sol-preview-'));
  const file = path.join(dir, 'preview.json');
  try {
    assert.equal(publishReport(file, report), 'created');
    assert.equal(publishReport(file, report), 'unchanged');
    assert.throws(() => publishReport(file, { ...report, reportSha256: 'different' }), /differs/);
    const result = spawnSync(
      process.execPath,
      [
        path.resolve(__dirname, '..', 'scripts', 'non-sol-celestial-preview.js'),
        '--system',
        'cygnus-x1',
      ],
      { encoding: 'utf8' }
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /1 systems; 0 analytically screened; 1 blocked/);
    const bad = spawnSync(
      process.execPath,
      [path.resolve(__dirname, '..', 'scripts', 'non-sol-celestial-preview.js'), '--system', 'sol'],
      { encoding: 'utf8' }
    );
    assert.notEqual(bad.status, 0);
    assert.match(bad.stderr, /canonical non-Sol/);
  } finally {
    fs.rmSync(file, { force: true });
    fs.rmdirSync(dir);
  }
});

test('full frozen scope is accounted for exactly once without fabricated completion', () => {
  const report = buildReport(parseArgs(['--all']));
  const manifest = require('../data/non-sol-celestial-generation-manifest-v1.json');
  assert.equal(report.targetCount, 4844);
  assert.equal(report.validPreviews + report.blockedPreviews, 4844);
  assert.deepEqual(
    report.summary.map((row) => row.systemId),
    manifest.systems.map((row) => row.id).sort()
  );
  assert.equal(new Set(report.summary.map((row) => row.systemId)).size, 4844);
  assert.equal(
    report.summary.some((row) => row.systemId === 'sol'),
    false
  );
  assert.equal(report.details, undefined);
  assert.ok(report.validPreviews > 0 && report.blockedPreviews > 0);
  assert.ok(
    report.summary.some((row) => row.exclusionCodes.includes('STELLAR_EVOLUTION_MODEL_REQUIRED'))
  );
});
