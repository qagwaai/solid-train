'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  SolarSystemListMessageHandler,
} = require('../src/handlers/solar-system-list-message-handler');
const { SOLAR_SYSTEM_LIST_RESPONSE_EVENT } = require('../src/model/solar-system-list');
const { INVALID_SESSION_EVENT, INVALID_SESSION_MESSAGE } = require('../src/model/session');
const {
  createMockSocket,
  createTestContext,
  seedPlayer,
} = require('../test-support/message-handler-test-helpers');

test('SolarSystemListMessageHandler returns curated and procedural systems sorted by distance', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });

  const handler = new SolarSystemListMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
  });

  assert.equal(response.success, true);
  assert.ok(response.solarSystems.length >= 2);
  assert.ok(response.solarSystems.find((s) => s.id === 'sol'));
  assert.ok(response.solarSystems.find((s) => s.id === 'alpha-centauri'));

  // Sol should sort first (distance ~0).
  assert.equal(response.solarSystems[0].id, 'sol');
  assert.equal(socket.events[0].eventName, SOLAR_SYSTEM_LIST_RESPONSE_EVENT);
});

test('SolarSystemListMessageHandler filters by source', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });

  const handler = new SolarSystemListMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    source: 'curated',
  });

  assert.equal(response.success, true);
  assert.ok(response.solarSystems.every((s) => s.source === 'curated'));
  assert.ok(response.solarSystems.find((s) => s.id === 'sol'));
  assert.ok(response.solarSystems.find((s) => s.id === 'alpha-centauri'));
});

test('SolarSystemListMessageHandler filters by search substring', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });

  const handler = new SolarSystemListMessageHandler(context);
  const response = await handler.handle(createMockSocket(), {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    search: 'Alpha',
  });

  assert.equal(response.success, true);
  assert.ok(response.solarSystems.find((s) => s.id === 'alpha-centauri'));
  assert.ok(!response.solarSystems.find((s) => s.id === 'sol'));
});

test('SolarSystemListMessageHandler rejects invalid source values', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });

  const handler = new SolarSystemListMessageHandler(context);
  const response = await handler.handle(createMockSocket(), {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    source: 'unknown',
  });

  assert.equal(response.success, false);
  assert.match(response.message, /source must be one of/);
});

test('SolarSystemListMessageHandler emits invalid session before query', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });

  const handler = new SolarSystemListMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'PilotOne',
    sessionKey: 'wrong-session',
  });

  assert.deepEqual(response, { message: INVALID_SESSION_MESSAGE });
  assert.equal(socket.events[0].eventName, INVALID_SESSION_EVENT);
});

test('SolarSystemListMessageHandler echoes requestId when supplied', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });

  const handler = new SolarSystemListMessageHandler(context);
  const response = await handler.handle(createMockSocket(), {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    requestId: 'req-42',
  });

  assert.equal(response.requestId, 'req-42');
});
