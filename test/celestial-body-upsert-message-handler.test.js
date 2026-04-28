'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CelestialBodyUpsertMessageHandler
} = require('../src/handlers/celestial-body-upsert-message-handler');
const {
  CELESTIAL_BODY_UPSERT_RESPONSE_EVENT,
  DEFAULT_SOLAR_SYSTEM_ID
} = require('../src/model/celestial-body-upsert');
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
    solarSystemId: 'alpha-centauri',
    sourceScanId: 'scan-1',
    createdByCharacterId: 'character-1',
    createdAt: '2026-04-17T00:00:00.000Z',
    updatedAt: '2026-04-17T00:00:00.000Z',
    location: {
      positionKm: { x: 100, y: 200, z: 300 }
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

test('CelestialBodyUpsertMessageHandler upserts a celestial body by id', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'ScannerOne',
    sessionKey: 'session-1',
    characters: [{ id: 'character-1', characterName: 'RangerOne' }]
  });

  const handler = new CelestialBodyUpsertMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'scannerone',
    sessionKey: 'session-1',
    celestialBody: createCelestialBody()
  });

  assert.equal(response.success, true);
  assert.equal(response.message, 'Celestial body recorded successfully');
  assert.equal(response.playerName, 'ScannerOne');
  assert.equal(response.celestialBody.id, 'cb-1');
  assert.equal(response.celestialBody.solarSystemId, DEFAULT_SOLAR_SYSTEM_ID);
  assert.equal(context.getCelestialBody('cb-1').solarSystemId, DEFAULT_SOLAR_SYSTEM_ID);
  assert.equal(socket.events[0].eventName, CELESTIAL_BODY_UPSERT_RESPONSE_EVENT);
});

test('CelestialBodyUpsertMessageHandler validates createdByCharacterId', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'ScannerOne',
    sessionKey: 'session-1',
    characters: [{ id: 'character-1', characterName: 'RangerOne' }]
  });

  const handler = new CelestialBodyUpsertMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'ScannerOne',
    sessionKey: 'session-1',
    celestialBody: createCelestialBody({ createdByCharacterId: 'character-404' })
  });

  assert.equal(response.success, false);
  assert.equal(response.message, 'Character is not in player list');
  assert.equal(context.getCelestialBody('cb-1'), null);
  assert.equal(socket.events[0].eventName, CELESTIAL_BODY_UPSERT_RESPONSE_EVENT);
});

test('CelestialBodyUpsertMessageHandler emits invalid session before mutation', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'ScannerOne',
    sessionKey: 'session-1',
    characters: [{ id: 'character-1', characterName: 'RangerOne' }]
  });

  const handler = new CelestialBodyUpsertMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'ScannerOne',
    sessionKey: 'wrong-session',
    celestialBody: createCelestialBody()
  });

  assert.deepEqual(response, { message: INVALID_SESSION_MESSAGE });
  assert.equal(context.getCelestialBody('cb-1'), null);
  assert.equal(socket.events[0].eventName, INVALID_SESSION_EVENT);
});

test('CelestialBodyUpsertMessageHandler supports unscanned mission-seeded asteroid creation', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'ScannerOne',
    sessionKey: 'session-1',
    characters: [{ id: 'character-1', characterName: 'RangerOne' }]
  });

  const handler = new CelestialBodyUpsertMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'scannerone',
    sessionKey: 'session-1',
    celestialBody: createCelestialBody({
      id: '',
      sourceScanId: 'sample-a3',
      missionId: 'first-target',
      state: 'unscanned',
      composition: null
    })
  });

  assert.equal(response.success, true);
  assert.equal(response.celestialBody.state, 'unscanned');
  assert.equal(response.celestialBody.missionId, 'first-target');
  assert.ok(response.celestialBody.id.startsWith('cb-character-1-first-target-sample-a3'));
  assert.equal(socket.events[0].eventName, CELESTIAL_BODY_UPSERT_RESPONSE_EVENT);
});