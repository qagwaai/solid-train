'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  LoginMessageHandler
} = require('../src/handlers/login-message-handler');
const {
  LOGIN_RESPONSE_EVENT,
  LOGIN_FAILURE_REASONS
} = require('../src/model/login');
const {
  createMockSocket,
  createTestContext,
  seedPlayer
} = require('../test-support/message-handler-test-helpers');

test('LoginMessageHandler authenticates and rotates session key', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerId: 'player-1',
    playerName: 'OrbitFox',
    password: 'safe-pass'
  });
  const handler = new LoginMessageHandler(context);
  const socket = createMockSocket('socket-login');

  const response = await handler.handle(socket, {
    playerName: 'orbitfox',
    password: 'safe-pass'
  });

  assert.deepEqual(response, {
    success: true,
    message: 'Login successful',
    playerId: 'player-1',
    sessionKey: 'player-1'
  });
  assert.equal(socket.events[0].eventName, LOGIN_RESPONSE_EVENT);
  assert.equal(context.getPlayer('OrbitFox').sessionKey, 'player-1');
  assert.equal(context.getPlayer('OrbitFox').socketId, 'socket-login');
});

test('LoginMessageHandler rejects password mismatches', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'NovaWing',
    password: 'correct-password'
  });
  const handler = new LoginMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'novawing',
    password: 'wrong-password'
  });

  assert.deepEqual(response, {
    success: false,
    message: 'Password does not match',
    reason: LOGIN_FAILURE_REASONS.PASSWORD_MISMATCH
  });
  assert.equal(socket.events[0].eventName, LOGIN_RESPONSE_EVENT);
});