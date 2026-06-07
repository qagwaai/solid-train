'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
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
        facialHair: ' STUBBLE ',
        scar: 'Cheek-Left',
        tattoo: 'Temple-Right',
      },
    };

    const createResponsePromise = waitForEvent(client, CHARACTER_BUST_CREATE_RESPONSE_EVENT);
    client.emit(CHARACTER_BUST_CREATE_REQUEST_EVENT, createRequest);
    const createResponse = await createResponsePromise;
    assert.equal(createResponse.success, true);
    assert.equal(createResponse.blockedSave, undefined);
    assert.equal(createResponse.validationErrors, undefined);
    assert.equal(createResponse.characterId, characterId);
    assert.equal(createResponse.descriptor.schemaVersion, 'sw-15-m1-v1');
    assert.equal(createResponse.descriptor.presetVersion, 'v1');
    assert.equal(createResponse.descriptor.faceShape, 'round');
    assert.equal(createResponse.descriptor.apparelAccent, 'collar');
    assert.equal(createResponse.descriptor.facialHair, 'stubble');
    assert.equal(createResponse.descriptor.scar, 'cheek-left');
    assert.equal(createResponse.descriptor.tattoo, 'temple-right');

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
        facialHair: 'goatee',
        scar: 'brow-right',
        tattoo: 'neck-left',
      },
    });
    const updateResponse = await updateResponsePromise;

    assert.equal(updateResponse.success, true);
    assert.equal(updateResponse.blockedSave, undefined);
    assert.equal(updateResponse.validationErrors, undefined);
    assert.equal(updateResponse.descriptor.schemaVersion, 'sw-15-m1-v1');
    assert.equal(updateResponse.descriptor.presetVersion, 'v2');
    assert.equal(updateResponse.descriptor.faceShape, 'angular');
    assert.equal(updateResponse.descriptor.facialHair, 'goatee');
    assert.equal(updateResponse.descriptor.scar, 'brow-right');
    assert.equal(updateResponse.descriptor.tattoo, 'neck-left');

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
    assert.equal(persistedDescriptor.schemaVersion, 'sw-15-m1-v1');
    assert.equal(persistedDescriptor.presetVersion, 'v2');
    assert.equal(persistedDescriptor.hairStyle, 'braided');
    assert.equal(persistedDescriptor.facialHair, 'goatee');
    assert.equal(persistedDescriptor.scar, 'brow-right');
    assert.equal(persistedDescriptor.tattoo, 'neck-left');
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
    assert.equal(createResponse.descriptor.schemaVersion, 'sw-15-m1-v1');
    assert.equal(createResponse.descriptor.faceShape, 'round');
    assert.equal(createResponse.descriptor.facialHair, 'none');
    assert.equal(createResponse.descriptor.scar, 'none');
    assert.equal(createResponse.descriptor.tattoo, 'none');
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
        facialHair: ' short-beard ',
        scar: 'chin',
        tattoo: 'NECK-RIGHT',
      },
    });
    const updateResponse = await updateResponsePromise;

    assert.equal(updateResponse.success, true);
    assert.equal(updateResponse.blockedSave, undefined);
    assert.equal(updateResponse.validationErrors, undefined);
    assert.equal(updateResponse.descriptor.presetVersion, 'v2');
    assert.equal(updateResponse.descriptor.hairColor, 'red');
    assert.equal(updateResponse.descriptor.facialHair, 'short-beard');
    assert.equal(updateResponse.descriptor.scar, 'chin');
    assert.equal(updateResponse.descriptor.tattoo, 'neck-right');
    assert.deepEqual(updateResponse.appliedOverrides, ['facialHair', 'hairColor', 'scar', 'tattoo']);

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
    assert.deepEqual(postUpdateRead.appliedOverrides, ['facialHair', 'hairColor', 'scar', 'tattoo']);

    const persistedRecord = await mongoHarness.databaseService.getNpcBust('npc-merchant-001');
    assert.ok(persistedRecord);
    assert.equal(persistedRecord.deterministicSeed, 'faction:trade|role:merchant|id:001');
    assert.equal(persistedRecord.descriptor.schemaVersion, 'sw-15-m1-v1');
    assert.equal(persistedRecord.descriptor.presetVersion, 'v2');
    assert.deepEqual(persistedRecord.appliedOverrides, ['facialHair', 'hairColor', 'scar', 'tattoo']);
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
        facialHair: 'none',
        scar: 'none',
        tattoo: 'none',
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
        tattoo: 'forehead',
      },
    });
    const invalidNpcResponse = await invalidNpcResponsePromise;

    assert.equal(invalidNpcResponse.success, false);
    assert.equal(invalidNpcResponse.blockedSave, undefined);
    assert.ok(Array.isArray(invalidNpcResponse.validationErrors));
    assert.ok(invalidNpcResponse.validationErrors.length > 0);
    assert.deepEqual(invalidNpcResponse.validationErrors[0], {
      field: 'overrides.tattoo',
      reason: 'must be one of: none, temple-left, temple-right, neck-left, neck-right',
      rejectedValue: 'forehead',
    });
  } finally {
    await closeClient(client);
  }
});

test('SW-15 M1 character bust create hard-rejects when new required fields are missing', async () => {
  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  try {
    const playerName = 'M1PilotMissingFields';
    const loginResponse = await registerAndLogin(
      client,
      playerName,
      'm1-pilot-missing-fields@example.com',
      'secure-pass-1'
    );
    const { sessionKey } = loginResponse;
    const characterId = await addCharacter(client, playerName, sessionKey, 'MissingFieldTarget');

    const cases = [
      { missingField: 'facialHair', correlationId: '8be1f85c-8ad6-431d-a057-3b71f88b73f5' },
      { missingField: 'scar', correlationId: 'bf5516c2-e6ec-4707-bdbc-268176f97f4b' },
      { missingField: 'tattoo', correlationId: 'd0f3423f-80b2-4bff-b47c-a36f699f8bf4' },
    ];

    for (const { missingField, correlationId } of cases) {
      const descriptor = {
        presetVersion: 'v1',
        faceShape: 'round',
        skinTone: 'light',
        hairStyle: 'slicked',
        hairColor: 'auburn',
        eyeStyle: 'wide',
        eyeColor: 'hazel',
        expressionPreset: 'warm',
        apparelAccent: 'collar',
        facialHair: 'none',
        scar: 'none',
        tattoo: 'none',
      };
      delete descriptor[missingField];

      const responsePromise = waitForEvent(client, CHARACTER_BUST_CREATE_RESPONSE_EVENT);
      client.emit(CHARACTER_BUST_CREATE_REQUEST_EVENT, {
        playerName,
        sessionKey,
        correlationId,
        requestIdentity: identity('character-bust-create', characterId),
        characterId,
        descriptor,
      });

      const response = await responsePromise;
      assert.equal(response.success, false);
      assert.equal(response.blockedSave, undefined);
      assert.ok(Array.isArray(response.validationErrors));
      assert.ok(response.validationErrors.length > 0);
      assert.equal(response.validationErrors[0].field, `descriptor.${missingField}`);
      assert.equal(response.validationErrors[0].reason, 'must be a non-empty string');
      assert.equal(response.validationErrors[0].rejectedValue, undefined);
    }
  } finally {
    await closeClient(client);
  }
});

test('SW-15 M1 npc-bust-create hard-rejects unknown override keys', async () => {
  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  try {
    const playerName = 'M1PilotUnknownOverride';
    const loginResponse = await registerAndLogin(
      client,
      playerName,
      'm1-pilot-unknown-override@example.com',
      'secure-pass-1'
    );
    const { sessionKey } = loginResponse;

    const responsePromise = waitForEvent(client, NPC_BUST_CREATE_RESPONSE_EVENT);
    client.emit(NPC_BUST_CREATE_REQUEST_EVENT, {
      playerName,
      sessionKey,
      correlationId: 'a4ef78e2-ec30-4b07-9a54-a3e4d6dd1f32',
      requestIdentity: identity('npc-bust-create', 'npc-merchant-unknown-override'),
      npcId: 'npc-merchant-unknown-override',
      deterministicSeed: 'faction:trade|role:merchant|id:003',
      overrides: {
        badField: 'anything',
      },
    });

    const response = await responsePromise;
    assert.equal(response.success, false);
    assert.equal(response.blockedSave, undefined);
    assert.ok(Array.isArray(response.validationErrors));
    assert.ok(response.validationErrors.length > 0);
    assert.deepEqual(response.validationErrors[0], {
      field: 'overrides.badField',
      reason: 'is not an overridable bust field',
      rejectedValue: 'anything',
    });
  } finally {
    await closeClient(client);
  }
});

test('SW-15 M1 npc deterministic seed parity includes new fields', async () => {
  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  try {
    const playerName = 'M1PilotSeedParity';
    const loginResponse = await registerAndLogin(
      client,
      playerName,
      'm1-pilot-seed-parity@example.com',
      'secure-pass-1'
    );
    const { sessionKey } = loginResponse;
    const deterministicSeed = 'faction:trade|role:merchant|id:parity';

    const createOnePromise = waitForEvent(client, NPC_BUST_CREATE_RESPONSE_EVENT);
    client.emit(NPC_BUST_CREATE_REQUEST_EVENT, {
      playerName,
      sessionKey,
      correlationId: '2be7df2d-7221-4fa6-b356-39f6d6a65e7b',
      requestIdentity: identity('npc-bust-create', 'npc-parity-1'),
      npcId: 'npc-parity-1',
      deterministicSeed,
    });
    const createOne = await createOnePromise;

    const createTwoPromise = waitForEvent(client, NPC_BUST_CREATE_RESPONSE_EVENT);
    client.emit(NPC_BUST_CREATE_REQUEST_EVENT, {
      playerName,
      sessionKey,
      correlationId: 'a9d65b16-72a2-46df-9a31-2788ec6ffabf',
      requestIdentity: identity('npc-bust-create', 'npc-parity-2'),
      npcId: 'npc-parity-2',
      deterministicSeed,
    });
    const createTwo = await createTwoPromise;

    assert.equal(createOne.success, true);
    assert.equal(createTwo.success, true);
    assert.deepEqual(createOne.descriptor, createTwo.descriptor);
    assert.equal(createOne.descriptor.facialHair, createTwo.descriptor.facialHair);
    assert.equal(createOne.descriptor.scar, createTwo.descriptor.scar);
    assert.equal(createOne.descriptor.tattoo, createTwo.descriptor.tattoo);
  } finally {
    await closeClient(client);
  }
});

test('SW-15 M1 character bust read preserves legacy schemaVersion values already stored', async () => {
  const client = connectClient(port);
  await waitForEvent(client, 'connect');

  try {
    const playerName = 'M1PilotLegacyRead';
    const loginResponse = await registerAndLogin(
      client,
      playerName,
      'm1-pilot-legacy-read@example.com',
      'secure-pass-1'
    );
    const { sessionKey } = loginResponse;
    const characterId = await addCharacter(client, playerName, sessionKey, 'LegacyReadTarget');

    const createResponsePromise = waitForEvent(client, CHARACTER_BUST_CREATE_RESPONSE_EVENT);
    client.emit(CHARACTER_BUST_CREATE_REQUEST_EVENT, {
      playerName,
      sessionKey,
      correlationId: '5fb5db66-f6d3-4c03-b0ff-c31be354f9f6',
      requestIdentity: identity('character-bust-create', characterId),
      characterId,
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
        facialHair: 'none',
        scar: 'none',
        tattoo: 'none',
      },
    });
    const createResponse = await createResponsePromise;
    assert.equal(createResponse.success, true);
    assert.equal(createResponse.descriptor.schemaVersion, 'sw-15-m1-v1');

    const Player = mongoose.model('Player');
    await Player.updateOne(
      {
        playerNameNormalized: playerName.toLowerCase(),
        'characters.id': characterId,
      },
      {
        $set: {
          'characters.$.bust.schemaVersion': 'sw-15-m0-v1',
        },
      }
    );

    const readResponsePromise = waitForEvent(client, CHARACTER_BUST_READ_RESPONSE_EVENT);
    client.emit(CHARACTER_BUST_READ_REQUEST_EVENT, {
      playerName,
      sessionKey,
      correlationId: 'a043e7e6-cc7d-4e6d-b6e9-97ca335c4f7f',
      requestIdentity: identity('character-bust-read', characterId),
      characterId,
    });
    const readResponse = await readResponsePromise;

    assert.equal(readResponse.success, true);
    assert.equal(readResponse.descriptor.schemaVersion, 'sw-15-m0-v1');
    assert.equal(readResponse.descriptor.facialHair, 'none');
    assert.equal(readResponse.descriptor.scar, 'none');
    assert.equal(readResponse.descriptor.tattoo, 'none');
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
        facialHair: 'none',
        scar: 'none',
        tattoo: 'none',
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
