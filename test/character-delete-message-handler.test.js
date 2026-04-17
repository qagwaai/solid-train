'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CharacterDeleteMessageHandler
} = require('../src/handlers/character-delete-message-handler');
const {
  CHARACTER_DELETE_RESPONSE_EVENT
} = require('../src/model/character-delete');
const {
  createMockSocket,
  createTestContext,
  seedPlayer
} = require('../test-support/message-handler-test-helpers');

test('CharacterDeleteMessageHandler removes an existing character', () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'DeletePilot',
    sessionKey: 'session-1',
    characters: [{ id: 'character-1', characterName: 'TempCharacter' }]
  });
  const handler = new CharacterDeleteMessageHandler(context);
  const socket = createMockSocket();

  const response = handler.handle(socket, {
    playerName: 'deletepilot',
    sessionKey: 'session-1',
    characterId: 'character-1'
  });

  assert.deepEqual(response, {
    success: true,
    message: 'Character deleted successfully',
    playerName: 'DeletePilot',
    characterId: 'character-1'
  });
  assert.equal(socket.events[0].eventName, CHARACTER_DELETE_RESPONSE_EVENT);
  assert.deepEqual(context.getCharacters('deletepilot'), []);
});

test('CharacterDeleteMessageHandler preserves state when character is missing', () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'EdgePilot',
    sessionKey: 'session-1',
    characters: [{ id: 'character-1', characterName: 'ExistingCharacter' }]
  });
  const handler = new CharacterDeleteMessageHandler(context);
  const socket = createMockSocket();

  const response = handler.handle(socket, {
    playerName: 'EdgePilot',
    sessionKey: 'session-1',
    characterId: 'missing-character-id'
  });

  assert.deepEqual(response, {
    success: false,
    message: 'Character is not in player list',
    playerName: 'EdgePilot',
    characterId: 'missing-character-id'
  });
  assert.equal(socket.events[0].eventName, CHARACTER_DELETE_RESPONSE_EVENT);
  assert.deepEqual(context.getCharacters('edgepilot'), [
    { id: 'character-1', characterName: 'ExistingCharacter' }
  ]);
});

test('CharacterDeleteMessageHandler detaches deleted character from game', () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'DeletePilot',
    sessionKey: 'session-1',
    characters: [{ id: 'character-1', characterName: 'TempCharacter' }]
  });

  const joinedCharacter = context.getCharacters('deletepilot')[0];
  context.joinCharacterToGame('DeletePilot', joinedCharacter);

  const handler = new CharacterDeleteMessageHandler(context);
  const socket = createMockSocket();
  const response = handler.handle(socket, {
    playerName: 'DeletePilot',
    sessionKey: 'session-1',
    characterId: 'character-1'
  });

  assert.equal(response.success, true);
  const participant = context.game.getParticipant({
    normalizedPlayerName: 'deletepilot',
    characterId: 'character-1'
  });
  assert.equal(participant, null);
});