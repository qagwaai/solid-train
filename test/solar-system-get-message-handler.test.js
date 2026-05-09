'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  SolarSystemGetMessageHandler,
} = require('../src/handlers/solar-system-get-message-handler');
const { SOLAR_SYSTEM_GET_RESPONSE_EVENT } = require('../src/model/solar-system-get');
const { INVALID_SESSION_EVENT, INVALID_SESSION_MESSAGE } = require('../src/model/session');
const {
  createMockSocket,
  createTestContext,
  seedPlayer,
} = require('../test-support/message-handler-test-helpers');

test('SolarSystemGetMessageHandler seeds Alpha Centauri and returns curated bodies', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });

  const handler = new SolarSystemGetMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    solarSystemId: 'alpha-centauri',
  });

  assert.equal(response.success, true);
  assert.equal(response.solarSystem.id, 'alpha-centauri');
  assert.equal(response.solarSystem.isMultiStar, true);
  assert.ok(response.bodies.length >= 6);
  assert.ok(response.stars.length === 3);
  assert.ok(response.stars.every((s) => s.bodyType === 'star'));
  assert.equal(socket.events[0].eventName, SOLAR_SYSTEM_GET_RESPONSE_EVENT);
});

test('SolarSystemGetMessageHandler returns failure for unknown system', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });

  const handler = new SolarSystemGetMessageHandler(context);
  const response = await handler.handle(createMockSocket(), {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    solarSystemId: 'not-a-system',
  });

  assert.equal(response.success, false);
  assert.equal(response.message, 'Unknown solar system');
});

test('SolarSystemGetMessageHandler validates required fields', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });

  const handler = new SolarSystemGetMessageHandler(context);
  const response = await handler.handle(createMockSocket(), {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
  });

  assert.equal(response.success, false);
  assert.match(response.message, /required/);
});

test('SolarSystemGetMessageHandler emits invalid session before query', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });

  const handler = new SolarSystemGetMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'PilotOne',
    sessionKey: 'wrong',
    solarSystemId: 'sol',
  });

  assert.deepEqual(response, { message: INVALID_SESSION_MESSAGE });
  assert.equal(socket.events[0].eventName, INVALID_SESSION_EVENT);
});
