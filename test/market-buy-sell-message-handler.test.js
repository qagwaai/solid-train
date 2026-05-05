'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MarketBuyMessageHandler
} = require('../src/handlers/market-buy-message-handler');
const {
  MarketSellMessageHandler
} = require('../src/handlers/market-sell-message-handler');
const {
  MARKET_BUY_RESPONSE_EVENT,
  MARKET_BUY_FAILURE_REASONS
} = require('../src/model/market-buy');
const {
  MARKET_SELL_RESPONSE_EVENT,
  MARKET_SELL_FAILURE_REASONS
} = require('../src/model/market-sell');
const {
  createMockSocket,
  createTestContext,
  seedItems,
  seedPlayer
} = require('../test-support/message-handler-test-helpers');

function seedMarketCharacter(context, credits = 2000) {
  seedPlayer(context, {
    playerName: 'MarketPilot',
    sessionKey: 'session-1',
    playerId: 'player-1',
    characters: [
      {
        id: 'character-1',
        characterName: 'Trader',
        createdAt: '2026-05-05T00:00:00.000Z',
        ships: [{ id: 'ship-1', shipName: 'Trader Ship 1', createdAt: '2026-05-05T00:00:00.000Z' }],
        missions: [],
        creditLedger: [{ type: 'put', amount: credits, description: 'Seed', timestamp: '2026-05-05T00:00:00.000Z', referenceId: null }],
        credits
      }
    ]
  });
}

test('MarketBuyMessageHandler buys item, updates credits, stock, and character inventory', async () => {
  const context = createTestContext();
  seedMarketCharacter(context, 2000);
  const handler = new MarketBuyMessageHandler(context);
  const socket = createMockSocket();

  const beforeMarket = context.getMarket('sol-ceres-exchange', 'sol');
  const beforeStock = beforeMarket.inventory.find((entry) => entry.itemId === 'iron').stock;

  const response = await handler.handle(socket, {
    requestId: 'buy-1',
    playerName: 'MarketPilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
    marketId: 'sol-ceres-exchange',
    solarSystemId: 'sol',
    itemId: 'iron',
    quantity: 3
  });

  assert.equal(response.success, true);
  assert.equal(response.requestId, 'buy-1');
  assert.equal(response.transaction.itemId, 'iron');
  assert.equal(response.transaction.quantity, 3);

  const afterMarket = context.getMarket('sol-ceres-exchange', 'sol');
  const afterStock = afterMarket.inventory.find((entry) => entry.itemId === 'iron').stock;
  assert.equal(afterStock, beforeStock - 3);

  const boughtItems = [...context.itemsById.values()].filter((item) => item.owningCharacterId === 'character-1' && item.itemType === 'iron');
  assert.equal(boughtItems.length, 1);
  assert.equal(boughtItems[0].quantity, 3);
  assert.equal(socket.events[0].eventName, MARKET_BUY_RESPONSE_EVENT);
});

test('MarketBuyMessageHandler returns INSUFFICIENT_CREDITS when balance is too low', async () => {
  const context = createTestContext();
  seedMarketCharacter(context, 1);
  const handler = new MarketBuyMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'MarketPilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
    marketId: 'sol-ceres-exchange',
    solarSystemId: 'sol',
    itemId: 'iridium',
    quantity: 2
  });

  assert.equal(response.success, false);
  assert.equal(response.reason, MARKET_BUY_FAILURE_REASONS.INSUFFICIENT_CREDITS);
});

test('MarketSellMessageHandler sells owned quantity and credits character', async () => {
  const context = createTestContext();
  seedMarketCharacter(context, 500);
  seedItems(context, [
    {
      id: 'iron-stack-1',
      itemType: 'iron',
      displayName: 'Iron',
      state: 'contained',
      damageStatus: 'intact',
      container: { containerType: 'ship', containerId: 'ship-1' },
      owningPlayerId: 'player-1',
      owningCharacterId: 'character-1',
      kinematics: null,
      createdAt: '2026-05-05T00:00:00.000Z',
      updatedAt: '2026-05-05T00:00:00.000Z',
      destroyedAt: null,
      destroyedReason: null,
      launchable: false,
      quantity: 5
    }
  ]);

  const handler = new MarketSellMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    requestId: 'sell-1',
    playerName: 'MarketPilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
    marketId: 'sol-ceres-exchange',
    solarSystemId: 'sol',
    itemId: 'iron',
    quantity: 4
  });

  assert.equal(response.success, true);
  const remainingItems = [...context.itemsById.values()].filter((item) => item.id === 'iron-stack-1');
  assert.equal(remainingItems.length, 1);
  assert.equal(remainingItems[0].quantity, 1);
  assert.equal(socket.events[0].eventName, MARKET_SELL_RESPONSE_EVENT);
});

test('MarketSellMessageHandler returns INSUFFICIENT_ITEM_QUANTITY when inventory is low', async () => {
  const context = createTestContext();
  seedMarketCharacter(context, 500);
  const handler = new MarketSellMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'MarketPilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
    marketId: 'sol-ceres-exchange',
    solarSystemId: 'sol',
    itemId: 'iron',
    quantity: 1
  });

  assert.equal(response.success, false);
  assert.equal(response.reason, MARKET_SELL_FAILURE_REASONS.INSUFFICIENT_ITEM_QUANTITY);
});
