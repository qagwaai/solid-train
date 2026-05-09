'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  generateSystemBodies,
  createSeededRandom,
  PROCEDURAL_SEED_VERSION,
} = require('../src/model/procedural-system-generator');
const { getHygSystems } = require('../src/model/hyg-star-catalog');

test('createSeededRandom produces deterministic sequences for same seed', () => {
  const a = createSeededRandom(42);
  const b = createSeededRandom(42);
  for (let i = 0; i < 10; i += 1) {
    assert.equal(a(), b());
  }
});

test('createSeededRandom produces different sequences for different seeds', () => {
  const a = createSeededRandom(1);
  const b = createSeededRandom(2);
  assert.notEqual(a(), b());
});

test('generateSystemBodies returns deterministic bodies for the same star input', () => {
  const wolf = getHygSystems().find((s) => s.systemId === 'wolf-359');
  assert.ok(wolf);

  const first = generateSystemBodies({
    solarSystemId: 'wolf-359',
    stars: wolf.stars,
    asOfTimestamp: '2026-05-09T00:00:00.000Z',
  });
  const second = generateSystemBodies({
    solarSystemId: 'wolf-359',
    stars: wolf.stars,
    asOfTimestamp: '2026-05-09T00:00:00.000Z',
  });

  assert.equal(first.seedVersion, PROCEDURAL_SEED_VERSION);
  assert.equal(first.stars.length, second.stars.length);
  assert.equal(first.planets.length, second.planets.length);
  for (let i = 0; i < first.planets.length; i += 1) {
    assert.equal(
      first.planets[i].orbit.semiMajorAxisKm,
      second.planets[i].orbit.semiMajorAxisKm
    );
    assert.equal(first.planets[i].planetType, second.planets[i].planetType);
  }
});

test('generateSystemBodies scales habitable zone with luminosity', () => {
  const sirius = getHygSystems().find((s) => s.systemId === 'sirius');
  const wolf = getHygSystems().find((s) => s.systemId === 'wolf-359');
  assert.ok(sirius && wolf);
  const siriusGen = generateSystemBodies({
    solarSystemId: 'sirius',
    stars: sirius.stars,
    asOfTimestamp: '2026-05-09T00:00:00.000Z',
  });
  const wolfGen = generateSystemBodies({
    solarSystemId: 'wolf-359',
    stars: wolf.stars,
    asOfTimestamp: '2026-05-09T00:00:00.000Z',
  });
  // Sirius (L ~25) has a habitable zone much further than Wolf 359 (L ~0.001).
  assert.ok(siriusGen.habitableZoneCenterAu > wolfGen.habitableZoneCenterAu);
});

test('generateSystemBodies tags non-primary stars with primary as parent', () => {
  const alpha = getHygSystems().find((s) => s.systemId === 'alpha-centauri');
  const gen = generateSystemBodies({
    solarSystemId: 'alpha-centauri',
    stars: alpha.stars,
    asOfTimestamp: '2026-05-09T00:00:00.000Z',
  });
  assert.equal(gen.stars[0].parentBodyId, null);
  for (let i = 1; i < gen.stars.length; i += 1) {
    assert.equal(gen.stars[i].parentBodyId, gen.stars[0].id);
  }
});
