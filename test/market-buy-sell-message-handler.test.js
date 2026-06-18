'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { MarketBuyMessageHandler } = require('../src/handlers/market-buy-message-handler');
const { MarketSellMessageHandler } = require('../src/handlers/market-sell-message-handler');
const {
  MARKET_BUY_RESPONSE_EVENT,
  MARKET_BUY_FAILURE_REASONS,
} = require('../src/model/market-buy');
const {
  MARKET_SELL_RESPONSE_EVENT,
  MARKET_SELL_FAILURE_REASONS,
} = require('../src/model/market-sell');
const { INVALID_SESSION_EVENT, INVALID_SESSION_MESSAGE } = require('../src/model/session');
const {
  createMockSocket,
  createTestContext,
  seedItems,
  seedPlayer,
  seedTraderCharacter,
} = require('../test-support/message-handler-test-helpers');

test('MarketBuyMessageHandler buys item and returns transaction metadata', async () => {
  const context = createTestContext();
  seedTraderCharacter(context, { startingBalance: 2000 });
  const handler = new MarketBuyMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    requestId: 'buy-1',
    playerName: 'MarketPilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
    marketId: 'sol-ceres-exchange',
    solarSystemId: 'sol',
    itemId: 'iron',
    quantity: 3,
  });

  assert.equal(response.success, true);
  assert.equal(response.requestId, 'buy-1');
  assert.equal(response.transaction.itemId, 'iron');
  assert.equal(response.transaction.quantity, 3);
  assert.equal(socket.events[0].eventName, MARKET_BUY_RESPONSE_EVENT);
});

test('MarketBuyMessageHandler decrements market stock after successful buy', async () => {
  const context = createTestContext();
  seedTraderCharacter(context, { startingBalance: 2000 });
  const handler = new MarketBuyMessageHandler(context);
  const socket = createMockSocket();

  const beforeMarket = context.getMarket('sol-ceres-exchange', 'sol');
  const beforeStock = beforeMarket.inventory.find((entry) => entry.itemId === 'iron').stock;

  const response = await handler.handle(socket, {
    requestId: 'buy-stock-1',
    playerName: 'MarketPilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
    marketId: 'sol-ceres-exchange',
    solarSystemId: 'sol',
    itemId: 'iron',
    quantity: 3,
  });

  assert.equal(response.success, true);
  assert.equal(response.requestId, 'buy-stock-1');

  const afterMarket = context.getMarket('sol-ceres-exchange', 'sol');
  const afterStock = afterMarket.inventory.find((entry) => entry.itemId === 'iron').stock;
  assert.equal(afterStock, beforeStock - 3);
});

test('MarketBuyMessageHandler creates bought inventory item for the character', async () => {
  const context = createTestContext();
  seedTraderCharacter(context, { startingBalance: 2000 });
  const handler = new MarketBuyMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    requestId: 'buy-items-1',
    playerName: 'MarketPilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
    marketId: 'sol-ceres-exchange',
    solarSystemId: 'sol',
    itemId: 'iron',
    quantity: 3,
  });

  assert.equal(response.success, true);
  assert.equal(response.requestId, 'buy-items-1');

  const boughtItems = [...context.itemsById.values()].filter(
    (item) => item.owningCharacterId === 'character-1' && item.itemType === 'iron'
  );
  assert.equal(boughtItems.length, 1);
  assert.equal(boughtItems[0].quantity, 3);
});

test('MarketBuyMessageHandler returns INSUFFICIENT_CREDITS when balance is too low', async () => {
  const context = createTestContext();
  seedTraderCharacter(context, { startingBalance: 1 });
  const handler = new MarketBuyMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    requestId: 'buy-low-credits-1',
    playerName: 'MarketPilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
    marketId: 'sol-ceres-exchange',
    solarSystemId: 'sol',
    itemId: 'iridium',
    quantity: 2,
  });

  assert.equal(response.success, false);
  assert.equal(response.reason, MARKET_BUY_FAILURE_REASONS.INSUFFICIENT_CREDITS);
  assert.equal(response.requestId, 'buy-low-credits-1');
});

test('MarketSellMessageHandler sells owned quantity and returns success', async () => {
  const context = createTestContext();
  seedTraderCharacter(context, { startingBalance: 500 });
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
      spatial: null,
      createdAt: '2026-05-05T00:00:00.000Z',
      updatedAt: '2026-05-05T00:00:00.000Z',
      destroyedAt: null,
      destroyedReason: null,
      launchable: false,
      quantity: 5,
    },
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
    quantity: 4,
  });

  assert.equal(response.success, true);
  assert.equal(response.requestId, 'sell-1');
  assert.equal(socket.events[0].eventName, MARKET_SELL_RESPONSE_EVENT);
});

test('MarketSellMessageHandler decrements sold item quantity in inventory', async () => {
  const context = createTestContext();
  seedTraderCharacter(context, { startingBalance: 500 });
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
      spatial: null,
      createdAt: '2026-05-05T00:00:00.000Z',
      updatedAt: '2026-05-05T00:00:00.000Z',
      destroyedAt: null,
      destroyedReason: null,
      launchable: false,
      quantity: 5,
    },
  ]);

  const handler = new MarketSellMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    requestId: 'sell-stock-1',
    playerName: 'MarketPilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
    marketId: 'sol-ceres-exchange',
    solarSystemId: 'sol',
    itemId: 'iron',
    quantity: 4,
  });

  assert.equal(response.success, true);
  assert.equal(response.requestId, 'sell-stock-1');
  const remainingItems = [...context.itemsById.values()].filter(
    (item) => item.id === 'iron-stack-1'
  );
  assert.equal(remainingItems.length, 1);
  assert.equal(remainingItems[0].quantity, 1);
});

test('MarketSellMessageHandler returns INSUFFICIENT_ITEM_QUANTITY when inventory is low', async () => {
  const context = createTestContext();
  seedTraderCharacter(context, { startingBalance: 500 });
  const handler = new MarketSellMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    requestId: 'sell-low-qty-1',
    playerName: 'MarketPilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
    marketId: 'sol-ceres-exchange',
    solarSystemId: 'sol',
    itemId: 'iron',
    quantity: 1,
  });

  assert.equal(response.success, false);
  assert.equal(response.reason, MARKET_SELL_FAILURE_REASONS.INSUFFICIENT_ITEM_QUANTITY);
  assert.equal(response.requestId, 'sell-low-qty-1');
});

// ─── Buy: additional branch coverage ───────────────────────────────────────

test('MarketBuyMessageHandler emits invalid-session for bad session', async () => {
  const context = createTestContext();
  seedTraderCharacter(context, { startingBalance: 2000 });
  const handler = new MarketBuyMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    requestId: 'buy-invalid-qty-1',
    playerName: 'MarketPilot',
    characterId: 'character-1',
    sessionKey: 'wrong-key',
    marketId: 'sol-ceres-exchange',
    solarSystemId: 'sol',
    itemId: 'iron',
    quantity: 1,
  });

  assert.deepEqual(response, { message: INVALID_SESSION_MESSAGE });
  assert.equal(socket.events[0].eventName, INVALID_SESSION_EVENT);
});

test('MarketBuyMessageHandler returns INVALID_PAYLOAD and echoes requestId when marketId is missing', async () => {
  const context = createTestContext();
  seedTraderCharacter(context, { startingBalance: 2000 });
  const handler = new MarketBuyMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    requestId: 'req-echo',
    playerName: 'MarketPilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
    solarSystemId: 'sol',
    itemId: 'iron',
    quantity: 1,
  });

  assert.equal(response.success, false);
  assert.equal(response.reason, MARKET_BUY_FAILURE_REASONS.INVALID_PAYLOAD);
  assert.equal(response.requestId, 'req-echo');
});

test('MarketBuyMessageHandler returns INVALID_PAYLOAD for quantity = 0', async () => {
  const context = createTestContext();
  seedTraderCharacter(context, { startingBalance: 2000 });
  const handler = new MarketBuyMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    requestId: 'buy-invalid-qty-1',
    playerName: 'MarketPilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
    marketId: 'sol-ceres-exchange',
    solarSystemId: 'sol',
    itemId: 'iron',
    quantity: 0,
  });

  assert.equal(response.success, false);
  assert.equal(response.reason, MARKET_BUY_FAILURE_REASONS.INVALID_PAYLOAD);
  assert.equal(response.requestId, 'buy-invalid-qty-1');
});

test('MarketBuyMessageHandler returns MARKET_NOT_FOUND for unknown marketId', async () => {
  const context = createTestContext();
  seedTraderCharacter(context, { startingBalance: 2000 });
  const handler = new MarketBuyMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    requestId: 'buy-market-missing-1',
    playerName: 'MarketPilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
    marketId: 'nonexistent-market',
    solarSystemId: 'sol',
    itemId: 'iron',
    quantity: 1,
  });

  assert.equal(response.success, false);
  assert.equal(response.reason, MARKET_BUY_FAILURE_REASONS.MARKET_NOT_FOUND);
  assert.equal(response.requestId, 'buy-market-missing-1');
});

test('MarketBuyMessageHandler returns ITEM_NOT_FOUND for unknown itemId', async () => {
  const context = createTestContext();
  seedTraderCharacter(context, { startingBalance: 2000 });
  const handler = new MarketBuyMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    requestId: 'buy-item-missing-1',
    playerName: 'MarketPilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
    marketId: 'sol-ceres-exchange',
    solarSystemId: 'sol',
    itemId: 'unknown-ore',
    quantity: 1,
  });

  assert.equal(response.success, false);
  assert.equal(response.reason, MARKET_BUY_FAILURE_REASONS.ITEM_NOT_FOUND);
  assert.equal(response.requestId, 'buy-item-missing-1');
});

test('MarketBuyMessageHandler returns INSUFFICIENT_MARKET_STOCK when stock is too low', async () => {
  const context = createTestContext();
  seedTraderCharacter(context, { startingBalance: 200000 });
  const handler = new MarketBuyMessageHandler(context);
  const socket = createMockSocket();

  // Zero out iron stock
  const market = { ...context.getMarket('sol-ceres-exchange', 'sol') };
  market.inventory = market.inventory.map((entry) =>
    entry.itemId === 'iron' ? { ...entry, stock: 2 } : entry
  );
  context.cacheMarket(market);

  const response = await handler.handle(socket, {
    requestId: 'buy-stock-low-1',
    playerName: 'MarketPilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
    marketId: 'sol-ceres-exchange',
    solarSystemId: 'sol',
    itemId: 'iron',
    quantity: 100,
  });

  assert.equal(response.success, false);
  assert.equal(response.reason, MARKET_BUY_FAILURE_REASONS.INSUFFICIENT_MARKET_STOCK);
  assert.equal(response.requestId, 'buy-stock-low-1');
});

test('MarketBuyMessageHandler returns NO_SHIP_AVAILABLE when character has no ship', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'MarketPilot',
    sessionKey: 'session-1',
    characters: [
      {
        id: 'character-1',
        characterName: 'Trader',
        createdAt: '2026-05-05T00:00:00.000Z',
        ships: [],
        missions: [],
        creditLedger: [
          {
            type: 'put',
            amount: 5000,
            description: 'Seed',
            timestamp: '2026-05-05T00:00:00.000Z',
            referenceId: null,
          },
        ],
      },
    ],
  });
  const handler = new MarketBuyMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    requestId: 'buy-no-ship-1',
    playerName: 'MarketPilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
    marketId: 'sol-ceres-exchange',
    solarSystemId: 'sol',
    itemId: 'iron',
    quantity: 1,
  });

  assert.equal(response.success, false);
  assert.equal(response.reason, MARKET_BUY_FAILURE_REASONS.NO_SHIP_AVAILABLE);
  assert.equal(response.requestId, 'buy-no-ship-1');
});

test('MarketBuyMessageHandler buys seeded Scavenger Pod and includes starter inventory', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'MarketPilot',
    playerId: 'player-1',
    sessionKey: 'session-1',
    characters: [
      {
        id: 'character-1',
        characterName: 'Trader',
        createdAt: '2026-05-05T00:00:00.000Z',
        ships: [],
        missions: [],
        creditLedger: [
          {
            type: 'put',
            amount: 5000,
            description: 'Seed',
            timestamp: '2026-05-05T00:00:00.000Z',
            referenceId: null,
          },
        ],
      },
    ],
  });

  const handler = new MarketBuyMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    requestId: 'buy-ship-1',
    playerName: 'MarketPilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
    marketId: 'sol-ceres-exchange',
    solarSystemId: 'sol',
    itemId: 'scavenger-pod',
    quantity: 1,
  });

  assert.equal(response.success, true);
  assert.equal(response.requestId, 'buy-ship-1');
  assert.equal(response.transaction.itemId, 'scavenger-pod');
  assert.ok(response.transaction.purchasedShip);
  assert.equal(response.transaction.purchasedShip.model, 'Scavenger Pod');
  assert.equal(response.transaction.purchasedShip.inventory.length, 5);

  const character = context.findCharacter('MarketPilot', 'character-1');
  assert.equal(character.ships.length, 1);
  assert.equal(character.ships[0].model, 'Scavenger Pod');

  const shipInventoryItemIds = new Set(character.ships[0].inventory.map((entry) => entry.itemId));
  const starterItems = [...context.itemsById.values()].filter(
    (item) =>
      item.owningCharacterId === 'character-1' &&
      shipInventoryItemIds.has(item.id) &&
      item.state === 'contained'
  );
  assert.equal(starterItems.length, 5);

  const drones = starterItems.find((item) => item.itemType === 'expendable-dart-drone');
  assert.ok(drones);
  assert.equal(drones.quantity, 2);
  assert.equal(drones.tier, 1);

  const market = context.getMarket('sol-ceres-exchange', 'sol');
  const shipListing = market.shipListings.find((entry) => entry.itemId === 'scavenger-pod');
  assert.ok(shipListing);
  assert.equal(shipListing.quantityAvailable, 0);
  assert.equal(shipListing.status, 'sold');
});

test('MarketBuyMessageHandler returns INVALID_QUANTITY when seeded ship purchase quantity is not 1', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'MarketPilot',
    playerId: 'player-1',
    sessionKey: 'session-1',
    characters: [
      {
        id: 'character-1',
        characterName: 'Trader',
        createdAt: '2026-05-05T00:00:00.000Z',
        ships: [],
        missions: [],
        creditLedger: [
          {
            type: 'put',
            amount: 5000,
            description: 'Seed',
            timestamp: '2026-05-05T00:00:00.000Z',
            referenceId: null,
          },
        ],
      },
    ],
  });

  const handler = new MarketBuyMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    requestId: 'buy-ship-invalid-qty-1',
    playerName: 'MarketPilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
    marketId: 'sol-ceres-exchange',
    solarSystemId: 'sol',
    itemId: 'scavenger-pod',
    quantity: 2,
  });

  assert.equal(response.success, false);
  assert.equal(response.reason, MARKET_BUY_FAILURE_REASONS.INVALID_QUANTITY);
  assert.equal(response.requestId, 'buy-ship-invalid-qty-1');
});

test('MarketBuyMessageHandler appends type:take creditLedger entry after successful buy', async () => {
  const context = createTestContext();
  seedTraderCharacter(context, { startingBalance: 2000 });
  const handler = new MarketBuyMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    requestId: 'buy-ledger',
    playerName: 'MarketPilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
    marketId: 'sol-ceres-exchange',
    solarSystemId: 'sol',
    itemId: 'iron',
    quantity: 2,
  });

  assert.equal(response.success, true);
  assert.equal(response.requestId, 'buy-ledger');

  const character = context.findCharacter('MarketPilot', 'character-1');
  const lastEntry = character.creditLedger[character.creditLedger.length - 1];
  assert.equal(lastEntry.type, 'take');
  assert.equal(lastEntry.amount, response.transaction.totalPrice);
  assert.ok(lastEntry.description.toLowerCase().includes('iron'));
  assert.equal(lastEntry.referenceId, response.transaction.transactionId);
});

test('MarketBuyMessageHandler buys successfully after restock interval elapses', async () => {
  const context = createTestContext();
  seedTraderCharacter(context, { startingBalance: 2000 });
  const handler = new MarketBuyMessageHandler(context);
  const socket = createMockSocket();

  // Zero out iron stock and back-date lastRestockAt by 2 hours so restock fires
  const market = { ...context.getMarket('sol-ceres-exchange', 'sol') };
  market.lastRestockAt = '2026-04-16T22:00:00.000Z'; // 2 h before getCurrentTimestamp
  market.inventory = market.inventory.map((entry) =>
    entry.itemId === 'iron' ? { ...entry, stock: 0 } : entry
  );
  context.cacheMarket(market);

  const response = await handler.handle(socket, {
    requestId: 'buy-restock-1',
    playerName: 'MarketPilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
    marketId: 'sol-ceres-exchange',
    solarSystemId: 'sol',
    itemId: 'iron',
    quantity: 1,
  });

  assert.equal(response.success, true);
  assert.equal(response.requestId, 'buy-restock-1');
  assert.equal(response.transaction.itemId, 'iron');
});

// ─── Sell: additional branch coverage ──────────────────────────────────────

test('MarketSellMessageHandler emits invalid-session for bad session', async () => {
  const context = createTestContext();
  seedTraderCharacter(context, { startingBalance: 500 });
  const handler = new MarketSellMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    requestId: 'sell-invalid-qty-1',
    playerName: 'MarketPilot',
    characterId: 'character-1',
    sessionKey: 'wrong-key',
    marketId: 'sol-ceres-exchange',
    solarSystemId: 'sol',
    itemId: 'iron',
    quantity: 1,
  });

  assert.deepEqual(response, { message: INVALID_SESSION_MESSAGE });
  assert.equal(socket.events[0].eventName, INVALID_SESSION_EVENT);
});

test('MarketSellMessageHandler returns INVALID_PAYLOAD and echoes requestId when itemId is missing', async () => {
  const context = createTestContext();
  seedTraderCharacter(context, { startingBalance: 500 });
  const handler = new MarketSellMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    requestId: 'sell-echo',
    playerName: 'MarketPilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
    marketId: 'sol-ceres-exchange',
    solarSystemId: 'sol',
    quantity: 1,
  });

  assert.equal(response.success, false);
  assert.equal(response.reason, MARKET_SELL_FAILURE_REASONS.INVALID_PAYLOAD);
  assert.equal(response.requestId, 'sell-echo');
});

test('MarketSellMessageHandler returns INVALID_PAYLOAD for non-integer quantity', async () => {
  const context = createTestContext();
  seedTraderCharacter(context, { startingBalance: 500 });
  const handler = new MarketSellMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    requestId: 'sell-invalid-qty-1',
    playerName: 'MarketPilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
    marketId: 'sol-ceres-exchange',
    solarSystemId: 'sol',
    itemId: 'iron',
    quantity: 'lots',
  });

  assert.equal(response.success, false);
  assert.equal(response.reason, MARKET_SELL_FAILURE_REASONS.INVALID_PAYLOAD);
  assert.equal(response.requestId, 'sell-invalid-qty-1');
});

test('MarketSellMessageHandler returns MARKET_NOT_FOUND for wrong solarSystemId', async () => {
  const context = createTestContext();
  seedTraderCharacter(context, { startingBalance: 500 });
  const handler = new MarketSellMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    requestId: 'sell-market-missing-1',
    playerName: 'MarketPilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
    marketId: 'sol-ceres-exchange',
    solarSystemId: 'andromeda',
    itemId: 'iron',
    quantity: 1,
  });

  assert.equal(response.success, false);
  assert.equal(response.reason, MARKET_SELL_FAILURE_REASONS.MARKET_NOT_FOUND);
  assert.equal(response.requestId, 'sell-market-missing-1');
});

test('MarketSellMessageHandler returns ITEM_NOT_FOUND for unknown itemId', async () => {
  const context = createTestContext();
  seedTraderCharacter(context, { startingBalance: 500 });
  const handler = new MarketSellMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    requestId: 'sell-item-missing-1',
    playerName: 'MarketPilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
    marketId: 'sol-ceres-exchange',
    solarSystemId: 'sol',
    itemId: 'unknown-ore',
    quantity: 1,
  });

  assert.equal(response.success, false);
  assert.equal(response.reason, MARKET_SELL_FAILURE_REASONS.ITEM_NOT_FOUND);
  assert.equal(response.requestId, 'sell-item-missing-1');
});

test('MarketSellMessageHandler returns MARKET_DOES_NOT_BUY_ITEM when market cannot buy', async () => {
  const context = createTestContext();
  seedTraderCharacter(context, { startingBalance: 500 });
  seedItems(context, [
    {
      id: 'iron-stack-2',
      itemType: 'iron',
      displayName: 'Iron',
      state: 'contained',
      damageStatus: 'intact',
      container: { containerType: 'ship', containerId: 'ship-1' },
      owningPlayerId: 'player-1',
      owningCharacterId: 'character-1',
      spatial: null,
      createdAt: '2026-05-05T00:00:00.000Z',
      updatedAt: '2026-05-05T00:00:00.000Z',
      destroyedAt: null,
      destroyedReason: null,
      launchable: false,
      quantity: 5,
    },
  ]);
  const handler = new MarketSellMessageHandler(context);
  const socket = createMockSocket();

  // Mark iron as not purchasable by the market
  const market = { ...context.getMarket('sol-ceres-exchange', 'sol') };
  market.inventory = market.inventory.map((entry) =>
    entry.itemId === 'iron' ? { ...entry, marketCanBuy: false } : entry
  );
  context.cacheMarket(market);

  const response = await handler.handle(socket, {
    requestId: 'sell-market-cannot-buy-1',
    playerName: 'MarketPilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
    marketId: 'sol-ceres-exchange',
    solarSystemId: 'sol',
    itemId: 'iron',
    quantity: 1,
  });

  assert.equal(response.success, false);
  assert.equal(response.reason, MARKET_SELL_FAILURE_REASONS.MARKET_DOES_NOT_BUY_ITEM);
  assert.equal(response.requestId, 'sell-market-cannot-buy-1');
});

test('MarketSellMessageHandler appends type:put creditLedger entry after successful sell', async () => {
  const context = createTestContext();
  seedTraderCharacter(context, { startingBalance: 500 });
  seedItems(context, [
    {
      id: 'iron-stack-3',
      itemType: 'iron',
      displayName: 'Iron',
      state: 'contained',
      damageStatus: 'intact',
      container: { containerType: 'ship', containerId: 'ship-1' },
      owningPlayerId: 'player-1',
      owningCharacterId: 'character-1',
      spatial: null,
      createdAt: '2026-05-05T00:00:00.000Z',
      updatedAt: '2026-05-05T00:00:00.000Z',
      destroyedAt: null,
      destroyedReason: null,
      launchable: false,
      quantity: 3,
    },
  ]);
  const handler = new MarketSellMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    requestId: 'sell-ledger',
    playerName: 'MarketPilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
    marketId: 'sol-ceres-exchange',
    solarSystemId: 'sol',
    itemId: 'iron',
    quantity: 2,
  });

  assert.equal(response.success, true);
  assert.equal(response.requestId, 'sell-ledger');

  const character = context.findCharacter('MarketPilot', 'character-1');
  const lastEntry = character.creditLedger[character.creditLedger.length - 1];
  assert.equal(lastEntry.type, 'put');
  assert.equal(lastEntry.amount, response.transaction.totalPrice);
  assert.ok(lastEntry.description.toLowerCase().includes('iron'));
  assert.equal(lastEntry.referenceId, response.transaction.transactionId);
});
