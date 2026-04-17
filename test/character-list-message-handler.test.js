'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CharacterListMessageHandler
} = require('../src/handlers/character-list-message-handler');
const {
  CHARACTER_LIST_RESPONSE_EVENT
} = require('../src/model/character-list');
const {
  INVALID_SESSION_EVENT,
  INVALID_SESSION_MESSAGE
} = require('../src/model/session');
const {
  createMockSocket,
  createTestContext,
  seedPlayer
} = require('../test-support/message-handler-test-helpers');
const {
  MessageHandlerContext
} = require('../src/handlers/message-handler-context');

test('CharacterListMessageHandler emits invalid session when session is missing', () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'CharacterPilot' });
  const handler = new CharacterListMessageHandler(context);
  const socket = createMockSocket();

  const response = handler.handle(socket, {
    playerName: 'CharacterPilot',
    sessionKey: 'wrong-session'
  });

  assert.deepEqual(response, { message: INVALID_SESSION_MESSAGE });
  assert.deepEqual(socket.events, [
    {
      eventName: INVALID_SESSION_EVENT,
      payload: { message: INVALID_SESSION_MESSAGE }
    }
  ]);
});

test('CharacterListMessageHandler returns a defensive copy of characters', () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'CharacterPilot',
    sessionKey: 'session-1',
    characters: [{ id: 'character-1', characterName: 'RangerOne' }]
  });
  const handler = new CharacterListMessageHandler(context);
  const socket = createMockSocket();

  const response = handler.handle(socket, {
    playerName: 'characterpilot',
    sessionKey: 'session-1'
  });

  assert.equal(response.success, true);
  assert.equal(response.playerName, 'CharacterPilot');
  assert.deepEqual(response.characters, [
    { id: 'character-1', characterName: 'RangerOne' }
  ]);

  response.characters[0].characterName = 'Mutated';
  assert.equal(
    context.getCharacters('characterpilot')[0].characterName,
    'RangerOne'
  );
  assert.equal(socket.events[0].eventName, CHARACTER_LIST_RESPONSE_EVENT);
});

test('CharacterListMessageHandler updates last message timestamp for joined character', () => {
  const timestamps = [
    '2026-04-17T00:00:00.000Z',
    '2026-04-17T00:10:00.000Z',
    '2026-04-17T00:15:00.000Z'
  ];
  const context = new MessageHandlerContext({
    createId: () => 'generated-id',
    getCurrentTimestamp: () => timestamps.shift() || '2026-04-17T00:15:00.000Z'
  });
  seedPlayer(context, {
    playerName: 'ActivityPilot',
    sessionKey: 'session-1',
    characters: [{ id: 'character-1', characterName: 'RangerOne' }]
  });

  const character = context.getCharacters('activitypilot')[0];
  context.joinCharacterToGame('ActivityPilot', character);

  const handler = new CharacterListMessageHandler(context);
  const socket = createMockSocket();
  handler.handle(socket, {
    playerName: 'ActivityPilot',
    sessionKey: 'session-1'
  });

  const updatedCharacter = context.getCharacters('activitypilot')[0];
  assert.equal(updatedCharacter.gameJoinedAt, '2026-04-17T00:00:00.000Z');
  assert.equal(
    updatedCharacter.gameLastMessageReceivedAt,
    '2026-04-17T00:15:00.000Z'
  );
});