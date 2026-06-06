'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../src/server');
const {
  listen,
  connectClient,
  waitForEvent,
  closeClient,
  registerAndLogin,
} = require('../test-support/socket-test-helpers');
const {
  CHARACTER_ADD_REQUEST_EVENT,
  CHARACTER_ADD_RESPONSE_EVENT,
} = require('../src/model/character-add');
const {
  CHARACTER_BUST_CREATE_REQUEST_EVENT,
  CHARACTER_BUST_CREATE_RESPONSE_EVENT,
} = require('../src/model/character-bust-create');
const {
  CHARACTER_BUST_READ_REQUEST_EVENT,
  CHARACTER_BUST_READ_RESPONSE_EVENT,
} = require('../src/model/character-bust-read');
const {
  CHARACTER_BUST_UPDATE_REQUEST_EVENT,
  CHARACTER_BUST_UPDATE_RESPONSE_EVENT,
} = require('../src/model/character-bust-update');
const {
  NPC_BUST_CREATE_REQUEST_EVENT,
  NPC_BUST_CREATE_RESPONSE_EVENT,
} = require('../src/model/npc-bust-create');
const {
  NPC_BUST_READ_REQUEST_EVENT,
  NPC_BUST_READ_RESPONSE_EVENT,
} = require('../src/model/npc-bust-read');
const {
  NPC_BUST_UPDATE_REQUEST_EVENT,
  NPC_BUST_UPDATE_RESPONSE_EVENT,
} = require('../src/model/npc-bust-update');
const { createMongoTestHarness } = require('../test-support/mongodb-test-helpers');

let mongoHarness = null;
let server = null;
let io = null;
let port = null;

function identity(operation, containerId) {
  return {
    operation,
    entityType: operation.includes('npc') ? 'npc-bust' : 'character-bust',
    containerId,
  };
}

async function addCharacter(client, playerName, sessionKey, characterName) {
  const addResponsePromise = waitForEvent(client, CHARACTER_ADD_RESPONSE_EVENT);
  client.emit(CHARACTER_ADD_REQUEST_EVENT, {
    playerName,
    sessionKey,
    characterName,
  });

  const addResponse = await addResponsePromise;
  assert.equal(addResponse.success, true);
  assert.equal(typeof addResponse.characterId, 'string');
  assert.ok(addResponse.characterId.length > 0);
  return addResponse.characterId;
}

test.before(async () => {
  mongoHarness = await createMongoTestHarness();

  const created = createServer({
    port: '4601',
    databaseService: mongoHarness.databaseService,
  });

  server = created.server;
  io = created.io;
  port = await listen(server);
});

test.after(async () => {
  if (io) {
    io.close();
  }

  if (server) {
    server.close();
  }

  if (mongoHarness) {
    await mongoHarness.teardown();
  }
});

test.beforeEach(async () => {
  await mongoHarness.clearDatabase();
});

test('SW-15 M1 character bust create/read/update persists and normalizes descriptors', async () => {
  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  try {
    const playerName = 'M1PilotChar';
    const loginResponse = await registerAndLogin(
      client,
      playerName,
      'm1-pilot-char@example.com',
      'secure-pass-1'
    );
    const { sessionKey } = loginResponse;
    const characterId = await addCharacter(client, playerName, sessionKey, 'RoundTripOne');

    const createRequest = {
      playerName,
      sessionKey,
      correlationId: '4f40a8a9-868f-4283-a51f-05063f0f3ef4',
      requestIdentity: identity('character-bust-create', characterId),
      characterId,
      descriptor: {
        presetVersion: ' v1 ',
        faceShape: ' Round ',
        skinTone: 'LIGHT',
        hairStyle: 'SLICKED',
        hairColor: 'Auburn',
        eyeStyle: 'Wide',
        eyeColor: 'Hazel',
        expressionPreset: 'WARM',
        apparelAccent: 'COLLAR',
      },
    };

    const createResponsePromise = waitForEvent(client, CHARACTER_BUST_CREATE_RESPONSE_EVENT);
    client.emit(CHARACTER_BUST_CREATE_REQUEST_EVENT, createRequest);
    const createResponse = await createResponsePromise;
    assert.equal(createResponse.success, true);
    assert.equal(createResponse.blockedSave, undefined);
    assert.equal(createResponse.validationErrors, undefined);
    assert.equal(createResponse.characterId, characterId);
    assert.equal(createResponse.descriptor.schemaVersion, 'sw-15-m0-v1');
    assert.equal(createResponse.descriptor.presetVersion, 'v1');
    assert.equal(createResponse.descriptor.faceShape, 'round');
    assert.equal(createResponse.descriptor.apparelAccent, 'collar');

    const readResponsePromise = waitForEvent(client, CHARACTER_BUST_READ_RESPONSE_EVENT);
    client.emit(CHARACTER_BUST_READ_REQUEST_EVENT, {
      playerName,
      sessionKey,
      correlationId: '7d89f344-748b-42f9-9eaa-28fe0e0f59f8',
      requestIdentity: identity('character-bust-read', characterId),
      characterId,
    });
    const readResponse = await readResponsePromise;

    assert.equal(readResponse.success, true);
    assert.deepEqual(readResponse.descriptor, createResponse.descriptor);

    const updateResponsePromise = waitForEvent(client, CHARACTER_BUST_UPDATE_RESPONSE_EVENT);
    client.emit(CHARACTER_BUST_UPDATE_REQUEST_EVENT, {
      playerName,
      sessionKey,
      correlationId: 'd685a9c6-f3ca-4c37-b9c1-d1134ca49534',
      requestIdentity: identity('character-bust-update', characterId),
      characterId,
      descriptor: {
        presetVersion: 'v2',
        faceShape: 'angular',
        skinTone: 'medium',
        hairStyle: 'braided',
        hairColor: 'black',
        eyeStyle: 'almond',
        eyeColor: 'green',
        expressionPreset: 'focused',
        apparelAccent: 'visor',
      },
    });
    const updateResponse = await updateResponsePromise;

    assert.equal(updateResponse.success, true);
    assert.equal(updateResponse.blockedSave, undefined);
    assert.equal(updateResponse.validationErrors, undefined);
    assert.equal(updateResponse.descriptor.schemaVersion, 'sw-15-m0-v1');
    assert.equal(updateResponse.descriptor.presetVersion, 'v2');
    assert.equal(updateResponse.descriptor.faceShape, 'angular');

    const postUpdateReadPromise = waitForEvent(client, CHARACTER_BUST_READ_RESPONSE_EVENT);
    client.emit(CHARACTER_BUST_READ_REQUEST_EVENT, {
      playerName,
      sessionKey,
      correlationId: '6162a2f9-cd2d-4d2f-a5b3-ca4ec48f4bf5',
      requestIdentity: identity('character-bust-read', characterId),
      characterId,
    });
    const postUpdateRead = await postUpdateReadPromise;

    assert.equal(postUpdateRead.success, true);
    assert.deepEqual(postUpdateRead.descriptor, updateResponse.descriptor);

    const persistedDescriptor = await mongoHarness.databaseService.getCharacterBust(playerName, characterId);
    assert.ok(persistedDescriptor);
    assert.equal(persistedDescriptor.schemaVersion, 'sw-15-m0-v1');
    assert.equal(persistedDescriptor.presetVersion, 'v2');
    assert.equal(persistedDescriptor.hairStyle, 'braided');
  } finally {
    await closeClient(client);
  }
});

test('SW-15 M1 NPC bust create/read/update persists deterministic seed lifecycle', async () => {
  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  try {
    const playerName = 'M1PilotNpc';
    const loginResponse = await registerAndLogin(
      client,
      playerName,
      'm1-pilot-npc@example.com',
      'secure-pass-1'
    );
    const { sessionKey } = loginResponse;

    const createResponsePromise = waitForEvent(client, NPC_BUST_CREATE_RESPONSE_EVENT);
    client.emit(NPC_BUST_CREATE_REQUEST_EVENT, {
      playerName,
      sessionKey,
      correlationId: 'edc20643-1f95-4dfd-acf0-604fcd7eca61',
      requestIdentity: identity('npc-bust-create', 'npc-merchant-001'),
      npcId: 'npc-merchant-001',
      deterministicSeed: 'faction:trade|role:merchant|id:001',
    });
    const createResponse = await createResponsePromise;

    assert.equal(createResponse.success, true);
    assert.equal(createResponse.blockedSave, undefined);
    assert.equal(createResponse.validationErrors, undefined);
    assert.equal(createResponse.deterministicSeed, 'faction:trade|role:merchant|id:001');
    assert.equal(createResponse.descriptor.schemaVersion, 'sw-15-m0-v1');
    assert.equal(createResponse.descriptor.faceShape, 'round');
    assert.deepEqual(createResponse.appliedOverrides, []);

    const readResponsePromise = waitForEvent(client, NPC_BUST_READ_RESPONSE_EVENT);
    client.emit(NPC_BUST_READ_REQUEST_EVENT, {
      playerName,
      sessionKey,
      correlationId: '66f888fb-81f7-4b90-9814-2a4783b0f083',
      requestIdentity: identity('npc-bust-read', 'npc-merchant-001'),
      npcId: 'npc-merchant-001',
    });
    const readResponse = await readResponsePromise;

    assert.equal(readResponse.success, true);
    assert.deepEqual(readResponse.descriptor, createResponse.descriptor);
    assert.equal(readResponse.deterministicSeed, createResponse.deterministicSeed);

    const updateResponsePromise = waitForEvent(client, NPC_BUST_UPDATE_RESPONSE_EVENT);
    client.emit(NPC_BUST_UPDATE_REQUEST_EVENT, {
      playerName,
      sessionKey,
      correlationId: '8e70f896-b644-4701-95e8-f0f4e5e79f4b',
      requestIdentity: identity('npc-bust-update', 'npc-merchant-001'),
      npcId: 'npc-merchant-001',
      deterministicSeed: 'faction:trade|role:merchant|id:001',
      presetVersion: 'v2',
      overrides: {
        hairColor: ' RED ',
      },
    });
    const updateResponse = await updateResponsePromise;

    assert.equal(updateResponse.success, true);
    assert.equal(updateResponse.blockedSave, undefined);
    assert.equal(updateResponse.validationErrors, undefined);
    assert.equal(updateResponse.descriptor.presetVersion, 'v2');
    assert.equal(updateResponse.descriptor.hairColor, 'red');
    assert.deepEqual(updateResponse.appliedOverrides, ['hairColor']);

    const postUpdateReadPromise = waitForEvent(client, NPC_BUST_READ_RESPONSE_EVENT);
    client.emit(NPC_BUST_READ_REQUEST_EVENT, {
      playerName,
      sessionKey,
      correlationId: 'ce3dacaa-a307-4ba3-b2ef-f18f6102e6f5',
      requestIdentity: identity('npc-bust-read', 'npc-merchant-001'),
      npcId: 'npc-merchant-001',
    });
    const postUpdateRead = await postUpdateReadPromise;

    assert.equal(postUpdateRead.success, true);
    assert.deepEqual(postUpdateRead.descriptor, updateResponse.descriptor);
    assert.deepEqual(postUpdateRead.appliedOverrides, ['hairColor']);

    const persistedRecord = await mongoHarness.databaseService.getNpcBust('npc-merchant-001');
    assert.ok(persistedRecord);
    assert.equal(persistedRecord.deterministicSeed, 'faction:trade|role:merchant|id:001');
    assert.equal(persistedRecord.descriptor.schemaVersion, 'sw-15-m0-v1');
    assert.equal(persistedRecord.descriptor.presetVersion, 'v2');
    assert.deepEqual(persistedRecord.appliedOverrides, ['hairColor']);
  } finally {
    await closeClient(client);
  }
});

test('SW-15 M1 invalid writes hard-reject with validationErrors field/reason/rejectedValue evidence', async () => {
  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  try {
    const playerName = 'M1PilotInvalid';
    const loginResponse = await registerAndLogin(
      client,
      playerName,
      'm1-pilot-invalid@example.com',
      'secure-pass-1'
    );
    const { sessionKey } = loginResponse;
    const characterId = await addCharacter(client, playerName, sessionKey, 'InvalidWriteOne');

    const invalidCharacterResponsePromise = waitForEvent(client, CHARACTER_BUST_CREATE_RESPONSE_EVENT);
    client.emit(CHARACTER_BUST_CREATE_REQUEST_EVENT, {
      playerName,
      sessionKey,
      correlationId: 'ea55c8fb-5d56-4dba-bdd3-f76ad85d5dc0',
      requestIdentity: identity('character-bust-create', characterId),
      characterId,
      descriptor: {
        presetVersion: 'v1',
        faceShape: 'triangle',
        skinTone: 'light',
        hairStyle: 'slicked',
        hairColor: 'auburn',
        eyeStyle: 'wide',
        eyeColor: 'hazel',
        expressionPreset: 'warm',
        apparelAccent: 'collar',
      },
    });
    const invalidCharacterResponse = await invalidCharacterResponsePromise;

    assert.equal(invalidCharacterResponse.success, false);
    assert.equal(invalidCharacterResponse.blockedSave, undefined);
    assert.ok(Array.isArray(invalidCharacterResponse.validationErrors));
    assert.ok(invalidCharacterResponse.validationErrors.length > 0);
    assert.deepEqual(invalidCharacterResponse.validationErrors[0], {
      field: 'descriptor.faceShape',
      reason: 'must be one of: oval, round, square, angular, narrow',
      rejectedValue: 'triangle',
    });

    const invalidNpcResponsePromise = waitForEvent(client, NPC_BUST_CREATE_RESPONSE_EVENT);
    client.emit(NPC_BUST_CREATE_REQUEST_EVENT, {
      playerName,
      sessionKey,
      correlationId: 'f60b7645-6430-40d9-b218-e4997652f66e',
      requestIdentity: identity('npc-bust-create', 'npc-merchant-002'),
      npcId: 'npc-merchant-002',
      deterministicSeed: 'faction:trade|role:merchant|id:002',
      overrides: {
        hairStyle: 'spiky',
      },
    });
    const invalidNpcResponse = await invalidNpcResponsePromise;

    assert.equal(invalidNpcResponse.success, false);
    assert.equal(invalidNpcResponse.blockedSave, undefined);
    assert.ok(Array.isArray(invalidNpcResponse.validationErrors));
    assert.ok(invalidNpcResponse.validationErrors.length > 0);
    assert.deepEqual(invalidNpcResponse.validationErrors[0], {
      field: 'overrides.hairStyle',
      reason: 'must be one of: short-crop, mid-fade, long-loose, braided, shaved, slicked',
      rejectedValue: 'spiky',
    });
  } finally {
    await closeClient(client);
  }
});

test('SW-15 M2-A blocked-save responses emit typed reason and retryable semantics', async () => {
  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  try {
    const playerName = 'M2PilotBlocked';
    const loginResponse = await registerAndLogin(
      client,
      playerName,
      'm2-pilot-blocked@example.com',
      'secure-pass-1'
    );
    const { sessionKey } = loginResponse;
    const characterId = await addCharacter(client, playerName, sessionKey, 'BlockedTarget');

    const missingCharacterResponsePromise = waitForEvent(client, CHARACTER_BUST_CREATE_RESPONSE_EVENT);
    client.emit(CHARACTER_BUST_CREATE_REQUEST_EVENT, {
      playerName,
      sessionKey,
      correlationId: '7281c2db-f20f-4ce9-89d7-7923693f5f3c',
      requestIdentity: identity('character-bust-create', 'missing-character'),
      characterId: 'missing-character',
      descriptor: {
        presetVersion: 'v1',
        faceShape: 'round',
        skinTone: 'light',
        hairStyle: 'slicked',
        hairColor: 'auburn',
        eyeStyle: 'wide',
        eyeColor: 'hazel',
        expressionPreset: 'warm',
        apparelAccent: 'collar',
      },
    });
    const missingCharacterResponse = await missingCharacterResponsePromise;
    assert.equal(missingCharacterResponse.success, false);
    assert.equal(missingCharacterResponse.validationErrors, undefined);
    assert.deepEqual(missingCharacterResponse.blockedSave, {
      reason: 'CHARACTER_NOT_FOUND',
      retryable: false,
    });

    const missingNpcResponsePromise = waitForEvent(client, NPC_BUST_UPDATE_RESPONSE_EVENT);
    client.emit(NPC_BUST_UPDATE_REQUEST_EVENT, {
      playerName,
      sessionKey,
      correlationId: 'f8c14558-827a-435e-8bc0-6f8d0f74fc5a',
      requestIdentity: identity('npc-bust-update', 'npc-missing-001'),
      npcId: 'npc-missing-001',
      deterministicSeed: 'faction:trade|role:merchant|id:001',
      overrides: {
        eyeColor: 'blue',
      },
    });
    const missingNpcResponse = await missingNpcResponsePromise;
    assert.equal(missingNpcResponse.success, false);
    assert.equal(missingNpcResponse.validationErrors, undefined);
    assert.deepEqual(missingNpcResponse.blockedSave, {
      reason: 'NPC_BUST_NOT_FOUND',
      retryable: false,
    });

  } finally {
    await closeClient(client);
  }
});
