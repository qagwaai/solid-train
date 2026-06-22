'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { CharacterEditMessageHandler } = require('../src/handlers/character-edit-message-handler');
const { CHARACTER_EDIT_RESPONSE_EVENT } = require('../src/model/character-edit');
const {
  createMockSocket,
  createTestContext,
  seedPlayer,
} = require('../test-support/message-handler-test-helpers');

function createRequestIdentity(overrides = {}) {
  return {
    operation: 'character-edit',
    entityType: 'character',
    containerId: 'character-1',
    ...overrides,
  };
}

test('CharacterEditMessageHandler modifies an existing character', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'EditPilot',
    sessionKey: 'session-1',
    characters: [{ id: 'character-1', characterName: 'OldName' }],
  });
  const handler = new CharacterEditMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'editpilot',
    sessionKey: 'session-1',
    correlationId: 'f4740f89-47a4-4c43-914e-08c4f4c2fe16',
    requestIdentity: createRequestIdentity(),
    characterId: 'character-1',
    characterName: 'NewName',
  });

  assert.deepEqual(response, {
    success: true,
    message: 'Character edited successfully',
    playerName: 'EditPilot',
    characterId: 'character-1',
    characterName: 'NewName',
    correlationId: 'f4740f89-47a4-4c43-914e-08c4f4c2fe16',
    requestIdentity: createRequestIdentity(),
  });
  assert.equal(socket.events[0].eventName, CHARACTER_EDIT_RESPONSE_EVENT);
  assert.equal(context.getCharacters('editpilot')[0].characterName, 'NewName');
});

test('CharacterEditMessageHandler handles missing character in player list', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'EdgePilot',
    sessionKey: 'session-1',
    characters: [{ id: 'character-1', characterName: 'ExistingCharacter' }],
  });
  const handler = new CharacterEditMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'EdgePilot',
    sessionKey: 'session-1',
    correlationId: '87f7dd0a-6022-4c7a-b3b1-6b98aac0e0d9',
    requestIdentity: createRequestIdentity({ containerId: 'missing-character-id' }),
    characterId: 'missing-character-id',
    characterName: 'GhostName',
  });

  assert.deepEqual(response, {
    success: false,
    message: 'Character is not in player list',
    playerName: 'EdgePilot',
    characterId: 'missing-character-id',
    correlationId: '87f7dd0a-6022-4c7a-b3b1-6b98aac0e0d9',
    requestIdentity: createRequestIdentity({ containerId: 'missing-character-id' }),
  });
  assert.equal(socket.events[0].eventName, CHARACTER_EDIT_RESPONSE_EVENT);
  assert.deepEqual(context.getCharacters('edgepilot'), [
    { id: 'character-1', characterName: 'ExistingCharacter' },
  ]);
});

test('CharacterEditMessageHandler updates joined game participant name', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'EditPilot',
    sessionKey: 'session-1',
    characters: [{ id: 'character-1', characterName: 'OldName' }],
  });

  const joinedCharacter = context.getCharacters('editpilot')[0];
  context.joinCharacterToGame('EditPilot', joinedCharacter);

  const handler = new CharacterEditMessageHandler(context);
  const socket = createMockSocket();
  const response = await handler.handle(socket, {
    playerName: 'EditPilot',
    sessionKey: 'session-1',
    characterId: 'character-1',
    characterName: 'RenamedInGame',
  });

  assert.equal(response.success, true);
  const participant = context.game.getParticipant({
    normalizedPlayerName: 'editpilot',
    characterId: 'character-1',
  });
  assert.equal(participant.characterName, 'RenamedInGame');
});

test('CharacterEditMessageHandler retries DB version conflict once and succeeds', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'RetryPilot',
    sessionKey: 'session-1',
    characters: [{ id: 'character-1', characterName: 'OldName' }],
  });

  let updateCharacterCallCount = 0;
  context.databaseService = {
    async updateCharacter() {
      updateCharacterCallCount += 1;
      if (updateCharacterCallCount === 1) {
        throw new Error(
          'No matching document found for id "player-doc" version 6 modifiedPaths "characters"'
        );
      }
      return null;
    },
  };

  const handler = new CharacterEditMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'RetryPilot',
    sessionKey: 'session-1',
    characterId: 'character-1',
    characterName: 'NewName',
  });

  assert.equal(response.success, true);
  assert.equal(updateCharacterCallCount, 2);
  assert.equal(context.getCharacters('retrypilot')[0].characterName, 'NewName');
  assert.equal(socket.events[0].eventName, CHARACTER_EDIT_RESPONSE_EVENT);
});

test('CharacterEditMessageHandler echoes correlationId and requestIdentity on success and failure', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'EchoPilot',
    sessionKey: 'session-1',
    characters: [{ id: 'character-1', characterName: 'OldName' }],
  });
  const handler = new CharacterEditMessageHandler(context);

  const successSocket = createMockSocket();
  const successRequest = {
    playerName: 'EchoPilot',
    sessionKey: 'session-1',
    correlationId: 'cd02f046-3583-462f-a0bd-a8eb649dd10a',
    requestIdentity: createRequestIdentity(),
    characterId: 'character-1',
    characterName: 'NewName',
  };
  const successResponse = await handler.handle(successSocket, successRequest);
  assert.equal(successResponse.correlationId, successRequest.correlationId);
  assert.deepEqual(successResponse.requestIdentity, successRequest.requestIdentity);

  const errorSocket = createMockSocket();
  const errorRequest = {
    playerName: 'EchoPilot',
    sessionKey: 'session-1',
    correlationId: 'f6e7bfd5-6f64-4fea-9558-2a47de8f2ba6',
    requestIdentity: createRequestIdentity({ containerId: 'missing-character' }),
    characterId: 'missing-character',
    characterName: 'GhostName',
  };
  const errorResponse = await handler.handle(errorSocket, errorRequest);
  assert.equal(errorResponse.correlationId, errorRequest.correlationId);
  assert.deepEqual(errorResponse.requestIdentity, errorRequest.requestIdentity);
});
