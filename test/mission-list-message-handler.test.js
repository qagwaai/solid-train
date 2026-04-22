'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MissionListMessageHandler
} = require('../src/handlers/mission-list-message-handler');
const {
  MISSION_LIST_RESPONSE_EVENT
} = require('../src/model/mission-list');
const {
  INVALID_SESSION_EVENT,
  INVALID_SESSION_MESSAGE
} = require('../src/model/session');
const {
  createMockSocket,
  createTestContext,
  seedPlayer
} = require('../test-support/message-handler-test-helpers');

test('MissionListMessageHandler returns missions for a character', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'MissionPilot',
    sessionKey: 'session-1',
    characters: [
      {
        id: 'character-1',
        characterName: 'RangerOne',
        missions: [
          {
            missionId: 'The First Target',
            status: 'completed',
            completedAt: '2026-04-17T00:00:00.000Z',
            updatedAt: '2026-04-17T00:00:00.000Z'
          },
          {
            missionId: 'Moon Relay',
            status: 'available',
            updatedAt: '2026-04-17T00:00:00.000Z'
          }
        ]
      }
    ]
  });

  const handler = new MissionListMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'missionpilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
    statuses: ['completed']
  });

  assert.equal(response.success, true);
  assert.equal(response.message, 'Mission list retrieved successfully');
  assert.equal(response.playerName, 'MissionPilot');
  assert.equal(response.characterId, 'character-1');
  assert.equal(response.missions.length, 1);
  assert.equal(response.missions[0].missionId, 'The First Target');
  assert.equal(socket.events[0].eventName, MISSION_LIST_RESPONSE_EVENT);
});

test('MissionListMessageHandler emits invalid session for wrong key', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'MissionPilot',
    sessionKey: 'session-1',
    characters: [
      {
        id: 'character-1',
        characterName: 'RangerOne',
        missions: [{ missionId: 'The First Target', status: 'available' }]
      }
    ]
  });

  const handler = new MissionListMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'MissionPilot',
    characterId: 'character-1',
    sessionKey: 'wrong-session'
  });

  assert.deepEqual(response, { message: INVALID_SESSION_MESSAGE });
  assert.equal(socket.events[0].eventName, INVALID_SESSION_EVENT);
});
