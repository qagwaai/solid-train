'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CelestialBodyUpsertMessageHandler,
} = require('../src/handlers/celestial-body-upsert-message-handler');
const {
  CELESTIAL_BODY_UPSERT_RESPONSE_EVENT,
  DEFAULT_SOLAR_SYSTEM_ID,
} = require('../src/model/celestial-body-upsert');
const { INVALID_SESSION_EVENT, INVALID_SESSION_MESSAGE } = require('../src/model/session');
const {
  createCelestialBody,
  createMockSocket,
  createTestContext,
  seedPlayer,
} = require('../test-support/message-handler-test-helpers');

test('CelestialBodyUpsertMessageHandler upserts a celestial body by id', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'ScannerOne',
    sessionKey: 'session-1',
    characters: [{ id: 'character-1', characterName: 'RangerOne' }],
  });

  const handler = new CelestialBodyUpsertMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'scannerone',
    sessionKey: 'session-1',
    celestialBody: createCelestialBody({ id: 'cb-1', createdByCharacterId: 'character-1' }),
  });

  assert.equal(response.success, true);
  assert.equal(response.message, 'Celestial body recorded successfully');
  assert.equal(response.playerName, 'ScannerOne');
  assert.equal(response.celestialBody.id, 'cb-1');
  assert.equal(response.celestialBody.spatial.solarSystemId, DEFAULT_SOLAR_SYSTEM_ID);
  assert.equal(context.getCelestialBody('cb-1').spatial.solarSystemId, DEFAULT_SOLAR_SYSTEM_ID);
  assert.equal(socket.events[0].eventName, CELESTIAL_BODY_UPSERT_RESPONSE_EVENT);
});

test('CelestialBodyUpsertMessageHandler validates createdByCharacterId', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'ScannerOne',
    sessionKey: 'session-1',
    characters: [{ id: 'character-1', characterName: 'RangerOne' }],
  });

  const handler = new CelestialBodyUpsertMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'ScannerOne',
    sessionKey: 'session-1',
    celestialBody: createCelestialBody({ id: 'cb-1', createdByCharacterId: 'character-404' }),
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
    characters: [{ id: 'character-1', characterName: 'RangerOne' }],
  });

  const handler = new CelestialBodyUpsertMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'ScannerOne',
    sessionKey: 'wrong-session',
    celestialBody: createCelestialBody({ id: 'cb-1', createdByCharacterId: 'character-1' }),
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
    characters: [{ id: 'character-1', characterName: 'RangerOne' }],
  });

  const handler = new CelestialBodyUpsertMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'scannerone',
    sessionKey: 'session-1',
    celestialBody: {
      ...createCelestialBody({
        sourceScanId: 'sample-a3',
        missionId: 'first-target',
        state: 'unscanned',
        composition: null,
        createdByCharacterId: 'character-1',
      }),
      id: '',
    },
  });

  assert.equal(response.success, true);
  assert.equal(response.celestialBody.state, 'unscanned');
  assert.equal(response.celestialBody.missionId, 'first-target');
  assert.ok(response.celestialBody.id.startsWith('cb-character-1-first-target-sample-a3'));
  assert.equal(socket.events[0].eventName, CELESTIAL_BODY_UPSERT_RESPONSE_EVENT);
});

test('CelestialBodyUpsertMessageHandler accepts optional cluster metadata', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'ScannerOne',
    sessionKey: 'session-1',
    characters: [{ id: 'character-1', characterName: 'RangerOne' }],
  });

  const handler = new CelestialBodyUpsertMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'scannerone',
    sessionKey: 'session-1',
    celestialBody: createCelestialBody({
      id: 'cb-cluster-1',
      createdByCharacterId: 'character-1',
      clusterId: 'mission-first-target-cluster-1',
      clusterCenterKm: { x: 0, y: 0, z: 0 },
      localOffsetKm: { x: 125, y: -40, z: 12 },
    }),
  });

  assert.equal(response.success, true);
  assert.equal(response.celestialBody.clusterId, 'mission-first-target-cluster-1');
  assert.deepEqual(response.celestialBody.clusterCenterKm, { x: 0, y: 0, z: 0 });
  assert.deepEqual(response.celestialBody.localOffsetKm, { x: 125, y: -40, z: 12 });
  assert.equal(socket.events[0].eventName, CELESTIAL_BODY_UPSERT_RESPONSE_EVENT);
});

test('CelestialBodyUpsertMessageHandler rejects legacy location field', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'ScannerOne',
    sessionKey: 'session-1',
    characters: [{ id: 'character-1', characterName: 'RangerOne' }],
  });

  const handler = new CelestialBodyUpsertMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'scannerone',
    sessionKey: 'session-1',
    celestialBody: {
      ...createCelestialBody({ id: 'cb-1', createdByCharacterId: 'character-1' }),
      location: { positionKm: { x: 1, y: 2, z: 3 } },
    },
  });

  assert.equal(response.success, false);
  assert.equal(
    response.message,
    "CelestialBodyUpsert: legacy field 'location' is not supported. Use 'spatial' instead."
  );
  assert.equal(socket.events[0].eventName, CELESTIAL_BODY_UPSERT_RESPONSE_EVENT);
});

test('CelestialBodyUpsertMessageHandler rejects legacy kinematics field', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'ScannerOne',
    sessionKey: 'session-1',
    characters: [{ id: 'character-1', characterName: 'RangerOne' }],
  });

  const handler = new CelestialBodyUpsertMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'scannerone',
    sessionKey: 'session-1',
    celestialBody: {
      ...createCelestialBody({ id: 'cb-1', createdByCharacterId: 'character-1' }),
      kinematics: {
        velocityKmPerSec: { x: 1, y: 0, z: 0 },
      },
    },
  });

  assert.equal(response.success, false);
  assert.equal(
    response.message,
    "CelestialBodyUpsert: legacy field 'kinematics' is not supported. Use 'motion' and/or 'physical' instead."
  );
  assert.equal(socket.events[0].eventName, CELESTIAL_BODY_UPSERT_RESPONSE_EVENT);
});

test('CelestialBodyUpsertMessageHandler rejects root solarSystemId field', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'ScannerOne',
    sessionKey: 'session-1',
    characters: [{ id: 'character-1', characterName: 'RangerOne' }],
  });

  const handler = new CelestialBodyUpsertMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'scannerone',
    sessionKey: 'session-1',
    celestialBody: {
      ...createCelestialBody({ id: 'cb-1', createdByCharacterId: 'character-1' }),
      solarSystemId: 'sol',
    },
  });

  assert.equal(response.success, false);
  assert.equal(
    response.message,
    "CelestialBodyUpsert: legacy field 'solarSystemId' is not supported. Use 'spatial.solarSystemId' instead."
  );
  assert.equal(socket.events[0].eventName, CELESTIAL_BODY_UPSERT_RESPONSE_EVENT);
});
