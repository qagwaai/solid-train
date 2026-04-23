'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DroneUpsertMessageHandler
} = require('../src/handlers/drone-upsert-message-handler');
const {
  DRONE_UPSERT_RESPONSE_EVENT
} = require('../src/model/drone-upsert');
const {
  INVALID_SESSION_EVENT,
  INVALID_SESSION_MESSAGE
} = require('../src/model/session');
const {
  createMockSocket,
  createTestContext,
  seedPlayer
} = require('../test-support/message-handler-test-helpers');

function createDroneUpdate(overrides = {}) {
  return {
    id: 'drone-1',
    location: {
      positionKm: { x: 100.5, y: 200.3, z: 50.1 }
    },
    kinematics: {
      position: { x: 100.5, y: 200.3, z: 50.1 },
      velocity: { x: 0.5, y: -0.2, z: 0.1 },
      reference: {
        solarSystemId: 'system-sol',
        referenceKind: 'barycentric',
        referenceBodyId: null,
        epochMs: 1713607200000
      }
    },
    ...overrides
  };
}

test('DroneUpsertMessageHandler updates drone location and kinematics', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'DronePilot',
    sessionKey: 'session-1',
    characters: [
      {
        id: 'character-1',
        characterName: 'RangerOne',
        drones: [
          {
            id: 'drone-1',
            droneName: 'Scout Drone',
            createdAt: '2026-04-17T00:00:00.000Z'
          }
        ]
      }
    ]
  });

  const handler = new DroneUpsertMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'dronepilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
    drone: createDroneUpdate()
  });

  assert.equal(response.success, true);
  assert.equal(response.message, 'Drone updated successfully');
  assert.equal(response.playerName, 'DronePilot');
  assert.equal(response.characterId, 'character-1');
  assert.equal(response.drone.id, 'drone-1');
  assert.deepEqual(response.drone.location, {
    positionKm: { x: 100.5, y: 200.3, z: 50.1 }
  });
  assert.deepEqual(response.drone.kinematics.reference, {
    solarSystemId: 'system-sol',
    referenceKind: 'barycentric',
    referenceBodyId: null,
    distanceUnit: 'km',
    velocityUnit: 'km/s',
    epochMs: 1713607200000
  });
  assert.equal(socket.events[0].eventName, DRONE_UPSERT_RESPONSE_EVENT);
});

test('DroneUpsertMessageHandler rejects missing location and kinematics update', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'DronePilot',
    sessionKey: 'session-1',
    characters: [
      {
        id: 'character-1',
        characterName: 'RangerOne',
        drones: [{ id: 'drone-1', droneName: 'Scout Drone', createdAt: '2026-04-17T00:00:00.000Z' }]
      }
    ]
  });

  const handler = new DroneUpsertMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'DronePilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
    drone: { id: 'drone-1' }
  });

  assert.equal(response.success, false);
  assert.equal(response.message, 'drone.location and/or drone.kinematics is required');
  assert.equal(socket.events[0].eventName, DRONE_UPSERT_RESPONSE_EVENT);
});

test('DroneUpsertMessageHandler emits invalid session before mutation', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'SessionPilot',
    sessionKey: 'session-1',
    characters: [
      {
        id: 'character-1',
        characterName: 'RangerOne',
        drones: [{ id: 'drone-1', droneName: 'Scout Drone', createdAt: '2026-04-17T00:00:00.000Z' }]
      }
    ]
  });

  const handler = new DroneUpsertMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'SessionPilot',
    characterId: 'character-1',
    sessionKey: 'wrong-session',
    drone: createDroneUpdate()
  });

  assert.deepEqual(response, { message: INVALID_SESSION_MESSAGE });
  assert.equal(socket.events[0].eventName, INVALID_SESSION_EVENT);
});