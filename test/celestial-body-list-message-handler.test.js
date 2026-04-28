'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CelestialBodyListMessageHandler
} = require('../src/handlers/celestial-body-list-message-handler');
const {
  CELESTIAL_BODY_LIST_RESPONSE_EVENT
} = require('../src/model/celestial-body-list');
const {
  INVALID_SESSION_EVENT,
  INVALID_SESSION_MESSAGE
} = require('../src/model/session');
const {
  createMockSocket,
  createTestContext,
  seedPlayer
} = require('../test-support/message-handler-test-helpers');

function createCelestialBody(overrides = {}) {
  return {
    id: 'cb-1',
    catalogId: 'CAT-001',
    solarSystemId: 'sol',
    sourceScanId: 'scan-1',
    createdByCharacterId: 'character-1',
    createdAt: '2026-04-17T00:00:00.000Z',
    updatedAt: '2026-04-17T00:00:00.000Z',
    location: {
      positionKm: { x: 0, y: 0, z: 0 }
    },
    kinematics: {
      velocityKmPerSec: { x: 1, y: 2, z: 3 },
      angularVelocityRadPerSec: { x: 0.1, y: 0.2, z: 0.3 },
      estimatedMassKg: 42000000000,
      estimatedDiameterM: 320
    },
    composition: {
      rarity: 'Rare',
      material: 'Nickel-Iron',
      textureColor: '#8df7b2'
    },
    ...overrides
  };
}

test('CelestialBodyListMessageHandler returns nearest-first celestial bodies with computed distance', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'ScannerOne',
    sessionKey: 'session-1',
    characters: [{ id: 'character-1', characterName: 'RangerOne' }]
  });

  await context.addOrUpdateCelestialBodyAsync(createCelestialBody({
    id: 'cb-near',
    location: { positionKm: { x: 3, y: 4, z: 0 } }
  }));
  await context.addOrUpdateCelestialBodyAsync(createCelestialBody({
    id: 'cb-mid',
    location: { positionKm: { x: 0, y: 6, z: 8 } }
  }));
  await context.addOrUpdateCelestialBodyAsync(createCelestialBody({
    id: 'cb-far',
    location: { positionKm: { x: 100, y: 0, z: 0 } }
  }));

  const handler = new CelestialBodyListMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'scannerone',
    sessionKey: 'session-1',
    solarSystemId: 'sol',
    positionKm: { x: 0, y: 0, z: 0 },
    distanceKm: 10,
    limit: 2
  });

  assert.equal(response.success, true);
  assert.equal(response.message, 'Celestial body list retrieved successfully');
  assert.equal(response.playerName, 'ScannerOne');
  assert.equal(response.celestialBodies.length, 2);
  assert.equal(response.celestialBodies[0].id, 'cb-near');
  assert.equal(response.celestialBodies[0].distanceKm, 5);
  assert.equal(response.celestialBodies[1].id, 'cb-mid');
  assert.equal(response.celestialBodies[1].distanceKm, 10);
  assert.equal(socket.events[0].eventName, CELESTIAL_BODY_LIST_RESPONSE_EVENT);
});

test('CelestialBodyListMessageHandler returns empty list when no bodies match', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'ScannerOne',
    sessionKey: 'session-1'
  });

  await context.addOrUpdateCelestialBodyAsync(createCelestialBody({
    id: 'cb-other-system',
    solarSystemId: 'alt'
  }));

  const handler = new CelestialBodyListMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'ScannerOne',
    sessionKey: 'session-1',
    solarSystemId: 'sol',
    positionKm: { x: 0, y: 0, z: 0 },
    distanceKm: 1
  });

  assert.equal(response.success, true);
  assert.equal(response.message, 'No celestial bodies found within distance');
  assert.deepEqual(response.celestialBodies, []);
  assert.equal(socket.events[0].eventName, CELESTIAL_BODY_LIST_RESPONSE_EVENT);
});

test('CelestialBodyListMessageHandler validates required search inputs', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'ScannerOne',
    sessionKey: 'session-1'
  });

  const handler = new CelestialBodyListMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'ScannerOne',
    sessionKey: 'session-1',
    solarSystemId: 'sol',
    positionKm: { x: 0, y: 0 },
    distanceKm: -1
  });

  assert.equal(response.success, false);
  assert.equal(
    response.message,
    'playerName, solarSystemId, positionKm, and distanceKm are required'
  );
  assert.deepEqual(response.celestialBodies, []);
  assert.equal(socket.events[0].eventName, CELESTIAL_BODY_LIST_RESPONSE_EVENT);
});

test('CelestialBodyListMessageHandler emits invalid session before query', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'ScannerOne',
    sessionKey: 'session-1'
  });

  const handler = new CelestialBodyListMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'ScannerOne',
    sessionKey: 'wrong-session',
    solarSystemId: 'sol',
    positionKm: { x: 0, y: 0, z: 0 },
    distanceKm: 10
  });

  assert.deepEqual(response, { message: INVALID_SESSION_MESSAGE });
  assert.equal(socket.events[0].eventName, INVALID_SESSION_EVENT);
});

test('CelestialBodyListMessageHandler merges cache results when DB query returns empty', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'ScannerOne',
    sessionKey: 'session-1',
    characters: [{ id: 'character-1', characterName: 'RangerOne' }]
  });

  await context.addOrUpdateCelestialBodyAsync(createCelestialBody({
    id: 'cb-cache-only',
    location: { positionKm: { x: 3, y: 4, z: 0 } }
  }));

  context.databaseService = {
    async addOrUpdateCelestialBody() {
      return null;
    },
    async findCelestialBodiesNearPosition() {
      return [];
    }
  };

  const handler = new CelestialBodyListMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'ScannerOne',
    sessionKey: 'session-1',
    solarSystemId: 'sol',
    positionKm: { x: 0, y: 0, z: 0 },
    distanceKm: 10
  });

  assert.equal(response.success, true);
  assert.equal(response.celestialBodies.length, 1);
  assert.equal(response.celestialBodies[0].id, 'cb-cache-only');
  assert.equal(response.celestialBodies[0].distanceKm, 5);
  assert.equal(socket.events[0].eventName, CELESTIAL_BODY_LIST_RESPONSE_EVENT);
});

test('CelestialBodyListMessageHandler filters by states, createdByCharacterId, and missionId', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'ScannerOne',
    sessionKey: 'session-1',
    characters: [{ id: 'character-1', characterName: 'RangerOne' }]
  });

  await context.addOrUpdateCelestialBodyAsync(createCelestialBody({
    id: 'cb-unscanned',
    state: 'unscanned',
    missionId: 'first-target',
    createdByCharacterId: 'character-1',
    location: { positionKm: { x: 1, y: 0, z: 0 } }
  }));
  await context.addOrUpdateCelestialBodyAsync(createCelestialBody({
    id: 'cb-active',
    state: 'active',
    missionId: 'first-target',
    createdByCharacterId: 'character-1',
    location: { positionKm: { x: 2, y: 0, z: 0 } }
  }));
  await context.addOrUpdateCelestialBodyAsync(createCelestialBody({
    id: 'cb-destroyed',
    state: 'destroyed',
    missionId: 'first-target',
    createdByCharacterId: 'character-1',
    location: { positionKm: { x: 3, y: 0, z: 0 } }
  }));

  const handler = new CelestialBodyListMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'ScannerOne',
    sessionKey: 'session-1',
    solarSystemId: 'sol',
    positionKm: { x: 0, y: 0, z: 0 },
    distanceKm: 20,
    states: ['unscanned', 'active'],
    createdByCharacterId: 'character-1',
    missionId: 'first-target'
  });

  assert.equal(response.success, true);
  assert.equal(response.celestialBodies.length, 2);
  assert.ok(response.celestialBodies.some((entry) => entry.id === 'cb-unscanned'));
  assert.ok(response.celestialBodies.some((entry) => entry.id === 'cb-active'));
});
