'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ItemListByContainerMessageHandler,
} = require('../src/handlers/item-list-by-container-message-handler');
const { ITEM_LIST_BY_CONTAINER_RESPONSE_EVENT } = require('../src/model/item-list-by-container');
const { INVALID_SESSION_EVENT, INVALID_SESSION_MESSAGE } = require('../src/model/session');
const {
  createMockSocket,
  createTestContext,
  seedItems,
  seedPlayer,
} = require('../test-support/message-handler-test-helpers');

function createItem(overrides = {}) {
  return {
    id: 'item-1',
    itemType: 'expendable-dart-drone',
    displayName: 'Expendable Dart Drone',
    state: 'contained',
    damageStatus: 'intact',
    container: { containerType: 'ship', containerId: 'ship-1' },
    spatial: null,
    owningPlayerId: 'player-1',
    owningCharacterId: 'character-1',
    destroyedAt: null,
    destroyedReason: null,
    discoveredAt: null,
    discoveredByCharacterId: null,
    createdAt: '2026-04-17T00:00:00.000Z',
    updatedAt: '2026-04-17T00:00:00.000Z',
    ...overrides,
  };
}

test('ItemListByContainerMessageHandler returns items for a ship container', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });
  seedItems(context, [
    createItem({ id: 'item-1', container: { containerType: 'ship', containerId: 'ship-1' } }),
    createItem({ id: 'item-2', container: { containerType: 'ship', containerId: 'ship-1' } }),
    createItem({ id: 'item-3', container: { containerType: 'ship', containerId: 'ship-2' } }),
  ]);

  const handler = new ItemListByContainerMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    containerType: 'ship',
    containerId: 'ship-1',
  });

  assert.equal(response.success, true);
  assert.equal(response.message, 'Items retrieved successfully');
  assert.equal(response.playerName, 'PilotOne');
  assert.equal(response.containerType, 'ship');
  assert.equal(response.containerId, 'ship-1');
  assert.equal(response.items.length, 2);
  assert.ok(response.items.every((item) => item.container.containerId === 'ship-1'));
  assert.equal(socket.events[0].eventName, ITEM_LIST_BY_CONTAINER_RESPONSE_EVENT);
});

test('ItemListByContainerMessageHandler returns empty array when no items match', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });

  const handler = new ItemListByContainerMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    containerType: 'ship',
    containerId: 'ship-99',
  });

  assert.equal(response.success, true);
  assert.deepEqual(response.items, []);
  assert.equal(socket.events[0].eventName, ITEM_LIST_BY_CONTAINER_RESPONSE_EVENT);
});

test('ItemListByContainerMessageHandler returns items for a market container', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });
  seedItems(context, [
    createItem({ id: 'item-1', container: { containerType: 'market', containerId: 'market-1' } }),
    createItem({ id: 'item-2', container: { containerType: 'market', containerId: 'market-1' } }),
  ]);

  const handler = new ItemListByContainerMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    containerType: 'market',
    containerId: 'market-1',
  });

  assert.equal(response.success, true);
  assert.equal(response.items.length, 2);
  assert.equal(socket.events[0].eventName, ITEM_LIST_BY_CONTAINER_RESPONSE_EVENT);
});

test('ItemListByContainerMessageHandler rejects invalid containerType', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });

  const handler = new ItemListByContainerMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    containerType: 'black-hole',
    containerId: 'bh-1',
  });

  assert.equal(response.success, false);
  assert.match(response.message, /containerType must be one of/);
  assert.equal(socket.events[0].eventName, ITEM_LIST_BY_CONTAINER_RESPONSE_EVENT);
});

test('ItemListByContainerMessageHandler rejects missing containerId', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });

  const handler = new ItemListByContainerMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    containerType: 'ship',
  });

  assert.equal(response.success, false);
  assert.equal(response.message, 'containerId is required');
  assert.equal(socket.events[0].eventName, ITEM_LIST_BY_CONTAINER_RESPONSE_EVENT);
});

test('ItemListByContainerMessageHandler rejects unregistered player', async () => {
  const context = createTestContext();

  const handler = new ItemListByContainerMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'Ghost',
    sessionKey: 'session-1',
    containerType: 'ship',
    containerId: 'ship-1',
  });

  assert.deepEqual(response, { message: INVALID_SESSION_MESSAGE });
  assert.equal(socket.events[0].eventName, INVALID_SESSION_EVENT);
});

test('ItemListByContainerMessageHandler emits invalid-session before query', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });

  const handler = new ItemListByContainerMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'PilotOne',
    sessionKey: 'wrong-session',
    containerType: 'ship',
    containerId: 'ship-1',
  });

  assert.deepEqual(response, { message: INVALID_SESSION_MESSAGE });
  assert.equal(socket.events[0].eventName, INVALID_SESSION_EVENT);
});

test('ItemListByContainerMessageHandler merges cache and DB matches for a ship container', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });

  const cachedItem = createItem({
    id: 'item-cache-only',
    container: { containerType: 'ship', containerId: 'ship-1' },
  });
  seedItems(context, [cachedItem]);

  context.databaseService = {
    async getItemsByContainer() {
      return [
        createItem({
          id: 'item-db-only',
          container: { containerType: 'ship', containerId: 'ship-1' },
        }),
      ];
    },
  };

  const handler = new ItemListByContainerMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    containerType: 'ship',
    containerId: 'ship-1',
  });

  assert.equal(response.success, true);
  assert.equal(response.items.length, 2);
  assert.ok(response.items.some((item) => item.id === 'item-cache-only'));
  assert.ok(response.items.some((item) => item.id === 'item-db-only'));
});

test('ItemListByContainerMessageHandler backfills cold-boot starter subsystem items for ship containers', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'ColdBootPilot',
    playerId: 'player-cold-boot',
    sessionKey: 'session-1',
    characters: [
      {
        id: 'character-1',
        characterName: 'Starter',
        ships: [
          {
            id: 'ship-1',
            shipName: 'Scavenger Pod',
            model: 'Scavenger Pod',
            tier: 1,
            createdAt: '2026-04-17T00:00:00.000Z',
            inventory: [],
            spatial: {
              solarSystemId: 'sol',
              frame: 'barycentric',
              positionKm: { x: 0, y: 0, z: 0 },
              epochMs: 0,
            },
            damageProfile: {
              overallStatus: 'damaged',
              summary: 'Starter cold boot damage profile',
              origin: 'cold-boot-scripted',
              updatedAt: '2026-04-17T00:00:00.000Z',
              systems: [],
            },
          },
        ],
      },
    ],
  });

  const handler = new ItemListByContainerMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'ColdBootPilot',
    sessionKey: 'session-1',
    containerType: 'ship',
    containerId: 'ship-1',
  });

  assert.equal(response.success, true);
  assert.equal(response.items.length, 3);

  const byType = new Map(response.items.map((item) => [item.itemType, item]));
  for (const itemType of ['propulsion-manifold', 'sensor-array', 'power-distribution-bus']) {
    assert.ok(byType.has(itemType));
    const item = byType.get(itemType);
    assert.equal(item.id, `ship-1-starter-${itemType}`);
    assert.equal(item.state, 'contained');
    assert.equal(item.damageStatus, 'damaged');
    assert.equal(item.launchable, false);
    assert.deepEqual(item.container, {
      containerType: 'ship',
      containerId: 'ship-1',
    });
    assert.equal(item.spatial, null);
    assert.equal(item.owningPlayerId, 'player-cold-boot');
    assert.equal(item.owningCharacterId, 'character-1');
  }

  assert.equal(socket.events[0].eventName, ITEM_LIST_BY_CONTAINER_RESPONSE_EVENT);
});

test('ItemListByContainerMessageHandler does not backfill subsystem items for non-cold-boot ships', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'CombatPilot',
    playerId: 'player-combat',
    sessionKey: 'session-1',
    characters: [
      {
        id: 'character-1',
        characterName: 'Veteran',
        ships: [
          {
            id: 'ship-1',
            shipName: 'Scavenger Pod',
            model: 'Scavenger Pod',
            tier: 1,
            inventory: [],
            spatial: {
              solarSystemId: 'sol',
              frame: 'barycentric',
              positionKm: { x: 0, y: 0, z: 0 },
              epochMs: 0,
            },
            damageProfile: {
              overallStatus: 'damaged',
              summary: 'Combat damage profile',
              origin: 'combat',
              updatedAt: '2026-04-17T00:00:00.000Z',
              systems: [],
            },
          },
        ],
      },
    ],
  });

  const handler = new ItemListByContainerMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'CombatPilot',
    sessionKey: 'session-1',
    containerType: 'ship',
    containerId: 'ship-1',
  });

  assert.equal(response.success, true);
  assert.deepEqual(response.items, []);
  assert.equal(socket.events[0].eventName, ITEM_LIST_BY_CONTAINER_RESPONSE_EVENT);
});

test('ItemListByContainerMessageHandler does not duplicate existing starter subsystem rows', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'ColdBootPilot',
    playerId: 'player-cold-boot',
    sessionKey: 'session-1',
    characters: [
      {
        id: 'character-1',
        characterName: 'Starter',
        ships: [
          {
            id: 'ship-1',
            shipName: 'Scavenger Pod',
            model: 'Scavenger Pod',
            tier: 1,
            createdAt: '2026-04-17T00:00:00.000Z',
            inventory: [],
            spatial: {
              solarSystemId: 'sol',
              frame: 'barycentric',
              positionKm: { x: 0, y: 0, z: 0 },
              epochMs: 0,
            },
            damageProfile: {
              overallStatus: 'damaged',
              summary: 'Starter cold boot damage profile',
              origin: 'cold-boot-scripted',
              updatedAt: '2026-04-17T00:00:00.000Z',
              systems: [],
            },
          },
        ],
      },
    ],
  });

  seedItems(context, [
    createItem({
      id: 'ship-1-starter-propulsion-manifold',
      itemType: 'propulsion-manifold',
      displayName: 'Propulsion Manifold',
      launchable: false,
      damageStatus: 'damaged',
      container: { containerType: 'ship', containerId: 'ship-1' },
      owningPlayerId: 'player-cold-boot',
      owningCharacterId: 'character-1',
      spatial: null,
    }),
  ]);

  const handler = new ItemListByContainerMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'ColdBootPilot',
    sessionKey: 'session-1',
    containerType: 'ship',
    containerId: 'ship-1',
  });

  assert.equal(response.success, true);
  const subsystemItems = response.items.filter((item) =>
    ['propulsion-manifold', 'sensor-array', 'power-distribution-bus'].includes(item.itemType)
  );
  assert.equal(subsystemItems.length, 3);

  const propulsionItems = subsystemItems.filter((item) => item.itemType === 'propulsion-manifold');
  assert.equal(propulsionItems.length, 1);
  assert.equal(propulsionItems[0].id, 'ship-1-starter-propulsion-manifold');
  assert.equal(socket.events[0].eventName, ITEM_LIST_BY_CONTAINER_RESPONSE_EVENT);
});

test('ItemListByContainerMessageHandler persists backfilled starter subsystem rows to DB when available', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'ColdBootPilot',
    playerId: 'player-cold-boot',
    sessionKey: 'session-1',
    characters: [
      {
        id: 'character-1',
        characterName: 'Starter',
        ships: [
          {
            id: 'ship-1',
            shipName: 'Scavenger Pod',
            model: 'Scavenger Pod',
            tier: 1,
            createdAt: '2026-04-17T00:00:00.000Z',
            inventory: [],
            spatial: {
              solarSystemId: 'sol',
              frame: 'barycentric',
              positionKm: { x: 0, y: 0, z: 0 },
              epochMs: 0,
            },
            damageProfile: {
              overallStatus: 'damaged',
              summary: 'Starter cold boot damage profile',
              origin: 'cold-boot-scripted',
              updatedAt: '2026-04-17T00:00:00.000Z',
              systems: [],
            },
          },
        ],
      },
    ],
  });

  let persistedItems = [];
  context.databaseService = {
    async getItemsByContainer() {
      return [];
    },
    async addItems(items) {
      persistedItems = Array.isArray(items) ? items : [];
      return persistedItems;
    },
  };

  const handler = new ItemListByContainerMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'ColdBootPilot',
    sessionKey: 'session-1',
    containerType: 'ship',
    containerId: 'ship-1',
  });

  assert.equal(response.success, true);
  assert.equal(response.items.length, 3);
  assert.equal(persistedItems.length, 3);
  const persistedTypes = persistedItems.map((item) => item.itemType).sort();
  assert.deepEqual(persistedTypes, [
    'power-distribution-bus',
    'propulsion-manifold',
    'sensor-array',
  ]);
  assert.equal(socket.events[0].eventName, ITEM_LIST_BY_CONTAINER_RESPONSE_EVENT);
});
