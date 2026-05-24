'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { MissionUpsertMessageHandler } = require('../src/handlers/mission-upsert-message-handler');
const { MISSION_UPSERT_RESPONSE_EVENT } = require('../src/model/mission-upsert');
const { INVALID_SESSION_EVENT, INVALID_SESSION_MESSAGE } = require('../src/model/session');
const {
  createMockSocket,
  createTestContext,
  seedPlayer,
} = require('../test-support/message-handler-test-helpers');

function seedMissionPilot(context, missions = []) {
  seedPlayer(context, {
    playerName: 'MissionPilot',
    sessionKey: 'session-1',
    characters: [
      {
        id: 'character-1',
        characterName: 'RangerOne',
        missions,
      },
    ],
  });
}

test('MissionUpsertMessageHandler upserts mission progress to a character', async () => {
  const context = createTestContext();
  seedMissionPilot(context, []);

  const handler = new MissionUpsertMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'missionpilot',
    characterId: 'character-1',
    missionId: 'first-target',
    status: 'started',
    sessionKey: 'session-1',
  });

  assert.equal(response.success, true);
  assert.equal(response.message, 'Mission recorded successfully');
  assert.equal(response.playerName, 'MissionPilot');
  assert.equal(response.characterId, 'character-1');
  assert.equal(response.mission.missionId, 'first-target');
  assert.equal(response.mission.status, 'started');
  assert.equal(response.mission.startedAt, '2026-04-17T00:00:00.000Z');
  assert.equal(response.mission.updatedAt, '2026-04-17T00:00:00.000Z');

  const missions = context.getCharacters('missionpilot')[0].missions;
  const mission = missions.find((entry) => entry.missionId === 'first-target');
  assert.ok(mission);
  assert.equal(mission.status, 'started');
  assert.equal(socket.events[0].eventName, MISSION_UPSERT_RESPONSE_EVENT);
});

test('MissionUpsertMessageHandler updates existing mission (upsert)', async () => {
  const context = createTestContext();
  seedMissionPilot(context, [
    {
      missionId: 'first-target',
      status: 'started',
      startedAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z',
    },
  ]);

  const handler = new MissionUpsertMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'MissionPilot',
    characterId: 'character-1',
    missionId: 'first-target',
    status: 'in-progress',
    sessionKey: 'session-1',
  });

  assert.equal(response.success, true);
  assert.equal(response.mission.status, 'in-progress');
  assert.equal(response.mission.startedAt, '2026-04-01T00:00:00.000Z');
  assert.equal(response.mission.inProgressAt, '2026-04-17T00:00:00.000Z');
  assert.equal(response.mission.updatedAt, '2026-04-17T00:00:00.000Z');

  const mission = context
    .getCharacters('missionpilot')[0]
    .missions.find((entry) => entry.missionId === 'first-target');
  assert.ok(mission);
  assert.equal(mission.status, 'in-progress');
  assert.equal(socket.events[0].eventName, MISSION_UPSERT_RESPONSE_EVENT);
});

test('MissionUpsertMessageHandler requires status field', async () => {
  const context = createTestContext();
  seedMissionPilot(context, []);

  const handler = new MissionUpsertMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'MissionPilot',
    characterId: 'character-1',
    missionId: 'first-target',
    sessionKey: 'session-1',
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
    missionId: 'first-target',
    status: 'available',
    sessionKey: 'session-1',
  });

  assert.equal(response.success, false);
  assert.equal(response.message, 'Player is not registered');
});

test('MissionUpsertMessageHandler rejects unknown character', async () => {
  const context = createTestContext();
  seedMissionPilot(context, []);

  const handler = new MissionUpsertMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'MissionPilot',
    characterId: 'no-such-character',
    missionId: 'first-target',
    status: 'available',
    sessionKey: 'session-1',
  });

  assert.equal(response.success, false);
  assert.equal(response.message, 'Character is not in player list');
  assert.equal(socket.events[0].eventName, MISSION_UPSERT_RESPONSE_EVENT);
});

test('MissionUpsertMessageHandler emits invalid session before mutation', async () => {
  const context = createTestContext();
  seedMissionPilot(context, []);

  const handler = new MissionUpsertMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'MissionPilot',
    characterId: 'character-1',
    missionId: 'first-target',
    status: 'started',
    sessionKey: 'wrong-session',
  });

  assert.deepEqual(response, { message: INVALID_SESSION_MESSAGE });
  assert.equal(context.getCharacters('missionpilot')[0].missions.length, 0);
  assert.equal(socket.events[0].eventName, INVALID_SESSION_EVENT);
});

test('MissionUpsertMessageHandler handles all canonical status values', async () => {
  const canonicalStatuses = [
    'available',
    'started',
    'in-progress',
    'failed',
    'completed',
    'locked',
    'abandoned',
    'paused',
    'turned-in',
  ];

  for (const status of canonicalStatuses) {
    const context = createTestContext();
    seedMissionPilot(context, []);

    const handler = new MissionUpsertMessageHandler(context);
    const socket = createMockSocket();

    const response = await handler.handle(socket, {
      playerName: 'MissionPilot',
      characterId: 'character-1',
      missionId: 'm-01',
      status,
      sessionKey: 'session-1',
    });

    assert.equal(response.success, true, `Expected success for status "${status}"`);
    assert.equal(response.mission.status, status);
  }
});

test('MissionUpsertMessageHandler rejects unknown mission ids', async () => {
  const context = createTestContext();
  seedMissionPilot(context, []);

  const handler = new MissionUpsertMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'MissionPilot',
    characterId: 'character-1',
    missionId: 'not-in-catalog',
    status: 'available',
    sessionKey: 'session-1',
  });

  assert.equal(response.success, false);
  assert.ok(response.message.includes('missionId must be one of'));
});

test('MissionUpsertMessageHandler seeds first-target asteroid field on mission start', async () => {
  const context = createTestContext();
  seedMissionPilot(context, []);

  const handler = new MissionUpsertMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'MissionPilot',
    characterId: 'character-1',
    missionId: 'first-target',
    status: 'started',
    sessionKey: 'session-1',
  });

  assert.equal(response.success, true);

  const seededField = await context.getCelestialBodiesAsync({
    createdByCharacterId: 'character-1',
    missionId: 'first-target',
  });

  assert.equal(seededField.length, 10);
  assert.ok(seededField.every((body) => body.state === 'unscanned'));
  assert.ok(seededField.every((body) => body.missionId === 'first-target'));
  assert.ok(seededField.every((body) => body.sourceScanId));
  assert.ok(seededField.every((body) => body.bodyType === 'asteroid'));
  assert.ok(seededField.every((body) => typeof body.clusterId === 'string' && body.clusterId));
  assert.ok(
    seededField.every(
      (body) =>
        body.clusterCenterKm &&
        body.clusterCenterKm.x === 0 &&
        body.clusterCenterKm.y === 0 &&
        body.clusterCenterKm.z === 0
    )
  );
  assert.ok(
    seededField.every(
      (body) =>
        body.localOffsetKm &&
        body.localOffsetKm.x === body.spatial.positionKm.x &&
        body.localOffsetKm.y === body.spatial.positionKm.y &&
        body.localOffsetKm.z === body.spatial.positionKm.z
    )
  );
  assert.ok(seededField.every((body) => typeof body.distanceFromClusterCenterKm === 'number'));
  assert.ok(
    seededField.every(
      (body) =>
        body.physicalCatalog &&
        typeof body.physicalCatalog.estimatedDiameterM === 'number' &&
        typeof body.physicalCatalog.estimatedMassKg === 'number' &&
        typeof body.physicalCatalog.radiusKm === 'number'
    )
  );
  assert.ok(
    seededField.every(
      (body) =>
        body.visualization &&
        typeof body.visualization.colorHex === 'string' &&
        typeof body.visualization.textureKey === 'string'
    )
  );
});

test('MissionUpsertMessageHandler does not duplicate first-target asteroid field on repeated start', async () => {
  const context = createTestContext();
  seedMissionPilot(context, []);

  const handler = new MissionUpsertMessageHandler(context);
  const socket = createMockSocket();

  await handler.handle(socket, {
    playerName: 'MissionPilot',
    characterId: 'character-1',
    missionId: 'first-target',
    status: 'started',
    sessionKey: 'session-1',
  });

  await handler.handle(socket, {
    playerName: 'MissionPilot',
    characterId: 'character-1',
    missionId: 'first-target',
    status: 'started',
    sessionKey: 'session-1',
  });

  const seededField = await context.getCelestialBodiesAsync({
    createdByCharacterId: 'character-1',
    missionId: 'first-target',
  });

  assert.equal(seededField.length, 10);
});

test('MissionUpsertMessageHandler persists statusDetail exactly as sent', async () => {
  const context = createTestContext();
  seedMissionPilot(context, []);

  const handler = new MissionUpsertMessageHandler(context);
  const response = await handler.handle(createMockSocket(), {
    playerName: 'MissionPilot',
    characterId: 'character-1',
    missionId: 'm-01',
    status: 'in-progress',
    statusDetail: '  Keep spacing exactly.  ',
    sessionKey: 'session-1',
  });

  assert.equal(response.success, true);
  assert.equal(response.mission.statusDetail, '  Keep spacing exactly.  ');
  const mission = context
    .getCharacters('missionpilot')[0]
    .missions.find((entry) => entry.missionId === 'm-01');
  assert.equal(mission.statusDetail, '  Keep spacing exactly.  ');
});

test('MissionUpsertMessageHandler completing first-target unlocks dependent missions once', async () => {
  const context = createTestContext();
  seedMissionPilot(context, []);
  const handler = new MissionUpsertMessageHandler(context);

  const payload = {
    playerName: 'MissionPilot',
    characterId: 'character-1',
    missionId: 'first-target',
    status: 'completed',
    sessionKey: 'session-1',
  };

  const firstResponse = await handler.handle(createMockSocket(), payload);
  assert.equal(firstResponse.success, true);

  const secondResponse = await handler.handle(createMockSocket(), payload);
  assert.equal(secondResponse.success, true);

  const missions = context.getCharacters('missionpilot')[0].missions;
  const missionIds = missions.map((mission) => mission.missionId);

  assert.equal(missionIds.filter((missionId) => missionId === 'm-01').length, 1);
  assert.equal(missionIds.filter((missionId) => missionId === 'sq-02').length, 1);
  assert.equal(missionIds.filter((missionId) => missionId === 'sq-03').length, 1);

  const m01 = missions.find((mission) => mission.missionId === 'm-01');
  const sq02 = missions.find((mission) => mission.missionId === 'sq-02');
  const sq03 = missions.find((mission) => mission.missionId === 'sq-03');
  assert.equal(m01.status, 'available');
  assert.equal(sq02.status, 'available');
  assert.equal(sq03.status, 'available');
});

test('MissionUpsertMessageHandler echoes requestId when present', async () => {
  const context = createTestContext();
  seedMissionPilot(context, []);
  const handler = new MissionUpsertMessageHandler(context);

  const response = await handler.handle(createMockSocket(), {
    playerName: 'MissionPilot',
    characterId: 'character-1',
    missionId: 'm-01',
    status: 'started',
    requestId: 'req-123',
    sessionKey: 'session-1',
  });

  assert.equal(response.success, true);
  assert.equal(response.requestId, 'req-123');
});
