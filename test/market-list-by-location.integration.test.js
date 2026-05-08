'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { MessageHandlerContext } = require('../src/handlers/message-handler-context');
const {
  MarketListByLocationMessageHandler,
} = require('../src/handlers/market-list-by-location-message-handler');
const { createMockSocket, seedPlayer } = require('../test-support/message-handler-test-helpers');

function buildBaseRequest(overrides = {}) {
  return {
    playerName: 'IntegrationPilot',
    sessionKey: 'session-1',
    solarSystemId: 'sol',
    positionKm: { x: 173241287, y: -897243, z: 416968312 },
    distanceAu: 1000000,
    limit: 50,
    locationTypes: ['station'],
    ...overrides,
  };
}

test('Integration (Option 1): Sol station query returns only local station markets', async () => {
  const context = new MessageHandlerContext({
    createId: randomUUID,
    getCurrentTimestamp: () => '2026-05-07T00:00:00.000Z',
  });
  await context.initializeAsync({ seedDefaults: true });
  const handler = new MarketListByLocationMessageHandler(context);
  const socket = createMockSocket();

  seedPlayer(context, {
    playerName: 'IntegrationPilot',
    sessionKey: 'session-1',
  });

  const response = await handler.handle(socket, {
    ...buildBaseRequest(),
  });

  assert.equal(response.success, true);
  assert.equal(response.message, 'Local market list retrieved successfully');
  assert.equal(response.markets.length, 10);
  assert.ok(response.markets.every((market) => market.solarSystemId === 'sol'));
  assert.ok(response.markets.every((market) => market.siteType === 'station'));
  assert.ok(response.markets.every((market) => market.route?.kind === 'in-system'));
  assert.ok(response.markets.every((market) => market.marketId.startsWith('sol-')));
  const uniqueDistances = new Set(response.markets.map((market) => market.distanceAu));
  assert.ok(
    uniqueDistances.size > 1,
    'distanceAu values should not all collapse to the same rounded value'
  );
  const minDistanceAu = Math.min(...response.markets.map((market) => market.distanceAu));
  const maxDistanceAu = Math.max(...response.markets.map((market) => market.distanceAu));
  assert.ok(
    maxDistanceAu - minDistanceAu > 0.1,
    'distanceAu should span a meaningful range across planets'
  );
});

test('Integration (Option 1): Station filter excludes known non-sol station markets', async () => {
  const context = new MessageHandlerContext({
    createId: randomUUID,
    getCurrentTimestamp: () => '2026-05-07T00:00:00.000Z',
  });
  await context.initializeAsync({ seedDefaults: true });
  const handler = new MarketListByLocationMessageHandler(context);
  const socket = createMockSocket();

  seedPlayer(context, {
    playerName: 'IntegrationPilot',
    sessionKey: 'session-1',
  });

  const response = await handler.handle(socket, {
    ...buildBaseRequest(),
  });

  const returnedIds = new Set(response.markets.map((market) => market.marketId));

  assert.equal(response.success, true);
  assert.equal(returnedIds.has('ac-proxima-station'), false);
  assert.equal(returnedIds.has('bs-main-station'), false);
});

test('Integration (Option 1): Query solarSystemId is case-insensitive', async () => {
  const context = new MessageHandlerContext({
    createId: randomUUID,
    getCurrentTimestamp: () => '2026-05-07T00:00:00.000Z',
  });
  await context.initializeAsync({ seedDefaults: true });
  const handler = new MarketListByLocationMessageHandler(context);
  const socket = createMockSocket();

  seedPlayer(context, {
    playerName: 'IntegrationPilot',
    sessionKey: 'session-1',
  });

  const response = await handler.handle(socket, {
    ...buildBaseRequest({ solarSystemId: 'SoL' }),
  });

  assert.equal(response.success, true);
  assert.equal(response.markets.length, 10);
  assert.ok(response.markets.every((market) => market.solarSystemId === 'sol'));
});
