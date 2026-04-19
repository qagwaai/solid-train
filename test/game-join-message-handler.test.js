'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  GameJoinMessageHandler
} = require('../src/handlers/game-join-message-handler');
const {
  GAME_JOIN_RESPONSE_EVENT
} = require('../src/model/game-join');
const {
  INVALID_SESSION_EVENT,
  INVALID_SESSION_MESSAGE
} = require('../src/model/session');
const {
  createMockSocket,
  createTestContext,
  seedPlayer
} = require('../test-support/message-handler-test-helpers');

test('GameJoinMessageHandler joins character to game and updates character state', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'JoinPilot',
    sessionKey: 'session-1',
    characters: [{ id: 'character-1', characterName: 'RangerOne' }]
  });
  const handler = new GameJoinMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'joinpilot',
    sessionKey: 'session-1',
    characterId: 'character-1'
  });

  assert.deepEqual(response, {
    success: true,
    message: 'Character joined game successfully',
    playerName: 'JoinPilot',
    characterId: 'character-1'
  });
  assert.equal(socket.events[0].eventName, GAME_JOIN_RESPONSE_EVENT);

  const character = context.getCharacters('joinpilot')[0];
  assert.equal(character.inGame, true);
  assert.equal(character.gameJoinedAt, '2026-04-17T00:00:00.000Z');
  assert.equal(character.gameLastMessageReceivedAt, '2026-04-17T00:00:00.000Z');
});

test('GameJoinMessageHandler handles character missing from player list', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'EdgePilot',
    sessionKey: 'session-1',
    characters: [{ id: 'character-1', characterName: 'ExistingCharacter' }]
  });
  const handler = new GameJoinMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
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
  assert.equal(socket.events[0].eventName, GAME_JOIN_RESPONSE_EVENT);
  assert.equal(context.getCharacters('edgepilot')[0].inGame, undefined);
});

test('GameJoinMessageHandler emits invalid session when session is not valid', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'SessionPilot',
    sessionKey: 'session-1',
    characters: [{ id: 'character-1', characterName: 'RangerOne' }]
  });
  const handler = new GameJoinMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'SessionPilot',
    sessionKey: 'wrong-session',
    characterId: 'character-1'
  });

  assert.deepEqual(response, { message: INVALID_SESSION_MESSAGE });
  assert.equal(socket.events[0].eventName, INVALID_SESSION_EVENT);
});