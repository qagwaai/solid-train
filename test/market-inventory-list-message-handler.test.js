'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MarketInventoryListMessageHandler,
} = require('../src/handlers/market-inventory-list-message-handler');
const { MARKET_INVENTORY_LIST_RESPONSE_EVENT } = require('../src/model/market-inventory-list');
const { INVALID_SESSION_EVENT, INVALID_SESSION_MESSAGE } = require('../src/model/session');
const {
  createMockSocket,
  createTestContext,
  seedPlayer,
} = require('../test-support/message-handler-test-helpers');

test('MarketInventoryListMessageHandler returns paged inventory', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'MarketPilot',
    sessionKey: 'session-1',
  });
  const handler = new MarketInventoryListMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'MarketPilot',
    sessionKey: 'session-1',
    marketId: 'sol-ceres-exchange',
    solarSystemId: 'sol',
    offset: 0,
    limit: 5,
  });

  assert.equal(response.success, true);
  assert.equal(response.marketId, 'sol-ceres-exchange');
  assert.equal(response.solarSystemId, 'sol');
  assert.equal(response.inventory.length, 5);
  assert.ok(response.total >= response.inventory.length);
  assert.equal(socket.events[0].eventName, MARKET_INVENTORY_LIST_RESPONSE_EVENT);
});

test('MarketInventoryListMessageHandler emits invalid session before list', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'MarketPilot',
    sessionKey: 'session-1',
  });
  const handler = new MarketInventoryListMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'MarketPilot',
    sessionKey: 'bad-session',
    marketId: 'sol-ceres-exchange',
    solarSystemId: 'sol',
  });

  assert.deepEqual(response, { message: INVALID_SESSION_MESSAGE });
  assert.deepEqual(socket.events, [
    {
      eventName: INVALID_SESSION_EVENT,
      payload: { message: INVALID_SESSION_MESSAGE },
    },
  ]);
});

test('MarketInventoryListMessageHandler rejects missing required fields', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'MarketPilot',
    sessionKey: 'session-1',
  });
  const handler = new MarketInventoryListMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'MarketPilot',
    sessionKey: 'session-1',
    marketId: 'sol-ceres-exchange',
  });

  assert.equal(response.success, false);
  assert.equal(response.message, 'playerName, marketId, and solarSystemId are required');
  assert.deepEqual(response.inventory, []);
  assert.equal(socket.events[0].eventName, MARKET_INVENTORY_LIST_RESPONSE_EVENT);
});

test('MarketInventoryListMessageHandler rejects unregistered player', async () => {
  const context = createTestContext();
  context.hasValidSessionAsync = async () => true;
  const handler = new MarketInventoryListMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'GhostPilot',
    sessionKey: 'session-1',
    marketId: 'sol-ceres-exchange',
    solarSystemId: 'sol',
  });

  assert.equal(response.success, false);
  assert.equal(response.message, 'Player is not registered');
  assert.deepEqual(response.inventory, []);
});

test('MarketInventoryListMessageHandler returns market-not-found reason', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'MarketPilot',
    sessionKey: 'session-1',
  });
  const handler = new MarketInventoryListMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'MarketPilot',
    sessionKey: 'session-1',
    marketId: 'unknown-market',
    solarSystemId: 'sol',
  });

  assert.equal(response.success, false);
  assert.equal(response.message, 'Market was not found');
  assert.equal(response.reason, 'MARKET_NOT_FOUND');
});
