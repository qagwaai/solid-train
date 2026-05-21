'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { LaunchItemMessageHandler } = require('../src/handlers/launch-item-message-handler');
const { ITEM_STATE, ITEM_DAMAGE_STATUS } = require('../src/model/canonical-items');
const { LAUNCH_ITEM_RESPONSE_EVENT } = require('../src/model/launch-item');
const { INVALID_SESSION_EVENT, INVALID_SESSION_MESSAGE } = require('../src/model/session');
const {
  createMockSocket,
  createTestContext,
  seedCelestialBodies,
  seedItems,
  seedPlayer,
} = require('../test-support/message-handler-test-helpers');

function createLaunchPayload(overrides = {}) {
  return {
    playerName: 'PilotOne',
    characterId: 'character-1',
    shipId: 'ship-1',
    sessionKey: 'session-1',
    targetCelestialBodyId: 'cb-1',
    hotkey: 3,
    itemId: 'item-1',
    itemType: 'expendable-dart-drone',
    ...overrides,
  };
}

function createSeedItem(overrides = {}) {
  return {
    id: 'item-1',
    itemType: 'expendable-dart-drone',
    displayName: 'Expendable Dart Drone',
    state: ITEM_STATE.CONTAINED,
    damageStatus: ITEM_DAMAGE_STATUS.INTACT,
    container: { containerType: 'ship', containerId: 'ship-1' },
    owningPlayerId: 'player-seeded',
    owningCharacterId: 'character-1',
    spatial: null,
    createdAt: '2026-04-17T00:00:00.000Z',
    updatedAt: '2026-04-17T00:00:00.000Z',
    destroyedAt: null,
    destroyedReason: null,
    launchable: true,
    ...overrides,
  };
}

function createSeedTarget(overrides = {}) {
  return {
    id: 'cb-1',
    catalogId: 'CAT-001',
    sourceScanId: 'scan-1',
    createdByCharacterId: 'character-1',
    missionId: 'first-target',
    missionInstanceId: null,
    createdAt: '2026-04-17T00:00:00.000Z',
    updatedAt: '2026-04-17T00:00:00.000Z',
    spatial: {
      solarSystemId: 'sol',
      frame: 'barycentric',
      positionKm: { x: 100, y: 200, z: 300 },
      epochMs: 1713360000000,
    },
    motion: {
      velocityKmPerSec: { x: 1, y: 1, z: 1 },
      angularVelocityRadPerSec: { x: 0.1, y: 0.2, z: 0.3 },
    },
    physical: {
      estimatedMassKg: 42000000000,
      estimatedDiameterM: 320,
    },
    observability: {
      visibility: 'visible',
      scanState: 'scanned',
    },
    composition: {
      rarity: 'Rare',
      material: 'Nickel-Iron',
      textureColor: '#8df7b2',
    },
    state: 'active',
    destroyedAt: null,
    destroyedReason: null,
    debrisSeed: null,
    debris: [],
    ...overrides,
  };
}

function seedLaunchScenario(context) {
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
  seedItems(context, [createSeedItem()]);
  seedCelestialBodies(context, [createSeedTarget()]);
}

test('LaunchItemMessageHandler resolves expendable dart launch against a celestial body', async () => {
  const context = createTestContext();
  seedLaunchScenario(context);

  const handler = new LaunchItemMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, createLaunchPayload());

  assert.equal(response.success, true);
  assert.equal(response.message, 'Launch successful: target destroyed and materials yielded');
  assert.equal(response.playerName, 'PilotOne');
  assert.equal(response.characterId, 'character-1');
  assert.equal(response.shipId, 'ship-1');
  assert.equal(response.targetCelestialBodyId, 'cb-1');
  assert.equal(response.itemId, 'item-1');
  assert.equal(response.itemType, 'expendable-dart-drone');
  assert.equal(response.resolution.outcome, 'target-destroyed');
  assert.equal(response.resolution.targetDestroyed, true);
  assert.equal(response.resolution.yieldedMaterials.length, 1);
  assert.equal(response.resolution.yieldedMaterials[0].material, 'Nickel-Iron');
  assert.equal(response.resolution.yieldedMaterials[0].rarity, 'Rare');
  assert.equal(response.resolution.yieldedMaterials[0].quantity, 16);
  assert.equal(response.resolution.yieldedItems.length, 1);
  assert.equal(response.resolution.yieldedItems[0].quantity, 16);
  assert.equal(response.resolution.yieldedItems[0].state, 'deployed');
  assert.equal(response.resolution.yieldedItems[0].container, null);
  assert.ok(response.resolution.yieldedItems[0].spatial);
  assert.equal(response.resolution.yieldedItems[0].spatial.solarSystemId, 'sol');
  assert.equal(response.resolution.launchSeed >= 0, true);
  assert.equal(response.launchedItem.state, 'destroyed');
  assert.equal(response.launchedItem.launchable, false);

  const [updatedItem] = await context.getItemsByIdsAsync(['item-1']);
  assert.equal(updatedItem.state, 'destroyed');
  assert.equal(updatedItem.container, null);

  const character = context.findCharacter('PilotOne', 'character-1');
  assert.equal(character.ships[0].inventory.length, 0);

  const materialItemIds = response.resolution.yieldedItems.map((entry) => entry.id);
  const materialItems = await context.getItemsByIdsAsync(materialItemIds);
  assert.equal(materialItems.length, 1);
  assert.equal(materialItems[0].itemType, 'raw-material-nickel-iron');
  assert.equal(materialItems[0].quantity, 16);
  assert.equal(materialItems[0].state, 'deployed');
  assert.equal(materialItems[0].container, null);
  assert.ok(materialItems[0].spatial);

  const target = context.getCelestialBody('cb-1');
  assert.equal(target.state, 'destroyed');
  assert.equal(target.destroyedReason, 'impacted-by:expendable-dart-drone');
  assert.equal(target.debris.length, 1);
  assert.equal(target.debris[0].itemType, 'raw-material-nickel-iron');

  assert.equal(socket.events[0].eventName, LAUNCH_ITEM_RESPONSE_EVENT);
});

test('LaunchItemMessageHandler keeps yielded materials contained outside first-target mission', async () => {
  const context = createTestContext();
  seedLaunchScenario(context);

  const target = context.getCelestialBody('cb-1');
  target.missionId = null;

  const handler = new LaunchItemMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, createLaunchPayload());

  assert.equal(response.success, true);
  assert.equal(response.resolution.yieldedItems.length, 1);
  assert.equal(response.resolution.yieldedItems[0].state, 'contained');
  assert.ok(response.resolution.yieldedItems[0].container);
  assert.equal(response.resolution.yieldedItems[0].container.containerType, 'ship');
  assert.equal(response.resolution.yieldedItems[0].container.containerId, 'ship-1');

  const character = context.findCharacter('PilotOne', 'character-1');
  assert.equal(character.ships[0].inventory.length, 1);
  assert.equal(character.ships[0].inventory[0].itemType, 'raw-material-nickel-iron');
  assert.equal(socket.events[0].eventName, LAUNCH_ITEM_RESPONSE_EVENT);
});

test('LaunchItemMessageHandler returns success no-effect for unsupported launch item types', async () => {
  const context = createTestContext();
  seedLaunchScenario(context);
  seedItems(context, [
    createSeedItem({
      id: 'item-2',
      itemType: 'basic-mining-laser',
      displayName: 'Basic Mining Laser',
    }),
  ]);

  const character = context.findCharacter('PilotOne', 'character-1');
  character.ships[0].inventory = [
    {
      itemId: 'item-2',
      itemType: 'basic-mining-laser',
    },
  ];

  const handler = new LaunchItemMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(
    socket,
    createLaunchPayload({
      itemId: 'item-2',
      itemType: 'basic-mining-laser',
    })
  );

  assert.equal(response.success, true);
  assert.equal(
    response.message,
    'Launch completed with no effect for itemType: basic-mining-laser'
  );
  assert.equal(response.resolution.outcome, 'no-effect');
  assert.equal(response.resolution.targetDestroyed, false);
  assert.equal(response.resolution.yieldedMaterials.length, 0);
  assert.equal(response.resolution.yieldedItems.length, 0);

  const [consumedUnsupportedItem] = await context.getItemsByIdsAsync(['item-2']);
  assert.equal(consumedUnsupportedItem.state, 'destroyed');

  const characterAfterLaunch = context.findCharacter('PilotOne', 'character-1');
  assert.equal(characterAfterLaunch.ships[0].inventory.length, 0);

  const target = context.getCelestialBody('cb-1');
  assert.equal(target.state, 'active');
  assert.equal(socket.events[0].eventName, LAUNCH_ITEM_RESPONSE_EVENT);
});

test('LaunchItemMessageHandler rejects missing target celestial body', async () => {
  const context = createTestContext();
  seedLaunchScenario(context);

  const handler = new LaunchItemMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(
    socket,
    createLaunchPayload({
      targetCelestialBodyId: 'cb-missing',
    })
  );

  assert.equal(response.success, false);
  assert.equal(response.message, 'Target celestial body does not exist');
  assert.equal(socket.events[0].eventName, LAUNCH_ITEM_RESPONSE_EVENT);
});

test('LaunchItemMessageHandler emits invalid session before processing', async () => {
  const context = createTestContext();
  seedLaunchScenario(context);

  const handler = new LaunchItemMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(
    socket,
    createLaunchPayload({
      sessionKey: 'wrong-session',
    })
  );

  assert.deepEqual(response, { message: INVALID_SESSION_MESSAGE });
  assert.equal(socket.events[0].eventName, INVALID_SESSION_EVENT);
});

test('LaunchItemMessageHandler resolves launch against an unscanned target asteroid', async () => {
  const context = createTestContext();
  seedLaunchScenario(context);

  const target = context.getCelestialBody('cb-1');
  target.state = 'unscanned';

  const handler = new LaunchItemMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, createLaunchPayload());

  assert.equal(response.success, true);
  assert.equal(response.resolution.outcome, 'target-destroyed');
  assert.equal(response.resolution.targetCelestialBody.state, 'destroyed');
});
