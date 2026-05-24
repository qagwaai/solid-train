'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  SOLAR_SYSTEM_CELESTIAL_SEED_VERSION,
  buildSeededCelestialBodiesForSolarSystem,
  computeRelativePositionKm,
} = require('../src/model/solar-system-celestial-seed');
const { SOL_SYSTEM_CATALOG, AU_KM, J2000_EPOCH } = require('../src/model/sol-system-catalog');
const { createMongoTestHarness } = require('../test-support/mongodb-test-helpers');
const { MessageHandlerContext } = require('../src/handlers/message-handler-context');

const SEED_TIMESTAMP = '2026-05-08T00:00:00.000Z';

test('SOL_SYSTEM_CATALOG covers Sun + 8 planets + 5 dwarfs + asteroids + TNOs + moons', () => {
  const byType = SOL_SYSTEM_CATALOG.reduce((acc, entry) => {
    acc[entry.bodyType] = (acc[entry.bodyType] || 0) + 1;
    return acc;
  }, {});

  assert.equal(byType.star, 1);
  assert.equal(byType.planet, 8);
  assert.equal(byType['dwarf-planet'], 5);
  assert.equal(byType.asteroid, 3);
  assert.equal(byType.tno, 3);
  assert.ok(byType.moon >= 80, `expected at least 80 moons, got ${byType.moon}`);
  assert.ok(SOL_SYSTEM_CATALOG.length >= 100);

  const earth = SOL_SYSTEM_CATALOG.find((entry) => entry.id === 'sol-earth');
  assert.ok(earth);
  assert.equal(earth.parentBodyId, 'sol-sun');
  const luna = SOL_SYSTEM_CATALOG.find((entry) => entry.id === 'sol-luna');
  assert.ok(luna);
  assert.equal(luna.parentBodyId, 'sol-earth');
});

test('buildSeededCelestialBodiesForSolarSystem produces canonical-shape documents for Sol', () => {
  const seeded = buildSeededCelestialBodiesForSolarSystem('sol', SEED_TIMESTAMP);

  assert.equal(typeof SOLAR_SYSTEM_CELESTIAL_SEED_VERSION, 'string');
  assert.equal(seeded.length, SOL_SYSTEM_CATALOG.length);
  assert.ok(seeded.every((body) => body.spatial?.solarSystemId === 'sol'));
  assert.ok(seeded.every((body) => body.spatial?.frame === 'barycentric'));
  assert.ok(seeded.every((body) => Number.isFinite(body.spatial?.positionKm?.x)));
  assert.ok(seeded.every((body) => body.observability?.visibility === 'visible'));
  assert.ok(seeded.every((body) => body.composition?.rarity === 'Common'));
  assert.ok(seeded.every((body) => body.isCatalogBody === true));

  const sun = seeded.find((body) => body.id === 'sol-sun');
  assert.deepEqual(sun.spatial.positionKm, { x: 0, y: 0, z: 0 });

  const earth = seeded.find((body) => body.id === 'sol-earth');
  const earthDistanceKm = Math.sqrt(
    earth.spatial.positionKm.x ** 2 +
      earth.spatial.positionKm.y ** 2 +
      earth.spatial.positionKm.z ** 2
  );
  // Earth should be ~1 AU from the barycenter (within 5%).
  assert.ok(
    Math.abs(earthDistanceKm - AU_KM) / AU_KM < 0.05,
    `Earth heliocentric distance off: ${earthDistanceKm} km`
  );

  const luna = seeded.find((body) => body.id === 'sol-luna');
  const dx = luna.spatial.positionKm.x - earth.spatial.positionKm.x;
  const dy = luna.spatial.positionKm.y - earth.spatial.positionKm.y;
  const dz = luna.spatial.positionKm.z - earth.spatial.positionKm.z;
  const lunarDistanceKm = Math.sqrt(dx * dx + dy * dy + dz * dz);
  // Luna's mean distance from Earth ~384,400 km (within 1%).
  assert.ok(
    Math.abs(lunarDistanceKm - 384400) / 384400 < 0.01,
    `Luna offset from Earth off: ${lunarDistanceKm} km`
  );

  // Moons must carry anchorBodyId; planets orbiting the Sun must not.
  assert.equal(
    luna.orbitalElements.anchorBodyId,
    'sol-earth',
    'Luna orbitalElements.anchorBodyId should be sol-earth'
  );
  assert.equal(
    earth.orbitalElements.anchorBodyId,
    undefined,
    'Earth (planet) must not have anchorBodyId'
  );
  const phobos = seeded.find((body) => body.id === 'sol-phobos');
  assert.equal(
    phobos.orbitalElements.anchorBodyId,
    'sol-mars',
    'Phobos orbitalElements.anchorBodyId should be sol-mars'
  );

  // All moons must have anchorBodyId; no planet/star/dwarf-planet may have it.
  const moons = seeded.filter((body) => body.bodyType === 'moon');
  assert.ok(moons.length > 0);
  for (const moon of moons) {
    assert.ok(
      moon.orbitalElements?.anchorBodyId,
      `Moon ${moon.id} missing orbitalElements.anchorBodyId`
    );
  }
  const nonMoonOrbiters = seeded.filter((body) => body.bodyType !== 'moon' && body.orbitalElements);
  for (const body of nonMoonOrbiters) {
    assert.equal(
      body.orbitalElements.anchorBodyId,
      undefined,
      `${body.id} (${body.bodyType}) should not have anchorBodyId`
    );
  }
});

test('buildSeededCelestialBodiesForSolarSystem returns empty for unknown systems', () => {
  assert.deepEqual(
    buildSeededCelestialBodiesForSolarSystem('not-a-real-system', SEED_TIMESTAMP),
    []
  );
  assert.deepEqual(buildSeededCelestialBodiesForSolarSystem('', SEED_TIMESTAMP), []);
  assert.deepEqual(buildSeededCelestialBodiesForSolarSystem(null, SEED_TIMESTAMP), []);
});

test('buildSeededCelestialBodiesForSolarSystem produces curated Alpha Centauri bodies', () => {
  const seeded = buildSeededCelestialBodiesForSolarSystem('alpha-centauri', SEED_TIMESTAMP);
  assert.ok(seeded.length >= 6, `expected >=6 bodies (3 stars + 3 planets), got ${seeded.length}`);
  const stars = seeded.filter((b) => b.bodyType === 'star');
  assert.equal(stars.length, 3);
  const ids = seeded.map((b) => b.id);
  assert.ok(ids.includes('alpha-centauri-star-primary'));
  assert.ok(ids.includes('alpha-centauri-star-secondary'));
  assert.ok(ids.includes('alpha-centauri-star-tertiary'));
  assert.ok(ids.includes('alpha-centauri-proxima-b'));
  assert.ok(seeded.every((b) => b.spatial?.solarSystemId === 'alpha-centauri'));
  assert.ok(seeded.every((b) => b.spatial?.frame === 'barycentric'));
  const proximaB = seeded.find((b) => b.id === 'alpha-centauri-proxima-b');
  assert.equal(proximaB.bodyType, 'planet');
  assert.equal(proximaB.parentBodyId, 'alpha-centauri-star-tertiary');
});

test('computeRelativePositionKm returns origin for null orbit', () => {
  assert.deepEqual(computeRelativePositionKm(null, Date.parse(J2000_EPOCH)), { x: 0, y: 0, z: 0 });
});

let mongoHarness = null;

test.before(async () => {
  mongoHarness = await createMongoTestHarness();
});

test.after(async () => {
  if (mongoHarness) {
    await mongoHarness.teardown();
  }
});

test.beforeEach(async () => {
  await mongoHarness.clearDatabase();
});

test('seedSolarSystemCelestialBodiesAsync persists Sol catalog and is idempotent', async () => {
  const context = new MessageHandlerContext({
    databaseService: mongoHarness.databaseService,
    log: () => {},
  });

  const first = await context.seedSolarSystemCelestialBodiesAsync({ solarSystemId: 'sol' });
  assert.equal(first.success, true);
  assert.equal(first.solarSystemId, 'sol');
  assert.equal(first.seedVersion, SOLAR_SYSTEM_CELESTIAL_SEED_VERSION);
  assert.equal(first.bodyCount, SOL_SYSTEM_CATALOG.length);
  assert.equal(first.source, 'database-upsert');

  const persisted = await mongoHarness.databaseService.getCelestialBodies({ solarSystemId: 'sol' });
  assert.equal(persisted.length, SOL_SYSTEM_CATALOG.length);

  const earth = persisted.find((body) => body.id === 'sol-earth');
  assert.ok(earth);
  assert.equal(earth.bodyType, 'planet');
  assert.equal(earth.displayName, 'Earth');
  assert.equal(earth.isCatalogBody, true);
  assert.ok(earth.orbitalElements);
  assert.ok(earth.orbitalElements.semiMajorAxisKm > 0);

  // Re-running with the same version should hit database-cache path and not duplicate.
  const second = await context.seedSolarSystemCelestialBodiesAsync({ solarSystemId: 'sol' });
  assert.equal(second.success, true);
  assert.equal(second.source, 'database-cache');
  assert.equal(second.bodyCount, SOL_SYSTEM_CATALOG.length);

  const reloaded = await mongoHarness.databaseService.getCelestialBodies({ solarSystemId: 'sol' });
  assert.equal(reloaded.length, SOL_SYSTEM_CATALOG.length);
});
