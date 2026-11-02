'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');

const {
  CATALOG_SEED_VERSION,
  CATALOG_SOURCE,
  PLANET_ARCHETYPES,
  catalogRings,
  classifyCatalogPlanet,
  completeStarFacts,
  generateCatalogSystemBodies,
  meanAnomalyAtJ2000,
  projectedSeparationAu,
  teqFromInsolation,
} = require('../src/model/exoplanet-system-generator');
const { generateSystemBodies } = require('../src/model/procedural-system-generator');
const { getHygSystems } = require('../src/model/hyg-star-catalog');
const { systemStarFacts } = require('../src/model/exoplanet-star-facts');

const AU_KM = 149597870.7;
const J2000_JD = 2451545;

function planet(id, overrides = {}) {
  return {
    id,
    name: id,
    hostId: 'exo-host-test',
    status: 'confirmed',
    letter: 'b',
    orbitalPeriodDays: 10,
    semiMajorAxisAu: 0.09,
    eccentricity: 0.1,
    argumentOfPeriapsisDeg: 45,
    inclinationDeg: 88,
    radiusEarth: 1,
    massEarth: 1,
    equilibriumTempK: 300,
    massProvenance: 'Mass',
    discoveryYear: 2020,
    discoveryMethod: 'Transit',
    discoveryFacility: 'Kepler',
    ...overrides,
  };
}

function hostFacts(overrides = {}) {
  return {
    massSolar: 1,
    radiusSolar: 1,
    teffK: 5772,
    logLuminositySolar: 0,
    spectralType: 'G2 V',
    raDeg: 10,
    decDeg: 20,
    distancePc: 10,
    vMag: 5,
    catalogName: 'Test',
    ...overrides,
  };
}

function singleStarSystem(planets, { factsOverrides, systemOverrides } = {}) {
  const system = {
    id: 'exo-test',
    name: 'Test',
    stars: [
      {
        starId: 'exo-star-test',
        letter: 'A',
        role: 'primary',
        source: 'archive-host',
        hostId: 'exo-host-test',
        planetIds: planets.map((p) => p.id),
      },
    ],
    ...systemOverrides,
  };
  return generateCatalogSystemBodies({
    system,
    starFacts: new Map([['exo-star-test', hostFacts(factsOverrides)]]),
    planetsById: new Map(planets.map((p) => [p.id, p])),
  });
}

test('EX-4.4 procedural systems stay byte-identical (golden hashes)', () => {
  const golden = {
    sol: 'dc917be31dc35ac7cc73b8431d70fe005bd4eab3e78605938ea3a41d16d26723',
    'alpha-centauri': '7cd4a761fb18f5dfe12b929167d9e4df2fb21472a2d76fff7f2b827d49fc54c5',
    sirius: 'a98342ea49c35582be16419ed9afbceda2b132a435210a5157e427cf2d8801a0',
    'barnards-star': '037403b3b3446601c22efe207fb3e573746463cb576b542952e4093c6a3b989a',
    'lalande-21185': 'ae8193dc98f65d342123f4310b1dee778109217e0a9c95fd31fde0def9b1b725',
    'wolf-359': 'e3bbd99cdb89cce8a2b1cd3c9b1d4de8ee53d6b545ba32c1d4a2acc9e6f9f630',
  };
  for (const system of getHygSystems()) {
    const output = generateSystemBodies({
      solarSystemId: system.systemId,
      stars: system.stars,
      asOfTimestamp: '2026-05-09T00:00:00.000Z',
    });
    const hash = crypto.createHash('sha256').update(JSON.stringify(output)).digest('hex');
    assert.equal(hash, golden[system.systemId], system.systemId);
  }
});

test('classifyCatalogPlanet covers every catalog archetype (D39)', () => {
  const cases = [
    [{ radiusEarth: 1, teqK: 300 }, 'rocky'],
    [{ radiusEarth: 1, teqK: 1500 }, 'lava'],
    [{ radiusEarth: 1.5, teqK: 400 }, 'super-earth'],
    [{ radiusEarth: 1.5, teqK: 1200 }, 'lava'],
    [{ radiusEarth: 3, teqK: 500, density: 1.5 }, 'sub-neptune'],
    [{ radiusEarth: 3, teqK: 280, density: 4 }, 'ocean'],
    [{ radiusEarth: 3, teqK: 500, density: 4 }, 'super-earth'],
    [{ radiusEarth: 3, teqK: 1100 }, 'hot-neptune'],
    [{ radiusEarth: 5, teqK: 100 }, 'ice-giant'],
    [{ radiusEarth: 5, teqK: 1100 }, 'hot-neptune'],
    [{ radiusEarth: 11, teqK: 150 }, 'gas-giant'],
    [{ radiusEarth: 11, teqK: 1400 }, 'hot-jupiter'],
    [{ radiusEarth: 12, massEarth: 14 * 317.828, teqK: 1400 }, 'super-jupiter'],
    [{ massEarth: 5 }, null],
  ];
  for (const [input, expected] of cases) {
    assert.equal(classifyCatalogPlanet(input), expected, JSON.stringify(input));
  }
  for (const archetype of cases.map(([, expected]) => expected).filter(Boolean)) {
    assert.ok(PLANET_ARCHETYPES.includes(archetype), archetype);
  }
});

test('catalog values pass through unchanged and estimates are flagged (D40)', () => {
  const { planets } = singleStarSystem([planet('exo-test-b')]);
  const [body] = planets;
  assert.equal(body.catalogSource, CATALOG_SOURCE);
  assert.equal(body.parentBodyId, 'exo-star-test');
  assert.equal(body.surfaceArchetype, 'rocky');
  assert.equal(body.planetType, 'rocky');
  assert.equal(body.orbit.semiMajorAxisKm, 0.09 * AU_KM);
  assert.equal(body.orbit.orbitalPeriodSec, 10 * 86400);
  assert.equal(body.orbit.eccentricity, 0.1);
  assert.equal(body.orbit.argumentOfPeriapsisDeg, 45);
  assert.equal(body.physical.meanRadiusKm, 6371);
  assert.equal(body.physical.meanTemperatureK, 300);
  assert.equal(body.moons, undefined);
  assert.deepEqual(body.approximateFields, [...body.approximateFields].sort());
  for (const field of [
    'atmosphere',
    'orbit.longitudeOfAscendingNodeDeg',
    'orbit.meanAnomalyAtEpochDeg',
    'physical.axialTiltDeg',
    'physical.compositionTags',
    'physical.rotationPeriodSec',
  ]) {
    assert.ok(body.approximateFields.includes(field), field);
  }
  for (const field of [
    'orbit.semiMajorAxisKm',
    'orbit.eccentricity',
    'physical.massKg',
    'surfaceArchetype',
  ]) {
    assert.ok(!body.approximateFields.includes(field), field);
  }
});

test('estimated mass, radius and missing orbital facts are flagged approximate', () => {
  const { planets } = singleStarSystem([
    planet('exo-test-b', {
      radiusEarth: undefined,
      massEarth: 5,
      massProvenance: 'Msini',
      semiMajorAxisAu: undefined,
      eccentricity: undefined,
      argumentOfPeriapsisDeg: undefined,
    }),
  ]);
  const [body] = planets;
  for (const field of [
    'physical.massKg',
    'physical.meanRadiusKm',
    'surfaceArchetype',
    'planetType',
    'orbit.eccentricity',
    'orbit.argumentOfPeriapsisDeg',
  ]) {
    assert.ok(body.approximateFields.includes(field), field);
  }
  assert.ok(!body.approximateFields.includes('orbit.semiMajorAxisKm'));
  const keplerAu = (10 / 365.25) ** (2 / 3);
  assert.ok(Math.abs(body.orbit.semiMajorAxisKm / AU_KM - keplerAu) / keplerAu < 0.01);
  assert.equal(body.orbit.eccentricity, 0);
});

test('planets without radius or mass fall back to a seeded procedural class', () => {
  const bare = planet('exo-test-b', {
    radiusEarth: undefined,
    massEarth: undefined,
    semiMajorAxisAu: undefined,
    orbitalPeriodDays: undefined,
  });
  const first = singleStarSystem([bare]).planets[0];
  const second = singleStarSystem([bare]).planets[0];
  assert.deepEqual(first, second);
  assert.ok(PLANET_ARCHETYPES.includes(first.surfaceArchetype));
  for (const field of [
    'surfaceArchetype',
    'orbit.semiMajorAxisKm',
    'orbit.orbitalPeriodSec',
    'physical.massKg',
    'physical.meanRadiusKm',
  ]) {
    assert.ok(first.approximateFields.includes(field), field);
  }
});

test('inclination is relative to the median of sibling planets (D41)', () => {
  const { planets } = singleStarSystem([
    planet('exo-test-b', { inclinationDeg: 88 }),
    planet('exo-test-c', { inclinationDeg: 89, letter: 'c' }),
    planet('exo-test-d', { inclinationDeg: 90, letter: 'd' }),
    planet('exo-test-e', { inclinationDeg: undefined, letter: 'e' }),
  ]);
  const byId = new Map(planets.map((p) => [p.id, p]));
  assert.equal(byId.get('exo-test-b').orbit.inclinationDeg, 1);
  assert.equal(byId.get('exo-test-c').orbit.inclinationDeg, 0);
  assert.equal(byId.get('exo-test-d').orbit.inclinationDeg, 1);
  const seeded = byId.get('exo-test-e');
  assert.ok(seeded.orbit.inclinationDeg >= 0 && seeded.orbit.inclinationDeg <= 3);
  assert.ok(seeded.approximateFields.includes('orbit.inclinationDeg'));
  assert.ok(!byId.get('exo-test-b').approximateFields.includes('orbit.inclinationDeg'));
});

test('meanAnomalyAtJ2000 uses the periapsis time, then the transit midpoint', () => {
  assert.equal(meanAnomalyAtJ2000({ periodDays: 10, periapsisTimeJd: J2000_JD }), 0);
  assert.equal(meanAnomalyAtJ2000({ periodDays: 10, periapsisTimeJd: J2000_JD - 2.5 }), 90);
  // Circular orbit, ω = 90°: transit sits at periapsis.
  assert.ok(
    Math.abs(
      meanAnomalyAtJ2000({
        periodDays: 10,
        transitMidpointJd: J2000_JD - 5,
        eccentricity: 0,
        argumentOfPeriapsisDeg: 90,
      }) - 180
    ) < 1e-9
  );
  assert.equal(meanAnomalyAtJ2000({ periodDays: 10 }), null);
  assert.equal(meanAnomalyAtJ2000({ periapsisTimeJd: J2000_JD }), null);
});

test('rings are deterministic, seeded, and never on hot planets (D42)', () => {
  const ringed = [];
  for (let index = 0; index < 200; index += 1) {
    const input = {
      planetId: `exo-ring-${index}`,
      archetype: 'gas-giant',
      teqK: 150,
      radiusKm: 70000,
      axialTiltDeg: 12,
    };
    const rings = catalogRings(input);
    assert.deepEqual(rings, catalogRings(input));
    if (rings) {
      ringed.push(rings);
      assert.ok(rings.innerRadiusKm >= 70000 * 1.2 && rings.innerRadiusKm <= 70000 * 1.6);
      assert.ok(rings.outerRadiusKm > rings.innerRadiusKm);
      assert.equal(rings.tiltDeg, 12);
      assert.equal(rings.approximate, true);
    }
    assert.equal(catalogRings({ ...input, archetype: 'hot-jupiter', teqK: 1500 }), null);
    assert.equal(catalogRings({ ...input, teqK: 1000 }), null);
    assert.equal(catalogRings({ ...input, archetype: 'rocky' }), null);
  }
  assert.ok(ringed.length > 30 && ringed.length < 90, `ringed ${ringed.length}`);
});

test('completeStarFacts fills missing physics and reports approximate paths', () => {
  const full = completeStarFacts(hostFacts());
  assert.deepEqual(full.approximate, []);
  assert.equal(full.spectralClass, 'G');
  const bare = completeStarFacts({ logLuminositySolar: 0 });
  assert.ok(Math.abs(bare.massSolar - 1) < 1e-9);
  assert.deepEqual(bare.approximate, [
    'physical.massKg',
    'physical.meanRadiusKm',
    'physical.meanTemperatureK',
  ]);
  assert.equal(completeStarFacts({}).massSolar, 1);
  assert.equal(teqFromInsolation(1), 278.6);
});

test('projectedSeparationAu converts angular separation at the primary distance', () => {
  const primary = { raDeg: 0, decDeg: 0, distancePc: 10 };
  const companion = { raDeg: 0, decDeg: 1 / 3600 };
  assert.ok(Math.abs(projectedSeparationAu(companion, primary) - 10) < 1e-6);
  assert.equal(projectedSeparationAu({ raDeg: 0 }, primary), null);
});

test('star hierarchy, circumbinary anchors and existing systems (D43)', () => {
  const synthesizedPrimary = {
    starId: 'exo-test-star-a',
    letter: 'A',
    role: 'primary',
    source: 'synthesized',
    massSolar: 0.5,
    radiusSolar: 0.5,
    teffK: 3800,
    luminositySolar: 0.06,
    spectralClass: 'M',
    separationFromStarId: 'exo-star-test-b',
    separationAu: 40,
    planetIds: [],
  };
  const realB = {
    starId: 'exo-star-test-b',
    letter: 'B',
    role: 'secondary',
    source: 'archive-host',
    hostId: 'exo-host-test-b',
    planetIds: ['exo-test-b-b'],
  };
  const system = {
    id: 'exo-test',
    name: 'Test',
    stars: [synthesizedPrimary, realB],
    circumbinaryPlanets: [
      { starIds: ['exo-test-star-a', 'exo-star-test-b'], planetIds: ['exo-test-ab-b'] },
    ],
  };
  const planetsById = new Map([
    ['exo-test-b-b', planet('exo-test-b-b')],
    ['exo-test-ab-b', planet('exo-test-ab-b', { semiMajorAxisAu: 200, orbitalPeriodDays: 1e5 })],
  ]);
  const run = () =>
    generateCatalogSystemBodies({
      system,
      starFacts: new Map([['exo-star-test-b', hostFacts()]]),
      planetsById,
    });
  const result = run();
  assert.deepEqual(result, run());
  assert.equal(result.seedVersion, CATALOG_SEED_VERSION);
  const [primary, secondary] = result.stars;
  assert.equal(primary.parentBodyId ?? null, null);
  assert.ok(primary.approximateFields.includes('physical.massKg'));
  assert.equal(secondary.parentBodyId, 'exo-test-star-a');
  assert.ok(Math.abs(secondary.orbit.semiMajorAxisKm / AU_KM - 40) < 1e-6);
  assert.ok(secondary.approximateFields.includes('orbit'));

  const byId = new Map(result.planets.map((p) => [p.id, p]));
  assert.equal(byId.get('exo-test-b-b').parentBodyId, 'exo-star-test-b');
  const circumbinary = byId.get('exo-test-ab-b');
  assert.equal(circumbinary.parentBodyId, 'exo-test-star-a');
  assert.equal(circumbinary.circumbinary, true);
  assert.deepEqual(circumbinary.circumbinaryStarIds, ['exo-test-star-a', 'exo-star-test-b']);
  assert.ok(circumbinary.approximateFields.includes('parentBodyId'));
  assert.ok(circumbinary.approximateFields.includes('orbit'));

  const existing = generateCatalogSystemBodies({
    system: { ...system, existing: true },
    starFacts: new Map([['exo-star-test-b', hostFacts()]]),
    planetsById,
  });
  assert.deepEqual(existing.stars, []);
  assert.equal(existing.planets.length, 2);
});

test('EX-4.7 the full snapshot generates every planet once with finite values', () => {
  const read = (name) => require(`../data/${name}`);
  const hosts = read('exoplanet-hosts.json').records;
  const planets = read('exoplanet-planets.json').records;
  const hyg = read('exoplanet-hyg-stars.json').records;
  const systems = read('exoplanet-systems.json').records;
  const context = {
    hostsById: new Map(hosts.map((h) => [h.id, h])),
    hygByAtHygId: new Map(hyg.map((r) => [r.atHygId, r])),
    defaultDistance: read('exoplanet-match-report.json').distances.defaultDistancePc,
  };
  const planetsById = new Map(planets.map((p) => [p.id, p]));
  const seen = new Set();
  const hasher = crypto.createHash('sha256');
  const assertFinite = (value, path) => {
    if (typeof value === 'number') {
      assert.ok(Number.isFinite(value), path);
    } else if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) {
        assertFinite(child, `${path}.${key}`);
      }
    }
  };
  for (const system of systems) {
    const result = generateCatalogSystemBodies({
      system,
      starFacts: systemStarFacts(system, context),
      planetsById,
    });
    for (const body of [...result.stars, ...result.planets]) {
      assert.ok(!seen.has(body.id), `duplicate ${body.id}`);
      seen.add(body.id);
      assertFinite(body, body.id);
    }
    for (const body of result.planets) {
      assert.ok(PLANET_ARCHETYPES.includes(body.surfaceArchetype), body.id);
    }
    hasher.update(JSON.stringify(result));
  }
  for (const record of planets) {
    assert.ok(seen.has(record.id), `missing ${record.id}`);
  }
  const rerun = crypto.createHash('sha256');
  for (const system of systems) {
    rerun.update(
      JSON.stringify(
        generateCatalogSystemBodies({
          system,
          starFacts: systemStarFacts(system, context),
          planetsById,
        })
      )
    );
  }
  assert.equal(rerun.digest('hex'), hasher.digest('hex'));
});
