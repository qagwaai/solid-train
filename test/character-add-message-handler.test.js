'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CharacterAddMessageHandler
} = require('../src/handlers/character-add-message-handler');
const {
  CHARACTER_ADD_RESPONSE_EVENT
} = require('../src/model/character-add');
const {
  INVALID_SESSION_EVENT,
  INVALID_SESSION_MESSAGE
} = require('../src/model/session');
const {
  createMockSocket,
  createTestContext,
  seedPlayer
} = require('../test-support/message-handler-test-helpers');

test('CharacterAddMessageHandler adds a character and emits response', () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'BuilderPilot',
    sessionKey: 'session-1'
  });
  const handler = new CharacterAddMessageHandler(context);
  const socket = createMockSocket();

  const response = handler.handle(socket, {
    playerName: 'builderpilot',
    sessionKey: 'session-1',
    characterName: 'RangerOne'
  });

  assert.deepEqual(response, {
    success: true,
    message: 'Character added successfully',
    playerName: 'BuilderPilot',
    characterName: 'RangerOne',
    characterId: 'player-1'
  });
  assert.equal(socket.events[0].eventName, CHARACTER_ADD_RESPONSE_EVENT);
  assert.deepEqual(context.getCharacters('builderpilot'), [
    {
      id: 'player-1',
      characterName: 'RangerOne',
      createdAt: '2026-04-17T00:00:00.000Z'
    }
  ]);
});

test('CharacterAddMessageHandler rejects invalid sessions before mutating state', () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'BuilderPilot',
    sessionKey: 'session-1'
  });
  const handler = new CharacterAddMessageHandler(context);
  const socket = createMockSocket();

  const response = handler.handle(socket, {
    playerName: 'BuilderPilot',
    sessionKey: 'wrong-session',
    characterName: 'GhostUnit'
  });

  assert.deepEqual(response, { message: INVALID_SESSION_MESSAGE });
  assert.deepEqual(context.getCharacters('builderpilot'), []);
  assert.equal(socket.events[0].eventName, INVALID_SESSION_EVENT);
});