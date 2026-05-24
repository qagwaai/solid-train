'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  SolarSystemListMessageHandler,
} = require('../src/handlers/solar-system-list-message-handler');
const { SOLAR_SYSTEM_LIST_RESPONSE_EVENT } = require('../src/model/solar-system-list');
const { INVALID_SESSION_EVENT, INVALID_SESSION_MESSAGE } = require('../src/model/session');
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

test('SolarSystemListMessageHandler emits invalid session before query', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });

  const handler = new SolarSystemListMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'PilotOne',
    sessionKey: 'wrong-session',
  });

  assert.deepEqual(response, { message: INVALID_SESSION_MESSAGE });
  assert.equal(socket.events[0].eventName, INVALID_SESSION_EVENT);
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
    },
    {
      ...createCelestialBody({
        id: 'sol-planet-2',
        spatial: { solarSystemId: 'sol' },
      }),
      bodyType: 'planet',
    },
    {
      ...createCelestialBody({
        id: 'sol-moon-1',
        spatial: { solarSystemId: 'sol' },
      }),
      bodyType: 'moon',
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
  context.marketsByKey.set(
    'sol:market-1',
    createMarket({ solarSystemId: 'sol', marketId: 'market-1' })
  );
  context.marketsByKey.set(
    'sol:market-2',
    createMarket({ solarSystemId: 'sol', marketId: 'market-2' })
  );

  const handler = new SolarSystemListMessageHandler(context);
  const response = await handler.handle(createMockSocket(), {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
  });

  assert.equal(response.success, true);
  const solSystem = response.solarSystems.find((s) => s.id === 'sol');
  assert.ok(solSystem);
  assert.equal(solSystem.planetCount, 2);
  assert.equal(solSystem.moonCount, 1);
  assert.equal(solSystem.asteroidCount, 1);
  assert.equal(solSystem.marketCount, 2);
});

test('SolarSystemListMessageHandler handles missing count data gracefully', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });

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
