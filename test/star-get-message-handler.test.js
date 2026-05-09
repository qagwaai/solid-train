'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { StarGetMessageHandler } = require('../src/handlers/star-get-message-handler');
const { STAR_GET_RESPONSE_EVENT } = require('../src/model/star-get');
const {
  createMockSocket,
  createTestContext,
  seedPlayer,
} = require('../test-support/message-handler-test-helpers');

test('StarGetMessageHandler returns a star by hygId', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });

  const handler = new StarGetMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    hygId: '70890',
  });

  assert.equal(response.success, true);
  assert.equal(response.star.hygId, '70890');
  assert.equal(response.star.properName, 'Proxima Centauri');
  assert.equal(socket.events[0].eventName, STAR_GET_RESPONSE_EVENT);
});

test('StarGetMessageHandler reports star not found', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });

  const handler = new StarGetMessageHandler(context);
  const response = await handler.handle(createMockSocket(), {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    hygId: 'no-such-id',
  });

  assert.equal(response.success, false);
  assert.equal(response.message, 'Star not found');
});

test('StarGetMessageHandler validates required fields', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });

  const handler = new StarGetMessageHandler(context);
  const response = await handler.handle(createMockSocket(), {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
  });

  assert.equal(response.success, false);
  assert.match(response.message, /required/);
});
