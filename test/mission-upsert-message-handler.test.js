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

test('MissionUpsertMessageHandler upserts mission progress to a character', async () => {
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
    missionId: 'The First Target',
    status: 'started',
    sessionKey: 'session-1'
  });

  assert.equal(response.success, true);
  assert.equal(response.message, 'Mission recorded successfully');
  assert.equal(response.playerName, 'MissionPilot');
  assert.equal(response.characterId, 'character-1');
  assert.equal(response.mission.missionId, 'The First Target');
  assert.equal(response.mission.status, 'started');
  assert.equal(response.mission.startedAt, '2026-04-17T00:00:00.000Z');
  assert.equal(response.mission.updatedAt, '2026-04-17T00:00:00.000Z');

  const mission = context.getCharacters('missionpilot')[0].missions[0];
  assert.equal(mission.missionId, 'The First Target');
  assert.equal(mission.status, 'started');
  assert.equal(socket.events[0].eventName, MISSION_UPSERT_RESPONSE_EVENT);
});

test('MissionUpsertMessageHandler updates existing mission (upsert)', async () => {
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
            status: 'started',
            startedAt: '2026-04-01T00:00:00.000Z',
            updatedAt: '2026-04-01T00:00:00.000Z'
          }
        ]
      }
    ]
  });

  const handler = new MissionUpsertMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'MissionPilot',
    characterId: 'character-1',
    missionId: 'The First Target',
    status: 'in-progress',
    sessionKey: 'session-1'
  });

  assert.equal(response.success, true);
  assert.equal(response.mission.status, 'in-progress');
  assert.equal(response.mission.startedAt, '2026-04-01T00:00:00.000Z');
  assert.equal(response.mission.inProgressAt, '2026-04-17T00:00:00.000Z');
  assert.equal(response.mission.updatedAt, '2026-04-17T00:00:00.000Z');

  const mission = context.getCharacters('missionpilot')[0].missions[0];
  assert.equal(mission.status, 'in-progress');
  assert.equal(socket.events[0].eventName, MISSION_UPSERT_RESPONSE_EVENT);
});

test('MissionUpsertMessageHandler requires status field', async () => {
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
    missionId: 'The First Target',
    sessionKey: 'session-1'
    // status omitted intentionally
  });

  assert.equal(response.success, false);
  assert.equal(response.message, 'playerName, characterId, missionId, and status are required');
  assert.equal(socket.events[0].eventName, MISSION_UPSERT_RESPONSE_EVENT);
});

test('MissionUpsertMessageHandler buildResponse rejects unregistered player', () => {
  const context = createTestContext();
  // No player seeded — validate buildResponse path directly

  const handler = new MissionUpsertMessageHandler(context);

  const response = handler.buildResponse({
    playerName: 'UnknownPlayer',
    characterId: 'character-1',
    missionId: 'The First Target',
    status: 'available',
    sessionKey: 'session-1'
  });

  assert.equal(response.success, false);
  assert.equal(response.message, 'Player is not registered');
});

test('MissionUpsertMessageHandler rejects unknown character', async () => {
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
    characterId: 'no-such-character',
    missionId: 'The First Target',
    status: 'available',
    sessionKey: 'session-1'
  });

  assert.equal(response.success, false);
  assert.equal(response.message, 'Character is not in player list');
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
    missionId: 'The First Target',
    status: 'started',
    sessionKey: 'wrong-session'
  });

  assert.deepEqual(response, { message: INVALID_SESSION_MESSAGE });
  assert.equal(context.getCharacters('missionpilot')[0].missions.length, 0);
  assert.equal(socket.events[0].eventName, INVALID_SESSION_EVENT);
});

test('MissionUpsertMessageHandler handles all canonical status values', async () => {
  const canonicalStatuses = [
    'available', 'started', 'in-progress', 'failed',
    'completed', 'locked', 'abandoned', 'paused', 'turned-in'
  ];

  for (const status of canonicalStatuses) {
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
      missionId: 'mission-x',
      status,
      sessionKey: 'session-1'
    });

    assert.equal(response.success, true, `Expected success for status "${status}"`);
    assert.equal(response.mission.status, status);
  }
});

test('MissionUpsertMessageHandler allows custom status strings', async () => {
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
    missionId: 'mission-x',
    status: 'reward-claimed',
    sessionKey: 'session-1'
  });

  assert.equal(response.success, true);
  assert.equal(response.mission.status, 'reward-claimed');
});

test('MissionUpsertMessageHandler seeds first-target asteroid field on mission start', async () => {
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
    sessionKey: 'session-1'
  });

  assert.equal(response.success, true);

  const seededField = await context.getCelestialBodiesAsync({
    createdByCharacterId: 'character-1',
    missionId: 'first-target'
  });

  assert.equal(seededField.length, 10);
  assert.ok(seededField.every((body) => body.state === 'unscanned'));
  assert.ok(seededField.every((body) => body.missionId === 'first-target'));
  assert.ok(seededField.every((body) => body.sourceScanId));
});

test('MissionUpsertMessageHandler does not duplicate first-target asteroid field on repeated start', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'MissionPilot',
    sessionKey: 'session-1',
    characters: [{ id: 'character-1', characterName: 'RangerOne', missions: [] }]
  });

  const handler = new MissionUpsertMessageHandler(context);
  const socket = createMockSocket();

  await handler.handle(socket, {
    playerName: 'MissionPilot',
    characterId: 'character-1',
    missionId: 'first-target',
    status: 'started',
    sessionKey: 'session-1'
  });

  await handler.handle(socket, {
    playerName: 'MissionPilot',
    characterId: 'character-1',
    missionId: 'first-target',
    status: 'started',
    sessionKey: 'session-1'
  });

  const seededField = await context.getCelestialBodiesAsync({
    createdByCharacterId: 'character-1',
    missionId: 'first-target'
  });

  assert.equal(seededField.length, 10);
});
