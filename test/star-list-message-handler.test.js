'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { StarListMessageHandler } = require('../src/handlers/star-list-message-handler');
const { STAR_LIST_RESPONSE_EVENT } = require('../src/model/star-list');
const {
  createMockSocket,
  createTestContext,
  seedPlayer,
} = require('../test-support/message-handler-test-helpers');

test('StarListMessageHandler returns HYG-derived stars sorted by distance', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });

  const handler = new StarListMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
  });

  assert.equal(response.success, true);
  assert.ok(response.stars.length >= 6);
  for (let i = 1; i < response.stars.length; i += 1) {
    const prev = response.stars[i - 1].distanceParsec ?? Infinity;
    const cur = response.stars[i].distanceParsec ?? Infinity;
    assert.ok(prev <= cur, `stars not sorted by distance at index ${i}`);
  }
  assert.equal(socket.events[0].eventName, STAR_LIST_RESPONSE_EVENT);
});

test('StarListMessageHandler filters by systemId', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });

  const handler = new StarListMessageHandler(context);
  const response = await handler.handle(createMockSocket(), {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    systemId: 'alpha-centauri',
  });

  assert.equal(response.success, true);
  assert.equal(response.stars.length, 3);
  assert.ok(response.stars.every((s) => s.systemId === 'alpha-centauri'));
});

test('StarListMessageHandler filters by spectralClass and maxDistanceParsec', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });

  const handler = new StarListMessageHandler(context);
  const response = await handler.handle(createMockSocket(), {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    spectralClass: 'M',
    maxDistanceParsec: 5,
  });

  assert.equal(response.success, true);
  assert.ok(response.stars.every((s) => s.spectralClass === 'M'));
  assert.ok(response.stars.every((s) => s.distanceParsec <= 5));
});
