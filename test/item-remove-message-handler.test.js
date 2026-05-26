'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { ItemRemoveMessageHandler } = require('../src/handlers/item-remove-message-handler');
const { ITEM_REMOVE_RESPONSE_EVENT } = require('../src/model/item-remove');
const { INVALID_SESSION_EVENT, INVALID_SESSION_MESSAGE } = require('../src/model/session');
const {
  createMockSocket,
  createTestContext,
  seedItems,
  seedPlayer,
} = require('../test-support/message-handler-test-helpers');

function seedRemovalScenario(context) {
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
                itemType: 'expendable-dart-drone',
              },
            ],
            createdAt: '2026-04-17T00:00:00.000Z',
          },
        ],
      },
    ],
  });

  seedItems(context, [
    {
      id: 'item-1',
      itemType: 'expendable-dart-drone',
      displayName: 'Expendable Dart Drone',
      tier: 1,
      state: 'contained',
      damageStatus: 'intact',
      container: { containerType: 'ship', containerId: 'ship-1' },
      owningPlayerId: 'player-seeded',
      owningCharacterId: 'character-1',
      spatial: null,
      createdAt: '2026-04-17T00:00:00.000Z',
      updatedAt: '2026-04-17T00:00:00.000Z',
      destroyedAt: null,
      destroyedReason: null,
      launchable: true,
    },
  ]);
}

function createRemovePayload(overrides = {}) {
  return {
    playerName: 'PilotOne',
    characterId: 'character-1',
    shipId: 'ship-1',
    sessionKey: 'session-1',
    correlationId: '9d4af767-fec8-4fd4-90e7-1776f1f2f7f4',
    requestIdentity: {
      operation: 'item-remove',
      entityType: 'expendable-dart-drone',
      containerId: 'ship-1',
    },
    itemId: 'item-1',
    itemType: 'expendable-dart-drone',
    reason: 'consumed-by:salvage',
    ...overrides,
  };
}

test('ItemRemoveMessageHandler echoes correlationId and requestIdentity on success and validation error', async () => {
  const context = createTestContext();
  seedRemovalScenario(context);
  const handler = new ItemRemoveMessageHandler(context);

  const successSocket = createMockSocket();
  const successRequest = createRemovePayload();
  const successResponse = await handler.handle(successSocket, successRequest);

  assert.equal(successResponse.success, true);
  assert.equal(successResponse.correlationId, successRequest.correlationId);
  assert.deepEqual(successResponse.requestIdentity, successRequest.requestIdentity);

  const errorSocket = createMockSocket();
  const errorRequest = createRemovePayload({
    correlationId: '251eccf4-7f07-4331-a214-7d6ef5c57b87',
    requestIdentity: {
      operation: 'item-remove',
      entityType: 'sensor-array',
      containerId: 'ship-9',
    },
    itemId: 'missing-item',
  });
  const errorResponse = await handler.handle(errorSocket, errorRequest);

  assert.equal(errorResponse.success, false);
  assert.equal(errorResponse.correlationId, errorRequest.correlationId);
  assert.deepEqual(errorResponse.requestIdentity, errorRequest.requestIdentity);
});

test('ItemRemoveMessageHandler removes inventory reference and marks item destroyed', async () => {
  const context = createTestContext();
  seedRemovalScenario(context);
  const handler = new ItemRemoveMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, createRemovePayload());

  assert.equal(response.success, true);
  assert.equal(response.message, 'Item removed successfully');
  assert.equal(response.item.state, 'destroyed');
  assert.equal(response.item.container, null);
  assert.equal(response.item.launchable, true);
  assert.equal(response.item.destroyedReason, 'consumed-by:salvage');
  assert.equal(socket.events[0].eventName, ITEM_REMOVE_RESPONSE_EVENT);

  const [updatedItem] = await context.getItemsByIdsAsync(['item-1']);
  assert.equal(updatedItem.state, 'destroyed');
  assert.equal(updatedItem.container, null);

  const character = context.findCharacter('PilotOne', 'character-1');
  assert.equal(character.ships[0].inventory.length, 0);
});

test('ItemRemoveMessageHandler emits invalid-session when session is invalid', async () => {
  const context = createTestContext();
  seedRemovalScenario(context);
  const handler = new ItemRemoveMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'PilotOne',
    sessionKey: 'wrong-session-key',
    characterId: 'character-1',
    shipId: 'ship-1',
    itemId: 'item-1',
  });

  assert.deepEqual(response, { message: INVALID_SESSION_MESSAGE });
  assert.equal(socket.events[0].eventName, INVALID_SESSION_EVENT);
});
