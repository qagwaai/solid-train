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
  seedPlayer
} = require('../test-support/message-handler-test-helpers');

test('MarketQuoteMessageHandler returns quote for a valid request', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'MarketPilot',
    sessionKey: 'session-1',
    characters: [
      {
        id: 'character-1',
        characterName: 'Trader One',
        createdAt: '2026-05-05T00:00:00.000Z',
        ships: [],
        missions: [],
        creditLedger: []
      }
    ]
  });

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
  seedPlayer(context, {
    playerName: 'MarketPilot',
    sessionKey: 'session-1',
    characters: [
      {
        id: 'character-1',
        characterName: 'Trader One',
        createdAt: '2026-05-05T00:00:00.000Z',
        ships: [],
        missions: [],
        creditLedger: []
      }
    ]
  });
  const handler = new MarketQuoteMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
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
