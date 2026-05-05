'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MarketLedgerListMessageHandler
} = require('../src/handlers/market-ledger-list-message-handler');
const {
  MARKET_LEDGER_LIST_RESPONSE_EVENT
} = require('../src/model/market-ledger-list');
const {
  createMockSocket,
  createTestContext,
  seedPlayer
} = require('../test-support/message-handler-test-helpers');

test('MarketLedgerListMessageHandler returns filtered entries', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'MarketPilot',
    sessionKey: 'session-1',
    characters: [
      {
        id: 'character-1',
        characterName: 'Trader',
        createdAt: '2026-05-05T00:00:00.000Z',
        ships: [{ id: 'ship-1', shipName: 'Trader Ship 1', createdAt: '2026-05-05T00:00:00.000Z' }],
        missions: [],
        creditLedger: [{ type: 'put', amount: 2000, description: 'Seed', timestamp: '2026-05-05T00:00:00.000Z', referenceId: null }],
        credits: 2000
      }
    ]
  });

  await context.executeMarketTransactionAsync({
    playerName: 'MarketPilot',
    characterId: 'character-1',
    marketId: 'sol-ceres-exchange',
    solarSystemId: 'sol',
    itemId: 'iron',
    direction: 'buy',
    quantity: 2,
    requestId: 'rq-ledger-1'
  });

  const handler = new MarketLedgerListMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'MarketPilot',
    sessionKey: 'session-1',
    marketId: 'sol-ceres-exchange',
    solarSystemId: 'sol',
    characterId: 'character-1',
    direction: 'buy'
  });

  assert.equal(response.success, true);
  assert.ok(response.entries.length >= 1);
  assert.ok(response.entries.every((entry) => entry.direction === 'buy'));
  assert.ok(response.entries.every((entry) => entry.characterId === 'character-1'));
  assert.equal(socket.events[0].eventName, MARKET_LEDGER_LIST_RESPONSE_EVENT);
});
