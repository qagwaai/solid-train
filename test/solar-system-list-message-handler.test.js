'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  SolarSystemListMessageHandler,
} = require('../src/handlers/solar-system-list-message-handler');
const { SOLAR_SYSTEM_LIST_RESPONSE_EVENT } = require('../src/model/solar-system-list');
const { buildSeededMarketsForSolarSystem } = require('../src/model/solar-system-market-seed');
const { getSolarSystemById } = require('../src/model/solar-system-registry');
const {
  createCelestialBody,
  createMarket,
  createMockSocket,
  createTestContext,
  seedCelestialBodies,
  seedPlayer,
} = require('../test-support/message-handler-test-helpers');

test('SolarSystemListMessageHandler returns curated and procedural systems sorted by distance', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });

  const handler = new SolarSystemListMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
  });

  assert.equal(response.success, true);
  assert.ok(response.solarSystems.length >= 2);
  assert.ok(response.solarSystems.find((s) => s.id === 'sol'));
  assert.ok(response.solarSystems.find((s) => s.id === 'alpha-centauri'));

  // Sol should sort first (distance ~0).
  assert.equal(response.solarSystems[0].id, 'sol');
  assert.equal(socket.events[0].eventName, SOLAR_SYSTEM_LIST_RESPONSE_EVENT);
});

test('SolarSystemListMessageHandler filters by source', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });

  const handler = new SolarSystemListMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    source: 'curated',
  });

  assert.equal(response.success, true);
  assert.ok(response.solarSystems.every((s) => s.source === 'curated'));
  assert.ok(response.solarSystems.find((s) => s.id === 'sol'));
  assert.ok(response.solarSystems.find((s) => s.id === 'alpha-centauri'));
});

test('SolarSystemListMessageHandler filters by search substring', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });

  const handler = new SolarSystemListMessageHandler(context);
  const response = await handler.handle(createMockSocket(), {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    search: 'Alpha',
  });

  assert.equal(response.success, true);
  assert.ok(response.solarSystems.find((s) => s.id === 'alpha-centauri'));
  assert.ok(!response.solarSystems.find((s) => s.id === 'sol'));
});

test('SolarSystemListMessageHandler rejects invalid source values', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });

  const handler = new SolarSystemListMessageHandler(context);
  const response = await handler.handle(createMockSocket(), {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    source: 'unknown',
  });

  assert.equal(response.success, false);
  assert.match(response.message, /source must be one of/);
});

test('SolarSystemListMessageHandler echoes requestId when supplied', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });

  const handler = new SolarSystemListMessageHandler(context);
  const response = await handler.handle(createMockSocket(), {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    requestId: 'req-42',
  });

  assert.equal(response.requestId, 'req-42');
});

test('SolarSystemListMessageHandler populates count fields when celestial bodies and markets exist', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });

  // Clear default seeded data for a clean test
  context.celestialBodiesById.clear();
  context.marketsByKey.clear();

  // Seed celestial bodies with different bodyTypes in 'sol'
  seedCelestialBodies(context, [
    {
      ...createCelestialBody({
        id: 'sol-planet-1',
        spatial: { solarSystemId: 'sol' },
      }),
      bodyType: 'planet',
      surfaceArchetype: 'rocky',
    },
    {
      ...createCelestialBody({
        id: 'sol-planet-2',
        spatial: { solarSystemId: 'sol' },
      }),
      bodyType: 'planet',
      surfaceArchetype: 'rocky',
    },
    {
      ...createCelestialBody({
        id: 'sol-moon-1',
        spatial: { solarSystemId: 'sol' },
      }),
      bodyType: 'moon',
      surfaceArchetype: 'rocky-moon',
    },
    {
      ...createCelestialBody({
        id: 'sol-asteroid-1',
        spatial: { solarSystemId: 'sol' },
      }),
      bodyType: 'asteroid',
    },
  ]);

  // Seed markets in 'sol'
  const trajectory = buildSeededMarketsForSolarSystem('sol').find(
    (market) => market.marketId === 'sol-earth-orbit'
  ).trajectory;
  trajectory.orbit.anchorBodyId = 'sol-planet-1';
  context.marketsByKey.set(
    'sol:market-1',
    createMarket({ solarSystemId: 'sol', marketId: 'market-1', trajectory })
  );
  context.marketsByKey.set(
    'sol:market-2',
    createMarket({ solarSystemId: 'sol', marketId: 'market-2', trajectory })
  );

  const handler = new SolarSystemListMessageHandler(context);
  const response = await handler.handle(createMockSocket(), {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
  });

  assert.equal(response.success, true);
  const solSystem = response.solarSystems.find((s) => s.id === 'sol');
  assert.ok(solSystem);
  // Partial materialization never reduces the catalog planet/moon baseline.
  const registrySol = getSolarSystemById('sol');
  assert.equal(solSystem.planetCount, registrySol.planetCount);
  assert.equal(solSystem.moonCount, registrySol.moonCount);
  assert.equal(solSystem.asteroidCount, 1);
  assert.equal(solSystem.marketCount, 2);
});

test('augmented Copper Vale counts and minPlanetCount filtering use live bodies without changing registry facts', async () => {
  const { previewCopperValeP4 } = require('../src/model/non-sol-p4-preview');
  const preview = previewCopperValeP4();
  const context = createTestContext({ seedDefaults: false });
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });
  seedCelestialBodies(context, [...preview.baseBodies, ...preview.generatedBodies]);
  const handler = new SolarSystemListMessageHandler(context);
  const payload = { playerName: 'PilotOne', sessionKey: 'session-1', search: 'Copper Vale' };
  const response = await handler.buildResponse({ ...payload, minPlanetCount: 5 });
  assert.equal(response.success, true);
  assert.equal(response.total, 1);
  assert.equal(response.solarSystems.length, 1);
  assert.equal(response.solarSystems[0].planetCount, 5);
  assert.equal(response.solarSystems[0].moonCount, 16);
  assert.equal(response.solarSystems[0].asteroidCount, 26);
  const excluded = await handler.buildResponse({ ...payload, minPlanetCount: 6 });
  assert.equal(excluded.total, 0);
  assert.deepEqual(excluded.solarSystems, []);
  assert.equal(getSolarSystemById(preview.systemId).planetCount, 1);
  assert.equal(getSolarSystemById(preview.systemId).moonCount, 0);
});

test('SolarSystemListMessageHandler lists exoplanet-catalog systems with catalog counts', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });

  const handler = new SolarSystemListMessageHandler(context);
  const response = await handler.handle(createMockSocket(), {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    source: 'exoplanet-catalog',
    search: '55 Cnc',
  });

  assert.equal(response.success, true);
  const system = response.solarSystems.find((s) => s.id === 'exo-55-cnc');
  assert.ok(system);
  assert.equal(system.displayName, 'Copernicus');
  assert.equal(system.catalogName, '55 Cnc');
  assert.equal(system.settlementName, null);
  assert.deepEqual(system.aliases, ['55 Cnc']);
  assert.equal(system.hygSystemId, null);
  assert.equal(system.isMultiStar, true);
  assert.equal(system.planetCount, 7);
  assert.equal(system.marketCount, 0);
  assert.equal(system.primaryStar.starId, 'exo-star-55-cnc');
  assert.ok(response.solarSystems.every((s) => s.source === 'exoplanet-catalog'));
});

test('SolarSystemListMessageHandler handles missing count data gracefully', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });
  // Match startup order: bootstrap markets alone do not materialize strict hosts.
  for (const solarSystemId of ['sol', 'alpha-centauri', 'barnards-star']) {
    await context.seedSolarSystemCelestialBodiesAsync({ solarSystemId });
  }

  const handler = new SolarSystemListMessageHandler(context);
  const response = await handler.handle(createMockSocket(), {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
  });

  assert.equal(response.success, true);
  // Sol should have counts populated from seeded data
  const solSystem = response.solarSystems.find((s) => s.id === 'sol');
  assert.ok(solSystem);
  // All count fields should be present and be numbers >= 0
  assert.equal(typeof solSystem.planetCount, 'number');
  assert.equal(typeof solSystem.moonCount, 'number');
  assert.equal(typeof solSystem.asteroidCount, 'number');
  assert.equal(typeof solSystem.marketCount, 'number');
});

test('SolarSystemListMessageHandler pages by default and pages are disjoint and stable (P2)', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });
  const handler = new SolarSystemListMessageHandler(context);
  const base = { playerName: 'PilotOne', sessionKey: 'session-1' };

  const first = await handler.buildResponse(base);
  assert.equal(first.success, true);
  assert.equal(first.offset, 0);
  assert.equal(first.limit, 100);
  assert.ok(first.solarSystems.length <= 100);
  assert.equal(first.hasMore, first.total > 100);

  const pageA = await handler.buildResponse({ ...base, offset: 0, limit: 5 });
  const pageB = await handler.buildResponse({ ...base, offset: 5, limit: 5 });
  const wide = await handler.buildResponse({ ...base, offset: 0, limit: 10 });
  assert.deepEqual(
    [...pageA.solarSystems, ...pageB.solarSystems].map((s) => s.id),
    wide.solarSystems.map((s) => s.id)
  );
  assert.equal(pageA.total, first.total);

  const clamped = await handler.buildResponse({ ...base, limit: 5000 });
  assert.equal(clamped.limit, 500);

  const past = await handler.buildResponse({ ...base, offset: first.total + 10 });
  assert.equal(past.success, true);
  assert.deepEqual(past.solarSystems, []);
  assert.equal(past.hasMore, false);
});

test('SolarSystemListMessageHandler applies P2 filters and name sort', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });
  const handler = new SolarSystemListMessageHandler(context);
  const base = { playerName: 'PilotOne', sessionKey: 'session-1', limit: 500 };

  const near = await handler.buildResponse({
    ...base,
    minDistanceParsec: 5,
    maxDistanceParsec: 10,
  });
  assert.equal(near.success, true);
  assert.ok(near.solarSystems.length > 0);
  for (const system of near.solarSystems) {
    assert.ok(system.distanceParsec >= 5 && system.distanceParsec <= 10, system.id);
  }

  const withPlanets = await handler.buildResponse({ ...base, minPlanetCount: 2 });
  assert.ok(withPlanets.solarSystems.length > 0);
  for (const system of withPlanets.solarSystems) {
    assert.ok(system.planetCount >= 2, system.id);
  }

  const mDwarfs = await handler.buildResponse({ ...base, spectralClass: 'm' });
  assert.ok(mDwarfs.solarSystems.length > 0);
  for (const system of mDwarfs.solarSystems) {
    assert.equal(system.primaryStar.spectralClass, 'M', system.id);
  }

  const byName = await handler.buildResponse({ ...base, sort: 'name' });
  const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });
  for (let i = 1; i < byName.solarSystems.length; i += 1) {
    const prev = byName.solarSystems[i - 1];
    const cur = byName.solarSystems[i];
    assert.ok(collator.compare(prev.displayName, cur.displayName) <= 0, `name order at ${i}`);
  }

  for (const bad of [
    { sort: 'size' },
    { offset: -1 },
    { limit: 0 },
    { minPlanetCount: -1 },
    { minDistanceParsec: 10, maxDistanceParsec: 5 },
  ]) {
    const response = await handler.buildResponse({ ...base, ...bad });
    assert.equal(response.success, false, JSON.stringify(bad));
    assert.deepEqual(response.solarSystems, []);
    assert.equal(response.total, 0);
    assert.equal(response.hasMore, false);
  }
});
