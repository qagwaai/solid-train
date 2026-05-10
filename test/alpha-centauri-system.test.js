'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildSeededCelestialBodiesForSolarSystem,
} = require('../src/model/solar-system-celestial-seed');
const {
  ALPHA_CENTAURI_CATALOG,
  ALPHA_CEN_A,
  ALPHA_CEN_B,
  PROXIMA,
  PROXIMA_B,
} = require('../src/model/alpha-centauri-system-catalog');

const SEED_TIMESTAMP = '2026-05-09T00:00:00.000Z';

test('Alpha Centauri catalog includes 3 stars + 3 confirmed/suspected planets', () => {
  const stars = ALPHA_CENTAURI_CATALOG.filter((b) => b.bodyType === 'star');
  const planets = ALPHA_CENTAURI_CATALOG.filter((b) => b.bodyType === 'planet');
  assert.equal(stars.length, 3);
  assert.equal(planets.length, 3);
  assert.ok(stars.find((s) => s.id === ALPHA_CEN_A.id));
  assert.ok(stars.find((s) => s.id === ALPHA_CEN_B.id));
  assert.ok(stars.find((s) => s.id === PROXIMA.id));
  assert.ok(planets.find((p) => p.id === PROXIMA_B.id));
});

test('Alpha Centauri seeded snapshot exposes UI-grade fields per body', () => {
  const seeded = buildSeededCelestialBodiesForSolarSystem('alpha-centauri', SEED_TIMESTAMP);
  assert.equal(seeded.length, ALPHA_CENTAURI_CATALOG.length);

  for (const body of seeded) {
    assert.equal(body.spatial.solarSystemId, 'alpha-centauri');
    assert.equal(body.spatial.frame, 'barycentric');
    assert.ok(Number.isFinite(body.spatial.positionKm.x));
    assert.equal(body.observability.visibility, 'visible');
    assert.equal(body.composition.rarity, 'Common');
    assert.equal(body.isCatalogBody, true);
  }

  const a = seeded.find((b) => b.id === 'alpha-centauri-star-primary');
  assert.equal(a.bodyType, 'star');
  assert.equal(a.parentBodyId, null);
  assert.deepEqual(a.spatial.positionKm, { x: 0, y: 0, z: 0 });
  assert.equal(a.visualization.spectralClass, 'G');

  const b = seeded.find((entry) => entry.id === 'alpha-centauri-star-secondary');
  assert.equal(b.parentBodyId, 'alpha-centauri-star-primary');
  // α Cen B should sit somewhere within tens of AU of A.
  const AU_KM = 149_597_870.7;
  const dist = Math.sqrt(
    b.spatial.positionKm.x ** 2 +
      b.spatial.positionKm.y ** 2 +
      b.spatial.positionKm.z ** 2
  );
  assert.ok(dist > 1 * AU_KM, `α Cen B should be at least 1 AU from A, got ${dist}`);
  assert.ok(dist < 60 * AU_KM, `α Cen B should be within 60 AU of A, got ${dist}`);

  const proxima = seeded.find((entry) => entry.id === 'alpha-centauri-star-tertiary');
  assert.equal(proxima.visualization.spectralClass, 'M');

  const proximaB = seeded.find((entry) => entry.id === 'alpha-centauri-proxima-b');
  assert.equal(proximaB.bodyType, 'planet');
  assert.equal(proximaB.parentBodyId, 'alpha-centauri-star-tertiary');
  assert.equal(proximaB.planetType, 'rocky');
  // Planets orbiting a star must NOT carry anchorBodyId even in a multi-star system.
  assert.equal(proximaB.orbitalElements?.anchorBodyId, undefined,
    'Proxima b orbits a star; anchorBodyId must be absent');
});
