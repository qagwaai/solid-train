'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MissionUpsertMessageHandler
} = require('../src/handlers/mission-upsert-message-handler');
const {
  MISSION_UPSERT_RESPONSE_EVENT
} = require('../src/model/mission-upsert');
const {
  INVALID_SESSION_EVENT,
  INVALID_SESSION_MESSAGE
} = require('../src/model/session');
const {
  createMockSocket,
  createTestContext,
  seedPlayer
} = require('../test-support/message-handler-test-helpers');

test('MissionUpsertMessageHandler adds mission progress to a character', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'MissionPilot',
    sessionKey: 'session-1',
    characters: [
      {
        id: 'character-1',
        characterName: 'RangerOne',
        missions: []
      }
    ]
  });

  const handler = new MissionUpsertMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'missionpilot',
    characterId: 'character-1',
    missionId: 'first-target',
    status: 'started',
    sessionKey: 'session-1'
  });

  assert.equal(response.success, true);
  assert.equal(response.message, 'Mission recorded successfully');
  assert.equal(response.playerName, 'MissionPilot');
  assert.equal(response.characterId, 'character-1');
  assert.equal(response.mission.missionId, 'first-target');
  assert.equal(response.mission.status, 'started');
  assert.equal(response.mission.startedAt, '2026-04-17T00:00:00.000Z');
  assert.equal(response.mission.updatedAt, '2026-04-17T00:00:00.000Z');

  const mission = context.getCharacters('missionpilot')[0].missions[0];
  assert.equal(mission.missionId, 'first-target');
  assert.equal(mission.status, 'started');
  assert.equal(socket.events[0].eventName, MISSION_UPSERT_RESPONSE_EVENT);
});

test('MissionUpsertMessageHandler emits invalid session before mutation', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'MissionPilot',
    sessionKey: 'session-1',
    characters: [{ id: 'character-1', characterName: 'RangerOne', missions: [] }]
  });

  const handler = new MissionUpsertMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'MissionPilot',
    characterId: 'character-1',
    missionId: 'first-target',
    status: 'started',
    sessionKey: 'wrong-session'
  });

  assert.deepEqual(response, { message: INVALID_SESSION_MESSAGE });
  assert.equal(context.getCharacters('missionpilot')[0].missions.length, 0);
  assert.equal(socket.events[0].eventName, INVALID_SESSION_EVENT);
});
