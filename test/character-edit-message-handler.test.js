'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CharacterEditMessageHandler
} = require('../src/handlers/character-edit-message-handler');
const {
  CHARACTER_EDIT_RESPONSE_EVENT
} = require('../src/model/character-edit');
const {
  INVALID_SESSION_EVENT,
  INVALID_SESSION_MESSAGE
} = require('../src/model/session');
const {
  createMockSocket,
  createTestContext,
  seedPlayer
} = require('../test-support/message-handler-test-helpers');

test('CharacterEditMessageHandler modifies an existing character', () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'EditPilot',
    sessionKey: 'session-1',
    characters: [{ id: 'character-1', characterName: 'OldName' }]
  });
  const handler = new CharacterEditMessageHandler(context);
  const socket = createMockSocket();

  const response = handler.handle(socket, {
    playerName: 'editpilot',
    sessionKey: 'session-1',
    characterId: 'character-1',
    characterName: 'NewName'
  });

  assert.deepEqual(response, {
    success: true,
    message: 'Character edited successfully',
    playerName: 'EditPilot',
    characterId: 'character-1',
    characterName: 'NewName'
  });
  assert.equal(socket.events[0].eventName, CHARACTER_EDIT_RESPONSE_EVENT);
  assert.equal(context.getCharacters('editpilot')[0].characterName, 'NewName');
});

test('CharacterEditMessageHandler handles missing character in player list', () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'EdgePilot',
    sessionKey: 'session-1',
    characters: [{ id: 'character-1', characterName: 'ExistingCharacter' }]
  });
  const handler = new CharacterEditMessageHandler(context);
  const socket = createMockSocket();

  const response = handler.handle(socket, {
    playerName: 'EdgePilot',
    sessionKey: 'session-1',
    characterId: 'missing-character-id',
    characterName: 'GhostName'
  });

  assert.deepEqual(response, {
    success: false,
    message: 'Character is not in player list',
    playerName: 'EdgePilot',
    characterId: 'missing-character-id'
  });
  assert.equal(socket.events[0].eventName, CHARACTER_EDIT_RESPONSE_EVENT);
  assert.deepEqual(context.getCharacters('edgepilot'), [
    { id: 'character-1', characterName: 'ExistingCharacter' }
  ]);
});

test('CharacterEditMessageHandler rejects invalid sessions before state changes', () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'SessionPilot',
    sessionKey: 'session-1',
    characters: [{ id: 'character-1', characterName: 'OriginalName' }]
  });
  const handler = new CharacterEditMessageHandler(context);
  const socket = createMockSocket();

  const response = handler.handle(socket, {
    playerName: 'SessionPilot',
    sessionKey: 'wrong-session',
    characterId: 'character-1',
    characterName: 'UpdatedName'
  });

  assert.deepEqual(response, { message: INVALID_SESSION_MESSAGE });
  assert.equal(socket.events[0].eventName, INVALID_SESSION_EVENT);
  assert.equal(context.getCharacters('sessionpilot')[0].characterName, 'OriginalName');
});