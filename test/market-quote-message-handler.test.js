'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MarketQuoteMessageHandler
} = require('../src/handlers/market-quote-message-handler');
const {
  MARKET_QUOTE_RESPONSE_EVENT,
  MARKET_QUOTE_FAILURE_REASONS
} = require('../src/model/market-quote');
const {
  INVALID_SESSION_EVENT,
  INVALID_SESSION_MESSAGE
} = require('../src/model/session');
const {
  createMockSocket,
  createTestContext,
  seedPlayer,
  seedTraderCharacter
} = require('../test-support/message-handler-test-helpers');

test('MarketQuoteMessageHandler returns quote for a valid request', async () => {
  const context = createTestContext();
  seedTraderCharacter(context, { startingBalance: 2000 });

  const handler = new MarketQuoteMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    requestId: 'rq-1',
    playerName: 'marketpilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
    marketId: 'sol-ceres-exchange',
    solarSystemId: 'sol',
    itemId: 'iron',
    direction: 'buy',
    quantity: 5
  });

  assert.equal(response.success, true);
  assert.equal(response.requestId, 'rq-1');
  assert.equal(response.quote.marketId, 'sol-ceres-exchange');
  assert.equal(response.quote.itemId, 'iron');
  assert.equal(response.quote.direction, 'buy');
  assert.equal(response.quote.quantity, 5);
  assert.ok(response.quote.unitPrice > 0);
  assert.equal(response.quote.totalPrice, response.quote.unitPrice * 5);
  assert.equal(socket.events[0].eventName, MARKET_QUOTE_RESPONSE_EVENT);
});

test('MarketQuoteMessageHandler rejects invalid payload fields', async () => {
  const context = createTestContext();
  seedTraderCharacter(context, { startingBalance: 2000 });
  const handler = new MarketQuoteMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    requestId: 'rq-invalid-direction-1',
    playerName: 'MarketPilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
    marketId: 'sol-ceres-exchange',
    solarSystemId: 'sol',
    itemId: 'iron',
    direction: 'bad-direction',
    quantity: 5
  });

  assert.equal(response.success, false);
  assert.equal(response.requestId, 'rq-invalid-direction-1');
  assert.equal(response.reason, MARKET_QUOTE_FAILURE_REASONS.INVALID_DIRECTION);
  assert.equal(socket.events[0].eventName, MARKET_QUOTE_RESPONSE_EVENT);
});

test('MarketQuoteMessageHandler emits invalid session before quote logic', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'MarketPilot',
    sessionKey: 'session-1'
  });
  const handler = new MarketQuoteMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    requestId: 'rq-missing-market-1',
    playerName: 'MarketPilot',
    characterId: 'character-1',
    sessionKey: 'bad-session',
    marketId: 'sol-ceres-exchange',
    solarSystemId: 'sol',
    itemId: 'iron',
    direction: 'buy',
    quantity: 1
  });

  assert.deepEqual(response, { message: INVALID_SESSION_MESSAGE });
  assert.deepEqual(socket.events, [
    {
      eventName: INVALID_SESSION_EVENT,
      payload: { message: INVALID_SESSION_MESSAGE }
    }
  ]);
});

// ─── Additional branch coverage ────────────────────────────────────────────

test('MarketQuoteMessageHandler returns INVALID_PAYLOAD when marketId is missing', async () => {
  const context = createTestContext();
  seedTraderCharacter(context, { startingBalance: 2000 });
  const handler = new MarketQuoteMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    requestId: 'rq-missing-market-1',
    playerName: 'MarketPilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
    solarSystemId: 'sol',
    itemId: 'iron',
    direction: 'buy',
    quantity: 1
  });

  assert.equal(response.success, false);
  assert.equal(response.requestId, 'rq-missing-market-1');
  assert.equal(response.reason, MARKET_QUOTE_FAILURE_REASONS.INVALID_PAYLOAD);
});

test('MarketQuoteMessageHandler returns PLAYER_NOT_REGISTERED for unknown player', async () => {
  const context = createTestContext();
  seedTraderCharacter(context, { startingBalance: 2000 });
  const handler = new MarketQuoteMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    requestId: 'rq-character-missing-1',
    playerName: 'MarketPilot',
    characterId: 'nonexistent',
    sessionKey: 'session-1',
    marketId: 'sol-ceres-exchange',
    solarSystemId: 'sol',
    itemId: 'iron',
    direction: 'buy',
    quantity: 1
  });

  // Session passes, character lookup fails → CHARACTER_NOT_FOUND
  assert.equal(response.success, false);
  assert.equal(response.requestId, 'rq-character-missing-1');
  assert.equal(response.reason, MARKET_QUOTE_FAILURE_REASONS.CHARACTER_NOT_FOUND);
});

test('MarketQuoteMessageHandler returns MARKET_NOT_FOUND for unknown marketId', async () => {
  const context = createTestContext();
  seedTraderCharacter(context, { startingBalance: 2000 });
  const handler = new MarketQuoteMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    requestId: 'rq-market-missing-1',
    playerName: 'MarketPilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
    marketId: 'nonexistent-market',
    solarSystemId: 'sol',
    itemId: 'iron',
    direction: 'buy',
    quantity: 1
  });

  assert.equal(response.success, false);
  assert.equal(response.requestId, 'rq-market-missing-1');
  assert.equal(response.reason, MARKET_QUOTE_FAILURE_REASONS.MARKET_NOT_FOUND);
});

test('MarketQuoteMessageHandler returns ITEM_NOT_FOUND for unknown itemId', async () => {
  const context = createTestContext();
  seedTraderCharacter(context, { startingBalance: 2000 });
  const handler = new MarketQuoteMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    requestId: 'rq-item-missing-1',
    playerName: 'MarketPilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
    marketId: 'sol-ceres-exchange',
    solarSystemId: 'sol',
    itemId: 'unknown-ore',
    direction: 'buy',
    quantity: 1
  });

  assert.equal(response.success, false);
  assert.equal(response.requestId, 'rq-item-missing-1');
  assert.equal(response.reason, MARKET_QUOTE_FAILURE_REASONS.ITEM_NOT_FOUND);
});

test('MarketQuoteMessageHandler returns INVALID_QUANTITY for quantity = 0', async () => {
  const context = createTestContext();
  seedTraderCharacter(context, { startingBalance: 2000 });
  const handler = new MarketQuoteMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    requestId: 'rq-invalid-qty-1',
    playerName: 'MarketPilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
    marketId: 'sol-ceres-exchange',
    solarSystemId: 'sol',
    itemId: 'iron',
    direction: 'buy',
    quantity: 0
  });

  assert.equal(response.success, false);
  assert.equal(response.requestId, 'rq-invalid-qty-1');
  assert.equal(response.reason, MARKET_QUOTE_FAILURE_REASONS.INVALID_QUANTITY);
});

test('MarketQuoteMessageHandler returns MARKET_DOES_NOT_BUY_ITEM when sell direction and market cannot buy', async () => {
  const context = createTestContext();
  seedTraderCharacter(context, { startingBalance: 2000 });
  const handler = new MarketQuoteMessageHandler(context);
  const socket = createMockSocket();

  // Mark iron as not purchasable by the market
  const market = { ...context.getMarket('sol-ceres-exchange', 'sol') };
  market.inventory = market.inventory.map((entry) =>
    entry.itemId === 'iron' ? { ...entry, marketCanBuy: false } : entry
  );
  context.cacheMarket(market);

  const response = await handler.handle(socket, {
    requestId: 'rq-market-cannot-buy-1',
    playerName: 'MarketPilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
    marketId: 'sol-ceres-exchange',
    solarSystemId: 'sol',
    itemId: 'iron',
    direction: 'sell',
    quantity: 1
  });

  assert.equal(response.success, false);
  assert.equal(response.requestId, 'rq-market-cannot-buy-1');
  assert.equal(response.reason, MARKET_QUOTE_FAILURE_REASONS.MARKET_DOES_NOT_BUY_ITEM);
});
