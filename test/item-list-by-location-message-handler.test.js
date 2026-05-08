'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ItemListByLocationMessageHandler,
} = require('../src/handlers/item-list-by-location-message-handler');
const { ITEM_LIST_BY_LOCATION_RESPONSE_EVENT } = require('../src/model/item-list-by-location');
const { INVALID_SESSION_EVENT, INVALID_SESSION_MESSAGE } = require('../src/model/session');
const {
  createMockSocket,
  createTestContext,
  seedItems,
  seedPlayer,
} = require('../test-support/message-handler-test-helpers');

function createDeployedItem(overrides = {}) {
  return {
    id: 'item-1',
    itemType: 'expendable-dart-drone',
    displayName: 'Expendable Dart Drone',
    state: 'deployed',
    damageStatus: 'intact',
    container: null,
    kinematics: {
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      reference: {
        solarSystemId: 'sol',
        referenceKind: 'barycentric',
        referenceBodyId: null,
        distanceUnit: 'km',
        velocityUnit: 'km/s',
        epochMs: 1000000,
      },
    },
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

test('ItemListByLocationMessageHandler returns nearest-first items with computed distance', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    characters: [{ id: 'character-1', characterName: 'RangerOne' }],
  });

  seedItems(context, [
    createDeployedItem({
      id: 'item-near',
      kinematics: {
        position: { x: 3, y: 4, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        reference: {
          solarSystemId: 'sol',
          referenceKind: 'barycentric',
          referenceBodyId: null,
          distanceUnit: 'km',
          velocityUnit: 'km/s',
          epochMs: 1000000,
        },
      },
    }),
    createDeployedItem({
      id: 'item-mid',
      kinematics: {
        position: { x: 0, y: 6, z: 8 },
        velocity: { x: 0, y: 0, z: 0 },
        reference: {
          solarSystemId: 'sol',
          referenceKind: 'barycentric',
          referenceBodyId: null,
          distanceUnit: 'km',
          velocityUnit: 'km/s',
          epochMs: 1000000,
        },
      },
    }),
    createDeployedItem({
      id: 'item-far',
      kinematics: {
        position: { x: 100, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        reference: {
          solarSystemId: 'sol',
          referenceKind: 'barycentric',
          referenceBodyId: null,
          distanceUnit: 'km',
          velocityUnit: 'km/s',
          epochMs: 1000000,
        },
      },
    }),
  ]);

  const handler = new ItemListByLocationMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'pilotone',
    sessionKey: 'session-1',
    solarSystemId: 'sol',
    positionKm: { x: 0, y: 0, z: 0 },
    distanceKm: 10,
    limit: 2,
  });

  assert.equal(response.success, true);
  assert.equal(response.message, 'Item list retrieved successfully');
  assert.equal(response.playerName, 'PilotOne');
  assert.equal(response.items.length, 2);
  assert.equal(response.items[0].id, 'item-near');
  assert.equal(response.items[0].distanceKm, 5);
  assert.equal(response.items[1].id, 'item-mid');
  assert.equal(response.items[1].distanceKm, 10);
  assert.equal(socket.events[0].eventName, ITEM_LIST_BY_LOCATION_RESPONSE_EVENT);
});

test('ItemListByLocationMessageHandler returns all states (contained, deployed, destroyed)', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });

  const kinematics = {
    position: { x: 1, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    reference: {
      solarSystemId: 'sol',
      referenceKind: 'barycentric',
      referenceBodyId: null,
      distanceUnit: 'km',
      velocityUnit: 'km/s',
      epochMs: 1000000,
    },
  };

  seedItems(context, [
    createDeployedItem({ id: 'item-deployed', state: 'deployed', kinematics }),
    createDeployedItem({ id: 'item-contained', state: 'contained', kinematics }),
    createDeployedItem({ id: 'item-destroyed', state: 'destroyed', kinematics }),
  ]);

  const handler = new ItemListByLocationMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    solarSystemId: 'sol',
    positionKm: { x: 0, y: 0, z: 0 },
    distanceKm: 5,
  });

  assert.equal(response.success, true);
  assert.equal(response.items.length, 3);
  const states = response.items.map((i) => i.state).sort();
  assert.deepEqual(states, ['contained', 'deployed', 'destroyed']);
  assert.equal(socket.events[0].eventName, ITEM_LIST_BY_LOCATION_RESPONSE_EVENT);
});

test('ItemListByLocationMessageHandler filters by itemType when provided', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });

  const kinematics = {
    position: { x: 1, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    reference: {
      solarSystemId: 'sol',
      referenceKind: 'barycentric',
      referenceBodyId: null,
      distanceUnit: 'km',
      velocityUnit: 'km/s',
      epochMs: 1000000,
    },
  };

  seedItems(context, [
    createDeployedItem({ id: 'item-drone', itemType: 'expendable-dart-drone', kinematics }),
    createDeployedItem({ id: 'item-shield', itemType: 'shield-module', kinematics }),
  ]);

  const handler = new ItemListByLocationMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    solarSystemId: 'sol',
    positionKm: { x: 0, y: 0, z: 0 },
    distanceKm: 5,
    itemType: 'expendable-dart-drone',
  });

  assert.equal(response.success, true);
  assert.equal(response.items.length, 1);
  assert.equal(response.items[0].id, 'item-drone');
  assert.equal(response.itemType, 'expendable-dart-drone');
  assert.equal(socket.events[0].eventName, ITEM_LIST_BY_LOCATION_RESPONSE_EVENT);
});

test('ItemListByLocationMessageHandler excludes items from other solar systems', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });

  seedItems(context, [
    createDeployedItem({
      id: 'item-other-system',
      kinematics: {
        position: { x: 1, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        reference: {
          solarSystemId: 'alt-system',
          referenceKind: 'barycentric',
          referenceBodyId: null,
          distanceUnit: 'km',
          velocityUnit: 'km/s',
          epochMs: 1000000,
        },
      },
    }),
  ]);

  const handler = new ItemListByLocationMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    solarSystemId: 'sol',
    positionKm: { x: 0, y: 0, z: 0 },
    distanceKm: 100,
  });

  assert.equal(response.success, true);
  assert.equal(response.message, 'No items found within distance');
  assert.deepEqual(response.items, []);
  assert.equal(socket.events[0].eventName, ITEM_LIST_BY_LOCATION_RESPONSE_EVENT);
});

test('ItemListByLocationMessageHandler excludes items without kinematics', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });

  seedItems(context, [createDeployedItem({ id: 'item-no-kinematics', kinematics: null })]);

  const handler = new ItemListByLocationMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    solarSystemId: 'sol',
    positionKm: { x: 0, y: 0, z: 0 },
    distanceKm: 100,
  });

  assert.equal(response.success, true);
  assert.deepEqual(response.items, []);
  assert.equal(socket.events[0].eventName, ITEM_LIST_BY_LOCATION_RESPONSE_EVENT);
});

test('ItemListByLocationMessageHandler validates required inputs', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });

  const handler = new ItemListByLocationMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    solarSystemId: 'sol',
    positionKm: { x: 0, y: 0 },
    distanceKm: -1,
  });

  assert.equal(response.success, false);
  assert.equal(
    response.message,
    'playerName, solarSystemId, positionKm, and distanceKm are required'
  );
  assert.deepEqual(response.items, []);
  assert.equal(socket.events[0].eventName, ITEM_LIST_BY_LOCATION_RESPONSE_EVENT);
});

test('ItemListByLocationMessageHandler rejects invalid limit', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });

  const handler = new ItemListByLocationMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    solarSystemId: 'sol',
    positionKm: { x: 0, y: 0, z: 0 },
    distanceKm: 10,
    limit: -5,
  });

  assert.equal(response.success, false);
  assert.equal(response.message, 'limit must be a positive integer when provided');
  assert.deepEqual(response.items, []);
  assert.equal(socket.events[0].eventName, ITEM_LIST_BY_LOCATION_RESPONSE_EVENT);
});

test('ItemListByLocationMessageHandler emits invalid session before query', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });

  const handler = new ItemListByLocationMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'PilotOne',
    sessionKey: 'wrong-session',
    solarSystemId: 'sol',
    positionKm: { x: 0, y: 0, z: 0 },
    distanceKm: 10,
  });

  assert.deepEqual(response, { message: INVALID_SESSION_MESSAGE });
  assert.equal(socket.events[0].eventName, INVALID_SESSION_EVENT);
});

test('ItemListByLocationMessageHandler merges cache results when DB query returns empty', async () => {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });

  seedItems(context, [
    createDeployedItem({
      id: 'item-cache-only',
      kinematics: {
        position: { x: 1, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        reference: {
          solarSystemId: 'sol',
          referenceKind: 'barycentric',
          referenceBodyId: null,
          distanceUnit: 'km',
          velocityUnit: 'km/s',
          epochMs: 1000000,
        },
      },
    }),
  ]);

  context.databaseService = {
    async findItemsNearPosition() {
      return [];
    },
  };

  const handler = new ItemListByLocationMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    solarSystemId: 'sol',
    positionKm: { x: 0, y: 0, z: 0 },
    distanceKm: 10,
  });

  assert.equal(response.success, true);
  assert.equal(response.items.length, 1);
  assert.equal(response.items[0].id, 'item-cache-only');
  assert.equal(socket.events[0].eventName, ITEM_LIST_BY_LOCATION_RESPONSE_EVENT);
});
