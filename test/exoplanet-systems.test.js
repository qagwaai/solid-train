'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  assignLetters,
  baseName,
  buildSystems,
  groupHosts,
  isCircumbinaryHostName,
  mainSequenceFromMass,
  preferredLetter,
  spectralClassForTeff,
  summarizeSystems,
  synthesizeCompanion,
  validateSystems,
} = require('../scripts/lib/exoplanet-systems');
const { validateOverrides } = require('../scripts/match-exoplanet-hosts');

let nextRa = 10;

function host(name, overrides = {}) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  nextRa += 1;
  return {
    id: `exo-host-${slug}`,
    name,
    starCount: 1,
    raDeg: nextRa,
    decDeg: 20,
    distancePc: 50,
    vMag: 10,
    teffK: 5600,
    radiusSolar: 1,
    massSolar: 1,
    logLuminositySolar: 0,
    planetIds: [`exo-${slug}-b`],
    match: { decision: 'unmatched', tier: null },
    resolvedDistance: { distancePc: 50, source: 'archive' },
    ...overrides,
  };
}

function planetsFor(hosts, overrides = {}) {
  const planets = new Map();
  for (const entry of hosts) {
    for (const id of entry.planetIds) {
      planets.set(id, { id, hostId: entry.id, semiMajorAxisAu: 1, ...(overrides[id] || {}) });
    }
  }
  return planets;
}

function build(hosts, options = {}) {
  const systems = buildSystems({
    hosts,
    hygStars: options.hygStars || [],
    planetsById: planetsFor(hosts, options.planets),
    systemAssignments: options.systemAssignments || [],
    defaultDistance: 664.568,
  });
  assert.deepEqual(validateSystems(systems, hosts), []);
  return systems;
}

test('name helpers parse component suffixes and circumbinary hosts', () => {
  assert.equal(baseName('WASP-94 A'), 'WASP-94');
  assert.equal(baseName('Kepler-47 AB'), 'Kepler-47');
  assert.equal(baseName('24 Boo'), '24 Boo');
  assert.equal(preferredLetter('Gl 725 B'), 'B');
  assert.equal(preferredLetter('HD 41004 B'), 'B');
  assert.equal(preferredLetter('24 Boo'), 'A');
  assert.equal(isCircumbinaryHostName('Kepler-47 AB'), true);
  assert.equal(isCircumbinaryHostName('GJ 3305 B'), false);
  assert.equal(isCircumbinaryHostName('24 Boo'), false);
});

test('a single-star host becomes a one-star system positioned at the host', () => {
  const [system] = build([host('24 Boo')]);
  assert.equal(system.id, 'exo-24-boo');
  assert.equal(system.catalogName, '24 Boo');
  assert.equal(system.declaredStarCount, 1);
  assert.equal(system.synthesizedStarCount, 0);
  assert.equal(system.stars.length, 1);
  const [star] = system.stars;
  assert.equal(star.starId, 'exo-star-24-boo');
  assert.equal(star.role, 'primary');
  assert.equal(star.letter, 'A');
  assert.deepEqual(star.planetIds, ['exo-24-boo-b']);
  assert.ok(system.positionPc, 'system keeps the primary position');
  assert.equal(system.distancePc, 50);
  // Real stars are slim: position and physics are re-derived from the hosts snapshot.
  assert.equal(star.positionPc, undefined);
  assert.equal(star.massSolar, undefined);
  assert.equal(star.catalogName, undefined);
});

test('lettered hosts with a shared base name merge into one binary', () => {
  const hosts = [
    host('WASP-94 A', { starCount: 2 }),
    host('WASP-94 B', { starCount: 2, vMag: 10.5 }),
  ];
  const systems = build(hosts);
  assert.equal(systems.length, 1);
  const [system] = systems;
  assert.equal(system.id, 'exo-wasp-94');
  assert.equal(system.catalogName, 'WASP-94');
  assert.deepEqual(
    system.stars.map((star) => [star.letter, star.role, star.planetIds]),
    [
      ['A', 'primary', ['exo-wasp-94-a-b']],
      ['B', 'secondary', ['exo-wasp-94-b-b']],
    ]
  );
  assert.equal(system.synthesizedStarCount, 0);
});

test('HYG companions and shared HYG bases join hosts and add real stars', () => {
  const a = host('55 Cnc', { starCount: 2 });
  const b = host('Other Name B', { starCount: 2 });
  const hygStars = [
    { atHygId: '1', role: 'host', hostIds: [a.id], hygBase: 'Gl 324' },
    { atHygId: '2', role: 'host', hostIds: [b.id], hygBase: 'Gl 324' },
    {
      atHygId: '3',
      role: 'companion',
      hostIds: [a.id],
      glName: '324C',
      distancePc: 12.6,
      xPc: 1,
      yPc: 2,
      zPc: 3,
      vMag: 13,
    },
  ];
  const systems = build([a, b], { hygStars });
  assert.equal(systems.length, 1);
  const [system] = systems;
  assert.equal(system.id, 'exo-55-cnc');
  assert.equal(system.resolvedStarCount, 3);
  assert.equal(system.declaredStarCount, 3);
  const companion = system.stars.find((star) => star.source === 'hyg-companion');
  assert.equal(companion.starId, 'exo-star-athyg-3');
  assert.equal(companion.letter, 'C');
  assert.equal(companion.role, 'tertiary');
});

test('missing companions are synthesized deterministically and flagged approximate', () => {
  const hosts = [host('HD 1 A', { starCount: 3 })];
  const first = build(hosts);
  const second = build(hosts);
  assert.deepEqual(first, second);
  const [system] = first;
  assert.equal(system.declaredStarCount, 3);
  assert.equal(system.synthesizedStarCount, 2);
  const synthesized = system.stars.filter((star) => star.source === 'synthesized');
  assert.deepEqual(
    synthesized.map((star) => [star.starId, star.letter, star.role]),
    [
      ['exo-hd-1-star-b', 'B', 'secondary'],
      ['exo-hd-1-star-c', 'C', 'tertiary'],
    ]
  );
  for (const star of synthesized) {
    assert.equal(star.approximate, true);
    assert.equal(star.separationFromStarId, 'exo-star-hd-1-a');
    assert.ok(star.separationAu >= 10, `wide companion at ${star.separationAu} AU`);
    assert.ok(star.massSolar < 1 && star.massSolar >= 0.08);
    assert.match(star.spectralType, /^[OBAFGKM] V$/);
  }
});

test('synthesis is stable per letter regardless of other stars in the system', () => {
  const reference = {
    starId: 'exo-star-x',
    letter: 'A',
    massSolar: 1,
    catalogName: 'X',
    distancePc: 20,
    positionPc: { x: 1, y: 1, z: 1 },
  };
  const make = (planetAxesAu) =>
    synthesizeCompanion({ systemId: 'exo-x', letter: 'B', reference, planetAxesAu });
  assert.deepEqual(make([1]), make([1]));
  const other = synthesizeCompanion({
    systemId: 'exo-x',
    letter: 'C',
    reference,
    planetAxesAu: [1],
  });
  assert.notDeepEqual(make([1]).positionPc, other.positionPc);
  assert.ok(make([500]).separationAu >= 2500, 'separation clears the widest planet');
});

test('circumbinary planets orbit the barycenter of the host and a close partner', () => {
  const hosts = [host('Kepler-16', { starCount: 2 })];
  const [system] = build(hosts, {
    planets: { 'exo-kepler-16-b': { circumbinary: true, semiMajorAxisAu: 0.7048 } },
  });
  assert.equal(system.declaredStarCount, 2);
  const partner = system.stars.find((star) => star.source === 'synthesized');
  assert.equal(partner.starId, 'exo-kepler-16-star-b');
  assert.ok(partner.separationAu <= 0.7048 / 4, `close binary at ${partner.separationAu} AU`);
  assert.deepEqual(system.circumbinaryPlanets, [
    { planetIds: ['exo-kepler-16-b'], starIds: ['exo-kepler-16-star-b', 'exo-star-kepler-16'] },
  ]);
  assert.equal(system.stars[0].planetIds, undefined);
});

test('an AB host is circumbinary even without the planet flag', () => {
  const [system] = build([host('Kepler-47 AB', { starCount: 2 })]);
  assert.equal(system.id, 'exo-kepler-47');
  assert.equal(system.circumbinaryPlanets.length, 1);
  assert.equal(system.synthesizedStarCount, 1);
  const summary = summarizeSystems([system]);
  assert.equal(summary.circumbinarySystems, 1);
});

test('a B-only host gets a synthesized, heavier A as primary', () => {
  const [system] = build([host('GJ 3305 B', { starCount: 2, massSolar: 0.5 })]);
  const [primary, secondary] = system.stars;
  assert.equal(primary.source, 'synthesized');
  assert.equal(primary.letter, 'A');
  assert.equal(primary.role, 'primary');
  assert.ok(primary.massSolar >= 0.5);
  assert.equal(secondary.starId, 'exo-star-gj-3305-b');
  assert.equal(secondary.role, 'secondary');
  assert.deepEqual(system.positionPc, primary.positionPc);
});

test('hosts in existing curated systems keep their IDs and roles without synthesis', () => {
  const proxima = host('Proxima Cen', {
    starCount: 3,
    match: {
      decision: 'matched',
      atHygId: '1440825',
      existingSystemId: 'alpha-centauri',
      existingStarId: 'alpha-centauri-star-tertiary',
    },
  });
  const hygStars = [
    {
      atHygId: '1440825',
      role: 'host',
      hostIds: [proxima.id],
      properName: 'Proxima Centauri',
      distancePc: 1.3012,
      xPc: -0.4745,
      yPc: -0.3633,
      zPc: -1.1567,
      raDeg: 217.4,
      decDeg: -62.7,
      vMag: 11.13,
    },
  ];
  const [system] = build([proxima], { hygStars });
  assert.equal(system.id, 'alpha-centauri');
  assert.equal(system.existing, true);
  assert.equal(system.catalogName, undefined);
  assert.equal(system.synthesizedStarCount, 0);
  assert.equal(system.stars.length, 1);
  assert.equal(system.stars[0].starId, 'alpha-centauri-star-tertiary');
  assert.equal(system.stars[0].role, 'tertiary');
  assert.equal(system.stars[0].existing, true);
  assert.equal(summarizeSystems([system]).existingSystems, 1);
});

test('systemAssignments join merges and detach splits with collision-safe IDs', () => {
  const a = host('Alpha 1');
  const b = host('Beta 2');
  const joined = build([a, b], {
    systemAssignments: [{ hostId: b.id, action: 'join', withHostId: a.id, reason: 'test' }],
  });
  assert.equal(joined.length, 1);
  assert.equal(joined[0].stars.length, 2);

  const wasp = [host('WASP-94 A'), host('WASP-94 B')];
  const detached = build(wasp, {
    systemAssignments: [{ hostId: wasp[1].id, action: 'detach', reason: 'test' }],
  });
  assert.deepEqual(
    detached.map((system) => [system.id, system.idCollision]),
    [
      ['exo-wasp-94-a', true],
      ['exo-wasp-94-b', true],
    ]
  );
  assert.equal(summarizeSystems(detached).idCollisions, 2);

  assert.throws(
    () => groupHosts([a], [], [{ hostId: a.id, action: 'join', withHostId: 'exo-host-nope' }]),
    /unknown host/
  );
});

test('the overrides schema validates systemAssignments entries', () => {
  const base = { description: 'test', hostMatches: [] };
  assert.deepEqual(
    validateOverrides({
      ...base,
      systemAssignments: [
        { hostId: 'exo-host-a', action: 'join', withHostId: 'exo-host-b', reason: 'r' },
        { hostId: 'exo-host-c', action: 'detach', reason: 'r' },
      ],
    }),
    []
  );
  assert.notDeepEqual(
    validateOverrides({
      ...base,
      systemAssignments: [{ hostId: 'exo-host-a', action: 'join', reason: 'r' }],
    }),
    []
  );
  assert.notDeepEqual(
    validateOverrides({
      ...base,
      systemAssignments: [{ hostId: 'exo-host-a', action: 'merge', reason: 'r' }],
    }),
    []
  );
});

test('validateSystems reports duplicates and orphans', () => {
  const hosts = [host('One'), host('Two')];
  const systems = build(hosts);
  const duplicated = [...systems, systems[0]];
  const errors = validateSystems(duplicated, hosts);
  assert.ok(errors.some((error) => error.startsWith('duplicate system ID')));
  assert.ok(errors.some((error) => /^host .* is in /.test(error)));
  const orphaned = validateSystems(systems.slice(1), hosts);
  assert.ok(orphaned.some((error) => / has no system$/.test(error)));
});

test('letter assignment and main-sequence helpers behave as documented', () => {
  const stars = [
    { starId: 'b', preferredLetter: 'A', vMag: 9 },
    { starId: 'a', preferredLetter: 'A', vMag: 8 },
    { starId: 'c', preferredLetter: null, vMag: 12 },
  ];
  const free = assignLetters(stars, 4);
  // Ties on the preferred letter go to the lower star ID; the rest take the
  // lowest free letters in brightness order.
  assert.deepEqual(
    stars.map((star) => star.letter),
    ['B', 'A', 'C']
  );
  assert.deepEqual(free, ['D']);
  const sun = mainSequenceFromMass(1);
  assert.ok(Math.abs(sun.teff - 5772) < 1);
  assert.equal(spectralClassForTeff(5772), 'G');
  assert.equal(spectralClassForTeff(3000), 'M');
});
