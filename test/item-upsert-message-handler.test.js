'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { ItemUpsertMessageHandler } = require('../src/handlers/item-upsert-message-handler');
const { ITEM_UPSERT_RESPONSE_EVENT } = require('../src/model/item-upsert');
const {
  createMockSocket,
  createTestContext,
  seedItems,
  seedPlayer,
} = require('../test-support/message-handler-test-helpers');

function createItemPayload(overrides = {}) {
  return {
    id: 'item-1',
    itemType: 'expendable-dart-drone',
    displayName: 'Expendable Dart Drone',
    state: 'contained',
    damageStatus: 'intact',
    container: { containerType: 'ship', containerId: 'ship-1' },
    owningPlayerId: 'player-1',
    owningCharacterId: 'character-1',
    ...overrides,
  };
}

function createExistingItem(overrides = {}) {
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

function createRequestIdentity(overrides = {}) {
  return {
    operation: 'item-upsert',
    entityType: 'expendable-dart-drone',
    containerId: 'ship-1',
    ...overrides,
  };
}

test('ItemUpsertMessageHandler echoes correlationId and requestIdentity on success and validation error', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });
  seedItems(context, [createExistingItem()]);

  const handler = new ItemUpsertMessageHandler(context);

  const successSocket = createMockSocket();
  const successRequest = {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    correlationId: '7b1c4066-78bd-4611-8d88-3610b054f4ce',
    requestIdentity: createRequestIdentity(),
    item: createItemPayload({ id: 'item-1', state: 'deployed' }),
  };

  const successResponse = await handler.handle(successSocket, successRequest);
  assert.equal(successResponse.success, true);
  assert.equal(successResponse.correlationId, successRequest.correlationId);
  assert.deepEqual(successResponse.requestIdentity, successRequest.requestIdentity);

  const errorSocket = createMockSocket();
  const errorRequest = {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    correlationId: '251eccf4-7f07-4331-a214-7d6ef5c57b87',
    requestIdentity: createRequestIdentity({ entityType: 'sensor-array', containerId: 'ship-9' }),
    item: { id: 'item-1', state: 'exploded' },
  };

  const errorResponse = await handler.handle(errorSocket, errorRequest);
  assert.equal(errorResponse.success, false);
  assert.equal(errorResponse.correlationId, errorRequest.correlationId);
  assert.deepEqual(errorResponse.requestIdentity, errorRequest.requestIdentity);
});

test('ItemUpsertMessageHandler creates a new item when id not in cache', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });

  const handler = new ItemUpsertMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    item: createItemPayload({ id: '' }),
  });

  assert.equal(response.success, true);
  assert.equal(response.message, 'Item created successfully');
  assert.equal(response.playerName, 'PilotOne');
  assert.ok(response.item.id, 'item should have an id');
  assert.equal(response.item.itemType, 'expendable-dart-drone');
  assert.equal(response.item.tier, 1);
  assert.equal(response.item.displayName, 'Expendable Dart Drone');
  assert.equal(response.item.state, 'contained');
  assert.equal(response.item.damageStatus, 'intact');
  assert.deepEqual(response.item.container, { containerType: 'ship', containerId: 'ship-1' });
  assert.equal(socket.events[0].eventName, ITEM_UPSERT_RESPONSE_EVENT);
  assert.ok(context.getItem(response.item.id), 'item should be cached');
});

test('ItemUpsertMessageHandler creates a new item with explicit tier', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });

  const handler = new ItemUpsertMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    item: createItemPayload({ id: '', tier: 10 }),
  });

  assert.equal(response.success, true);
  assert.equal(response.item.tier, 10);
  assert.equal(context.getItem(response.item.id).tier, 10);
});

test('ItemUpsertMessageHandler updates an existing item', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });
  seedItems(context, [createExistingItem()]);

  const handler = new ItemUpsertMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    item: createItemPayload({ state: 'deployed', damageStatus: 'damaged' }),
  });

  assert.equal(response.success, true);
  assert.equal(response.message, 'Item updated successfully');
  assert.equal(response.item.id, 'item-1');
  assert.equal(response.item.tier, 1);
  assert.equal(response.item.state, 'deployed');
  assert.equal(response.item.damageStatus, 'damaged');
  assert.equal(socket.events[0].eventName, ITEM_UPSERT_RESPONSE_EVENT);
  assert.equal(context.getItem('item-1').state, 'deployed');
});

test('ItemUpsertMessageHandler updates an existing item tier when provided', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });
  seedItems(context, [createExistingItem({ tier: 4 })]);

  const handler = new ItemUpsertMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    item: createItemPayload({ id: 'item-1', tier: 10 }),
  });

  assert.equal(response.success, true);
  assert.equal(response.item.tier, 10);
  assert.equal(context.getItem('item-1').tier, 10);
});

test('ItemUpsertMessageHandler preserves existing tier when update omits tier', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });
  seedItems(context, [createExistingItem({ tier: 8 })]);

  const handler = new ItemUpsertMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    item: {
      id: 'item-1',
      state: 'deployed',
    },
  });

  assert.equal(response.success, true);
  assert.equal(response.item.tier, 8);
  assert.equal(context.getItem('item-1').tier, 8);
});

test('ItemUpsertMessageHandler deploys an item (clears container, sets kinematics)', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });
  seedItems(context, [createExistingItem()]);

  const handler = new ItemUpsertMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    item: {
      id: 'item-1',
      state: 'deployed',
      container: null,
      spatial: {
        solarSystemId: 'sol',
        frame: 'barycentric',
        positionKm: { x: 100, y: 200, z: 300 },
        epochMs: 1000000,
      },
      motion: {
        velocityKmPerSec: { x: 1, y: 2, z: 3 },
      },
    },
  });

  assert.equal(response.success, true);
  assert.equal(response.item.state, 'deployed');
  assert.equal(response.item.tier, 1);
  assert.equal(response.item.container, null);
  assert.ok(response.item.spatial, 'spatial should be set');
  assert.equal(response.item.spatial.solarSystemId, 'sol');
  assert.deepEqual(response.item.motion.velocityKmPerSec, { x: 1, y: 2, z: 3 });
  assert.equal(socket.events[0].eventName, ITEM_UPSERT_RESPONSE_EVENT);
});

test('ItemUpsertMessageHandler destroys an item and auto-populates destroyedAt', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });
  seedItems(context, [createExistingItem()]);

  const handler = new ItemUpsertMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    item: {
      id: 'item-1',
      state: 'destroyed',
      destroyedReason: 'hit by asteroid',
    },
  });

  assert.equal(response.success, true);
  assert.equal(response.item.state, 'destroyed');
  assert.equal(response.item.tier, 1);
  assert.equal(response.item.destroyedAt, '2026-04-17T00:00:00.000Z');
  assert.equal(response.item.destroyedReason, 'hit by asteroid');
  assert.equal(socket.events[0].eventName, ITEM_UPSERT_RESPONSE_EVENT);
});

test('ItemUpsertMessageHandler rejects create without itemType and displayName', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });

  const handler = new ItemUpsertMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    item: { id: '' },
  });

  assert.equal(response.success, false);
  assert.equal(
    response.message,
    'item.itemType and item.displayName are required to create an item'
  );
  assert.equal(socket.events[0].eventName, ITEM_UPSERT_RESPONSE_EVENT);
});

test('ItemUpsertMessageHandler rejects invalid state', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });
  seedItems(context, [createExistingItem()]);

  const handler = new ItemUpsertMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    item: { id: 'item-1', state: 'exploded' },
  });

  assert.equal(response.success, false);
  assert.match(response.message, /item\.state must be one of/);
  assert.equal(socket.events[0].eventName, ITEM_UPSERT_RESPONSE_EVENT);
});

test('ItemUpsertMessageHandler rejects invalid damageStatus', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });
  seedItems(context, [createExistingItem()]);

  const handler = new ItemUpsertMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    item: { id: 'item-1', damageStatus: 'fine' },
  });

  assert.equal(response.success, false);
  assert.match(response.message, /item\.damageStatus must be one of/);
  assert.equal(socket.events[0].eventName, ITEM_UPSERT_RESPONSE_EVENT);
});

test('ItemUpsertMessageHandler rejects invalid tier', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });
  seedItems(context, [createExistingItem()]);

  const handler = new ItemUpsertMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    item: { id: 'item-1', tier: 0 },
  });

  assert.equal(response.success, false);
  assert.equal(response.message, 'item.tier must be an integer between 1 and 20');
  assert.equal(socket.events[0].eventName, ITEM_UPSERT_RESPONSE_EVENT);
});

test('ItemUpsertMessageHandler rejects invalid kinematics', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });
  seedItems(context, [createExistingItem()]);

  const handler = new ItemUpsertMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    item: {
      id: 'item-1',
      kinematics: { position: { x: 1, y: 2, z: 3 } },
    },
  });

  assert.equal(response.success, false);
  assert.equal(
    response.message,
    'item.kinematics is no longer accepted; use canonical item.spatial (and optional item.motion) instead'
  );
  assert.equal(socket.events[0].eventName, ITEM_UPSERT_RESPONSE_EVENT);
});

test('ItemUpsertMessageHandler rejects invalid container', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });
  seedItems(context, [createExistingItem()]);

  const handler = new ItemUpsertMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    item: { id: 'item-1', container: { containerType: 'black-hole', containerId: 'x' } },
  });

  assert.equal(response.success, false);
  assert.match(response.message, /item\.container must include/);
  assert.equal(socket.events[0].eventName, ITEM_UPSERT_RESPONSE_EVENT);
});

test('ItemUpsertMessageHandler adds created ship-contained items to ship inventory references', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    characters: [
      {
        id: 'character-1',
        characterName: 'RangerOne',
        ships: [
          {
            id: 'ship-1',
            shipName: 'Scout Ship',
            inventory: [],
            createdAt: '2026-04-17T00:00:00.000Z',
          },
        ],
      },
    ],
  });

  const handler = new ItemUpsertMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    item: createItemPayload({ id: '' }),
  });

  assert.equal(response.success, true);

  const character = context.findCharacter('PilotOne', 'character-1');
  assert.equal(character.ships[0].inventory.length, 1);
  assert.equal(character.ships[0].inventory[0].itemId, response.item.id);
  assert.equal(character.ships[0].inventory[0].itemType, response.item.itemType);
  assert.equal(response.item.tier, 1);
});

test('ItemUpsertMessageHandler emits only item-upsert-response', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });

  const handler = new ItemUpsertMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    item: createItemPayload({ id: '' }),
  });

  assert.equal(response.success, true);
  assert.equal(socket.events.length, 1);
  assert.equal(socket.events[0].eventName, ITEM_UPSERT_RESPONSE_EVENT);
  assert.notEqual(socket.events[0].eventName, 'upsert-item-response');
});

test('ItemUpsertMessageHandler keeps success when inventory reference sync hits DB version conflict', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    characters: [
      {
        id: 'character-1',
        characterName: 'RangerOne',
        ships: [
          {
            id: 'ship-1',
            shipName: 'Scout Ship',
            inventory: [
              {
                itemId: 'item-1',
                itemType: 'hull-patch-kit',
              },
            ],
            createdAt: '2026-04-17T00:00:00.000Z',
            spatial: {
              solarSystemId: 'sol',
              frame: 'barycentric',
              positionKm: { x: 0, y: 0, z: 0 },
              epochMs: 0,
            },
          },
        ],
      },
    ],
  });
  seedItems(context, [
    createExistingItem({
      itemType: 'hull-patch-kit',
      displayName: 'Hull Patch Kit',
      launchable: false,
      owningPlayerId: 'player-1',
      owningCharacterId: 'character-1',
      container: { containerType: 'ship', containerId: 'ship-1' },
    }),
  ]);

  context.databaseService = {
    async updateCharacter() {
      throw new Error(
        'No matching document found for id "player-doc" version 6 modifiedPaths "characters"'
      );
    },
    async updateItemById() {
      return null;
    },
  };

  const handler = new ItemUpsertMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    item: {
      id: 'item-1',
      state: 'destroyed',
      damageStatus: 'destroyed',
      container: null,
      destroyedReason: 'consumed-by:repair',
    },
  });

  assert.equal(response.success, true);
  assert.equal(response.item.id, 'item-1');
  assert.equal(response.item.state, 'destroyed');
  assert.equal(response.item.damageStatus, 'destroyed');
  assert.equal(response.item.container, null);
  assert.equal(socket.events.length, 1);
  assert.equal(socket.events[0].eventName, ITEM_UPSERT_RESPONSE_EVENT);
  assert.notEqual(socket.events[0].eventName, 'upsert-item-response');
});

test('ItemUpsertMessageHandler retries inventory reference sync once after DB version conflict', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    characters: [
      {
        id: 'character-1',
        characterName: 'RangerOne',
        ships: [
          {
            id: 'ship-1',
            shipName: 'Scout Ship',
            inventory: [
              {
                itemId: 'item-1',
                itemType: 'hull-patch-kit',
              },
            ],
            createdAt: '2026-04-17T00:00:00.000Z',
          },
        ],
      },
    ],
  });
  seedItems(context, [
    createExistingItem({
      itemType: 'hull-patch-kit',
      displayName: 'Hull Patch Kit',
      launchable: false,
      owningPlayerId: 'player-1',
      owningCharacterId: 'character-1',
      container: { containerType: 'ship', containerId: 'ship-1' },
    }),
  ]);

  let getCharactersCallCount = 0;
  let updateCharacterCallCount = 0;
  context.databaseService = {
    async getCharacters() {
      getCharactersCallCount += 1;
      return [
        {
          id: 'character-1',
          characterName: 'RangerOne',
          ships: [
            {
              id: 'ship-1',
              shipName: 'Scout Ship',
              inventory: [
                {
                  itemId: 'item-1',
                  itemType: 'hull-patch-kit',
                },
              ],
              createdAt: '2026-04-17T00:00:00.000Z',
              spatial: {
                solarSystemId: 'sol',
                frame: 'barycentric',
                positionKm: { x: 0, y: 0, z: 0 },
                epochMs: 0,
              },
            },
          ],
        },
      ];
    },
    async updateCharacter() {
      updateCharacterCallCount += 1;
      if (updateCharacterCallCount === 1) {
        throw new Error(
          'No matching document found for id "player-doc" version 6 modifiedPaths "characters"'
        );
      }
      return null;
    },
    async updateItemById() {
      return null;
    },
  };

  const handler = new ItemUpsertMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    item: {
      id: 'item-1',
      state: 'destroyed',
      damageStatus: 'destroyed',
      container: null,
      destroyedReason: 'consumed-by:repair',
    },
  });

  assert.equal(response.success, true);
  assert.equal(updateCharacterCallCount, 2);
  assert.equal(getCharactersCallCount, 1);
  assert.equal(socket.events.length, 1);
  assert.equal(socket.events[0].eventName, ITEM_UPSERT_RESPONSE_EVENT);
  assert.notEqual(socket.events[0].eventName, 'upsert-item-response');
});
