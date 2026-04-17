'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  RegisterMessageHandler
} = require('../src/handlers/register-message-handler');
const {
  REGISTER_RESPONSE_EVENT
} = require('../src/model/register');
const {
  createMockSocket,
  createTestContext,
  seedPlayer
} = require('../test-support/message-handler-test-helpers');

test('RegisterMessageHandler registers a unique player and emits response', () => {
  const context = createTestContext();
  const handler = new RegisterMessageHandler(context);
  const socket = createMockSocket('socket-register');

  const response = handler.handle(socket, {
    playerName: 'CaptainPixel',
    email: 'captain@example.com',
    password: 'super-secret'
  });

  assert.deepEqual(response, {
    success: true,
    message: 'Registration successful',
    playerId: 'player-1'
  });
  assert.deepEqual(socket.events, [
    {
      eventName: REGISTER_RESPONSE_EVENT,
      payload: response
    }
  ]);

  const player = context.getPlayer('CaptainPixel');
  assert.ok(player);
  assert.equal(player.socketId, 'socket-register');
  assert.deepEqual(context.getCharacters('captainpixel'), []);
});

test('RegisterMessageHandler rejects duplicate player names', () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'CaptainPixel' });
  const handler = new RegisterMessageHandler(context);
  const socket = createMockSocket();

  const response = handler.handle(socket, {
    playerName: ' captainpixel ',
    email: 'other@example.com',
    password: 'another-secret'
  });

  assert.deepEqual(response, {
    success: false,
    message: 'playerName already exists'
  });
  assert.equal(socket.events[0].eventName, REGISTER_RESPONSE_EVENT);
});