'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MarketListMessageHandler
} = require('../src/handlers/market-list-message-handler');
const {
  MARKET_LIST_RESPONSE_EVENT
} = require('../src/model/market-list');
const {
  INVALID_SESSION_EVENT,
  INVALID_SESSION_MESSAGE
} = require('../src/model/session');
const {
  createMockSocket,
  createTestContext,
  seedPlayer
} = require('../test-support/message-handler-test-helpers');

test('MarketListMessageHandler returns markets for a solar system', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'MarketPilot',
    sessionKey: 'session-1'
  });
  const handler = new MarketListMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'marketpilot',
    sessionKey: 'session-1',
    solarSystemId: 'sol'
  });

  assert.equal(response.success, true);
  assert.equal(response.playerName, 'MarketPilot');
  assert.equal(response.solarSystemId, 'sol');
  assert.ok(Array.isArray(response.markets));
  assert.ok(response.markets.length >= 14);
    assert.ok(response.markets.every((market) => market.spatial?.solarSystemId === 'sol'));
    assert.ok(response.markets.every((market) => market.trajectory?.orbit));
  assert.ok(response.markets.some((market) => market.isStarterMarket));
  assert.ok(response.markets.every((market) => typeof market.distanceAu === 'number'));
  assert.equal(socket.events[0].eventName, MARKET_LIST_RESPONSE_EVENT);
});

test('MarketListMessageHandler emits invalid session before responding', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'MarketPilot',
    sessionKey: 'session-1'
  });
  const handler = new MarketListMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'MarketPilot',
    sessionKey: 'bad-session',
    solarSystemId: 'sol'
  });

  assert.deepEqual(response, { message: INVALID_SESSION_MESSAGE });
  assert.deepEqual(socket.events, [
    {
      eventName: INVALID_SESSION_EVENT,
      payload: { message: INVALID_SESSION_MESSAGE }
    }
  ]);
});

test('MarketListMessageHandler fails when market spatial is not canonical', async () => {
  const context = createTestContext();
  context.marketsByKey.clear();
  // Inject directly to bypass normalizeMarket's spatial synthesis
  context.marketsByKey.set('sol:broken-market', {
    marketId: 'broken-market',
    solarSystemId: 'sol',
    marketName: 'Broken Market',
    siteType: 'station',
    siteName: 'Broken Site',
    isStarterMarket: false,
    inventory: [],
    ledger: [],
    spatial: null
  });
  seedPlayer(context, {
    playerName: 'MarketPilot',
    sessionKey: 'session-1'
  });

  const handler = new MarketListMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'marketpilot',
    sessionKey: 'session-1',
    solarSystemId: 'sol'
  });

  assert.equal(response.success, false);
  assert.ok(response.message.includes('invalid canonical spatial/trajectory fields'));
  assert.deepEqual(response.markets, []);
  assert.equal(socket.events[0].eventName, MARKET_LIST_RESPONSE_EVENT);
});
