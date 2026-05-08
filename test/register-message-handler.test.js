'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { RegisterMessageHandler } = require('../src/handlers/register-message-handler');
const { REGISTER_RESPONSE_EVENT } = require('../src/model/register');
const {
  createMockSocket,
  createTestContext,
  seedPlayer,
} = require('../test-support/message-handler-test-helpers');

test('RegisterMessageHandler registers a unique player and emits response', async () => {
  const context = createTestContext();
  const handler = new RegisterMessageHandler(context);
  const socket = createMockSocket('socket-register');

  const response = await handler.handle(socket, {
    playerName: 'CaptainPixel',
    email: 'captain@example.com',
    password: 'super-secret',
  });

  assert.deepEqual(response, {
    success: true,
    message: 'Registration successful',
    playerId: 'player-1',
  });
  assert.deepEqual(socket.events, [
    {
      eventName: REGISTER_RESPONSE_EVENT,
      payload: response,
    },
  ]);

  const player = context.getPlayer('CaptainPixel');
  assert.ok(player);
  assert.equal(player.socketId, 'socket-register');
  assert.equal(player.preferredLocale, 'en');
  assert.deepEqual(context.getCharacters('captainpixel'), []);
});

test('RegisterMessageHandler rejects duplicate player names', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'CaptainPixel' });
  const handler = new RegisterMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: ' captainpixel ',
    email: 'other@example.com',
    password: 'another-secret',
  });

  assert.deepEqual(response, {
    success: false,
    message: 'playerName already exists',
  });
  assert.equal(socket.events[0].eventName, REGISTER_RESPONSE_EVENT);
});

test('RegisterMessageHandler persists locale from request', async () => {
  const context = createTestContext();
  const handler = new RegisterMessageHandler(context);
  const socket = createMockSocket('socket-register-locale');

  const response = await handler.handle(socket, {
    playerName: 'LocalePilot',
    email: 'locale@example.com',
    password: 'super-secret',
    locale: 'it-IT',
  });

  assert.equal(response.success, true);
  assert.equal(socket.events[0].eventName, REGISTER_RESPONSE_EVENT);
  const player = context.getPlayer('LocalePilot');
  assert.ok(player);
  assert.equal(player.preferredLocale, 'it');
});

test('RegisterMessageHandler falls back unknown locale to en', async () => {
  const context = createTestContext();
  const handler = new RegisterMessageHandler(context);

  await handler.handle(createMockSocket('socket-register-unknown-locale'), {
    playerName: 'UnknownLocalePilot',
    email: 'unknown-locale@example.com',
    password: 'super-secret',
    locale: 'fr-CA',
  });

  const player = context.getPlayer('UnknownLocalePilot');
  assert.ok(player);
  assert.equal(player.preferredLocale, 'en');
});
