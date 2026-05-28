'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { MissionListMessageHandler } = require('../src/handlers/mission-list-message-handler');
const { MISSION_LIST_RESPONSE_EVENT } = require('../src/model/mission-list');
const { INVALID_SESSION_EVENT, INVALID_SESSION_MESSAGE } = require('../src/model/session');
const {
  createMockSocket,
  createTestContext,
  seedPlayer,
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
            missionId: 'first-target',
            status: 'completed',
            updatedAt: '2026-04-17T00:00:00.000Z',
          },
          {
            missionId: 'm-01',
            status: 'available',
            updatedAt: '2026-04-17T00:00:00.000Z',
          },
        ],
      },
    ],
  });

  const handler = new MissionListMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'missionpilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
    statuses: ['completed'],
  });

  assert.equal(response.success, true);
  assert.equal(response.message, 'Mission list retrieved successfully');
  assert.equal(response.playerName, 'MissionPilot');
  assert.equal(response.characterId, 'character-1');
  assert.equal(response.missions.length, 1);
  assert.equal(response.missions[0].missionId, 'first-target');
  assert.equal(response.missions[0].status, 'completed');
  assert.equal(response.missions[0].updatedAt, '2026-04-17T00:00:00.000Z');
  assert.equal(socket.events[0].eventName, MISSION_LIST_RESPONSE_EVENT);
});

test('MissionListMessageHandler returns deterministic mission ordering', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'MissionPilot',
    sessionKey: 'session-1',
    characters: [
      {
        id: 'character-1',
        characterName: 'RangerOne',
        missions: [
          { missionId: 'sq-03', status: 'available', updatedAt: '2026-04-17T00:00:00.000Z' },
          { missionId: 'm-02', status: 'active', updatedAt: '2026-04-17T00:00:00.000Z' },
          { missionId: 'first-target', status: 'completed', updatedAt: '2026-04-17T00:00:00.000Z' },
          { missionId: 'sq-01', status: 'active', updatedAt: '2026-04-17T00:00:00.000Z' },
        ],
      },
    ],
  });

  const handler = new MissionListMessageHandler(context);
  const response = await handler.handle(createMockSocket(), {
    playerName: 'MissionPilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
  });

  assert.equal(response.success, true);
  assert.deepEqual(
    response.missions.map((mission) => mission.missionId),
    ['first-target', 'm-02', 'sq-01', 'sq-03']
  );
});

test('MissionListMessageHandler echoes requestId when present', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'MissionPilot',
    sessionKey: 'session-1',
    characters: [{ id: 'character-1', characterName: 'RangerOne', missions: [] }],
  });

  const handler = new MissionListMessageHandler(context);
  const response = await handler.handle(createMockSocket(), {
    playerName: 'MissionPilot',
    characterId: 'character-1',
    requestId: 'req-list-123',
    sessionKey: 'session-1',
  });

  assert.equal(response.success, true);
  assert.equal(response.requestId, 'req-list-123');
  assert.ok(Array.isArray(response.missions));
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
        missions: [{ missionId: 'The First Target', status: 'available' }],
      },
    ],
  });

  const handler = new MissionListMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'MissionPilot',
    characterId: 'character-1',
    sessionKey: 'wrong-session',
  });

  assert.deepEqual(response, { message: INVALID_SESSION_MESSAGE });
  assert.equal(socket.events[0].eventName, INVALID_SESSION_EVENT);
});

test('MissionListMessageHandler rejects unknown requested statuses with terminal failure', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'MissionPilot',
    sessionKey: 'session-1',
    characters: [
      {
        id: 'character-1',
        characterName: 'RangerOne',
        missions: [{ missionId: 'first-target', status: 'available' }],
      },
    ],
  });

  const handler = new MissionListMessageHandler(context);
  const response = await handler.handle(createMockSocket(), {
    playerName: 'MissionPilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
    statuses: ['paused'],
  });

  assert.equal(response.success, false);
  assert.match(response.message, /unsupported values: paused/);
  assert.deepEqual(response.missions, []);
});
