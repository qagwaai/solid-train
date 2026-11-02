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

test('StarListMessageHandler pages, filters by minimum distance, and sorts by name (P2)', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });
  const handler = new StarListMessageHandler(context);
  const base = { playerName: 'PilotOne', sessionKey: 'session-1' };

  const first = await handler.buildResponse(base);
  assert.equal(first.success, true);
  assert.equal(first.stars.length, 100);
  assert.equal(first.offset, 0);
  assert.equal(first.limit, 100);
  assert.ok(first.total > 100);
  assert.equal(first.hasMore, true);

  const pageA = await handler.buildResponse({ ...base, offset: 0, limit: 4 });
  const pageB = await handler.buildResponse({ ...base, offset: 4, limit: 4 });
  const wide = await handler.buildResponse({ ...base, limit: 8 });
  assert.deepEqual(
    [...pageA.stars, ...pageB.stars].map((s) => s.starId),
    wide.stars.map((s) => s.starId)
  );

  const ranged = await handler.buildResponse({
    ...base,
    minDistanceParsec: 3,
    maxDistanceParsec: 4,
    limit: 500,
  });
  assert.ok(ranged.stars.length > 0);
  for (const star of ranged.stars) {
    assert.ok(star.distanceParsec >= 3 && star.distanceParsec <= 4, star.starId);
  }

  const byName = await handler.buildResponse({ ...base, sort: 'name', limit: 500 });
  const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });
  const nameOf = (s) => s.properName || s.catalogName || s.starId;
  for (let i = 1; i < byName.stars.length; i += 1) {
    assert.ok(collator.compare(nameOf(byName.stars[i - 1]), nameOf(byName.stars[i])) <= 0);
  }

  for (const bad of [{ sort: 'mass' }, { limit: -1 }, { offset: 0.5 }]) {
    const response = await handler.buildResponse({ ...base, ...bad });
    assert.equal(response.success, false, JSON.stringify(bad));
    assert.deepEqual(response.stars, []);
    assert.equal(response.total, 0);
  }
});
