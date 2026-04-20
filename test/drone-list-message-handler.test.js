'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DroneListMessageHandler
} = require('../src/handlers/drone-list-message-handler');
const {
  DRONE_LIST_RESPONSE_EVENT
} = require('../src/model/drone-list');
const {
  INVALID_SESSION_EVENT,
  INVALID_SESSION_MESSAGE
} = require('../src/model/session');
const {
  createMockSocket,
  createTestContext,
  seedPlayer
} = require('../test-support/message-handler-test-helpers');

test('DroneListMessageHandler returns drones for a player character', async () => {
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
            name: 'Scout Drone',
            status: 'active',
            model: 'scout-mk2',
            kinematics: {
              position: { x: 100.5, y: 200.3, z: 50.1 },
              velocity: { x: 0.5, y: -0.2, z: 0.1 },
              reference: {
                solarSystemId: 'system-sol',
                referenceKind: 'barycentric',
                referenceBodyId: null,
                epochMs: 1713607200000
              }
            }
          }
        ]
      }
    ]
  });
  const handler = new DroneListMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'dronepilot',
    characterId: 'character-1',
    sessionKey: 'session-1'
  });

  assert.equal(response.success, true);
  assert.equal(response.message, 'Drone list retrieved successfully');
  assert.equal(response.playerName, 'DronePilot');
  assert.equal(response.characterId, 'character-1');
  assert.deepEqual(response.drones, [
    {
      id: 'drone-1',
      name: 'Scout Drone',
      status: 'active',
      model: 'scout-mk2',
      kinematics: {
        position: { x: 100.5, y: 200.3, z: 50.1 },
        velocity: { x: 0.5, y: -0.2, z: 0.1 },
        reference: {
          solarSystemId: 'system-sol',
          referenceKind: 'barycentric',
          referenceBodyId: null,
          epochMs: 1713607200000
        }
      }
    }
  ]);
  assert.equal(socket.events[0].eventName, DRONE_LIST_RESPONSE_EVENT);
});

test('DroneListMessageHandler handles missing character in player list', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'EdgePilot',
    sessionKey: 'session-1',
    characters: [{ id: 'character-1', characterName: 'ExistingCharacter' }]
  });
  const handler = new DroneListMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'EdgePilot',
    characterId: 'missing-character-id',
    sessionKey: 'session-1'
  });

  assert.deepEqual(response, {
    success: false,
    message: 'Character is not in player list',
    playerName: 'EdgePilot',
    characterId: 'missing-character-id',
    drones: []
  });
  assert.equal(socket.events[0].eventName, DRONE_LIST_RESPONSE_EVENT);
});

test('DroneListMessageHandler emits invalid session when session is not valid', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'SessionPilot',
    sessionKey: 'session-1',
    characters: [{ id: 'character-1', characterName: 'RangerOne' }]
  });
  const handler = new DroneListMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'SessionPilot',
    characterId: 'character-1',
    sessionKey: 'wrong-session'
  });

  assert.deepEqual(response, { message: INVALID_SESSION_MESSAGE });
  assert.equal(socket.events[0].eventName, INVALID_SESSION_EVENT);
});

test('DroneListMessageHandler returns drones with kinematics data', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'KinematicsPilot',
    sessionKey: 'session-1',
    characters: [
      {
        id: 'character-1',
        characterName: 'Navigator',
        drones: [
          {
            id: 'drone-1',
            name: 'Orbital Scout',
            status: 'active',
            model: 'scout-mk3',
            kinematics: {
              position: { x: 150.0, y: 250.5, z: 75.3 },
              velocity: { x: 1.2, y: 0.8, z: -0.5 },
              reference: {
                solarSystemId: 'system-sol',
                referenceKind: 'body-centered',
                referenceBodyId: 'earth',
                epochMs: 1713607200000
              }
            }
          },
          {
            id: 'drone-2',
            name: 'Silent Runner',
            status: 'idle'
          }
        ]
      }
    ]
  });
  const handler = new DroneListMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'KinematicsPilot',
    characterId: 'character-1',
    sessionKey: 'session-1'
  });

  assert.equal(response.success, true);
  assert.equal(response.drones.length, 2);
  assert.deepEqual(response.drones[0].kinematics, {
    position: { x: 150.0, y: 250.5, z: 75.3 },
    velocity: { x: 1.2, y: 0.8, z: -0.5 },
    reference: {
      solarSystemId: 'system-sol',
      referenceKind: 'body-centered',
      referenceBodyId: 'earth',
      epochMs: 1713607200000
    }
  });
  assert.equal(response.drones[1].kinematics, undefined);
  assert.equal(socket.events[0].eventName, DRONE_LIST_RESPONSE_EVENT);
});