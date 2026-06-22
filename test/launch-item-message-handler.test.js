'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { LaunchItemMessageHandler } = require('../src/handlers/launch-item-message-handler');
const { ITEM_STATE, ITEM_DAMAGE_STATUS } = require('../src/model/canonical-items');
const { LAUNCH_ITEM_RESPONSE_EVENT } = require('../src/model/launch-item');

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
    correlationId: '0b16ca57-4773-4348-9c69-20598ba55bae',
    requestIdentity: {
      operation: 'launch-item',
      entityType: 'expendable-dart-drone',
      containerId: 'ship-1',
    },
    targetCelestialBodyId: 'cb-1',
    hotkey: 3,
    itemId: 'item-1',
    itemType: 'expendable-dart-drone',
    ...overrides,
  };
}

test('LaunchItemMessageHandler echoes correlationId and requestIdentity on success and validation error', async () => {
  const context = createTestContext();
  seedLaunchScenario(context);

  const handler = new LaunchItemMessageHandler(context);

  const successSocket = createMockSocket();
  const successRequest = createLaunchPayload({
    correlationId: '0b16ca57-4773-4348-9c69-20598ba55bae',
    requestIdentity: {
      operation: 'launch-item',
      entityType: 'expendable-dart-drone',
      containerId: 'ship-1',
    },
  });
  const successResponse = await handler.handle(successSocket, successRequest);

  assert.equal(successResponse.success, true);
  assert.equal(successResponse.correlationId, successRequest.correlationId);
  assert.deepEqual(successResponse.requestIdentity, successRequest.requestIdentity);

  const errorSocket = createMockSocket();
  const errorRequest = createLaunchPayload({
    targetCelestialBodyId: 'cb-missing',
    correlationId: 'c77e0eb2-322f-4a6e-bf24-f1eb7e89f5b3',
    requestIdentity: {
      operation: 'launch-item',
      entityType: 'sensor-array',
      containerId: 'ship-1',
    },
  });
  const errorResponse = await handler.handle(errorSocket, errorRequest);

  assert.equal(errorResponse.success, false);
  assert.equal(errorResponse.correlationId, errorRequest.correlationId);
  assert.deepEqual(errorResponse.requestIdentity, errorRequest.requestIdentity);
});

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
  assert.equal(response.resolution.yieldedItems[0].itemType, 'iron');
  assert.equal(response.resolution.yieldedItems[0].tier, 1);
  assert.equal(response.resolution.yieldedItems[0].state, 'deployed');
  assert.equal(response.resolution.yieldedItems[0].container, null);
  assert.ok(response.resolution.yieldedItems[0].spatial);
  assert.equal(response.resolution.yieldedItems[0].spatial.solarSystemId, 'sol');
  assert.ok(response.resolution.yieldedItems[0].motion);
  assert.ok(response.resolution.yieldedItems[0].motion.velocityKmPerSec);
  assert.equal(response.resolution.launchSeed >= 0, true);
  assert.equal(response.launchedItem.state, 'destroyed');
  assert.equal(response.launchedItem.launchable, true);

  const [updatedItem] = await context.getItemsByIdsAsync(['item-1']);
  assert.equal(updatedItem.state, 'destroyed');
  assert.equal(updatedItem.container, null);

  const character = context.findCharacter('PilotOne', 'character-1');
  assert.equal(character.ships[0].inventory.length, 0);

  const materialItemIds = response.resolution.yieldedItems.map((entry) => entry.id);
  const materialItems = await context.getItemsByIdsAsync(materialItemIds);
  assert.equal(materialItems.length, 1);
  assert.equal(materialItems[0].itemType, 'iron');
  assert.equal(materialItems[0].tier, 1);
  assert.equal(materialItems[0].quantity, 16);
  assert.equal(materialItems[0].state, 'deployed');
  assert.equal(materialItems[0].container, null);
  assert.ok(materialItems[0].spatial);
  assert.ok(materialItems[0].motion);

  const targetPosition = createSeedTarget().spatial.positionKm;
  const debrisPosition = materialItems[0].spatial.positionKm;
  const distanceFromTarget = context.calculateDistanceKm(targetPosition, debrisPosition);
  assert.equal(distanceFromTarget >= 10, true);
  assert.equal(distanceFromTarget <= 50, true);

  const target = context.getCelestialBody('cb-1');
  assert.equal(target.state, 'destroyed');
  assert.equal(target.destroyedReason, 'impacted-by:expendable-dart-drone');
  assert.equal(target.debris.length, 1);
  assert.equal(target.debris[0].itemType, 'iron');

  const missions = context.getCharacters('pilotone')[0].missions;
  const starterMission = missions.find((mission) => mission.missionId === 'first-target');
  assert.ok(starterMission);
  assert.equal(starterMission.status, 'completed');
  assert.ok(Array.isArray(response.missionProgression.unlockedMissionIds));
  assert.ok(response.missionProgression.unlockedMissionIds.includes('m-01'));
  assert.ok(response.missionProgression.unlockedMissionIds.includes('sq-02'));
  assert.ok(response.missionProgression.unlockedMissionIds.includes('sq-03'));

  assert.equal(socket.events[0].eventName, LAUNCH_ITEM_RESPONSE_EVENT);
});

test('LaunchItemMessageHandler validates ship membership against canonical projected inventory', async () => {
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
            shipName: 'Scavenger Pod',
            model: 'Scavenger Pod',
            inventory: [],
            createdAt: '2026-04-17T00:00:00.000Z',
            damageProfile: {
              overallStatus: 'damaged',
              summary: 'Starter cold boot damage profile',
              origin: 'cold-boot-scripted',
              updatedAt: '2026-04-17T00:00:00.000Z',
              systems: [],
            },
          },
        ],
        missions: [
          {
            missionId: 'first-target',
            status: 'active',
            updatedAt: '2026-04-17T00:00:00.000Z',
          },
        ],
      },
    ],
  });
  seedItems(context, [createSeedItem()]);
  seedCelestialBodies(context, [createSeedTarget()]);

  const handler = new LaunchItemMessageHandler(context);
  const response = await handler.handle(createMockSocket(), createLaunchPayload());

  assert.equal(response.success, true);
  assert.equal(response.message, 'Launch successful: target destroyed and materials yielded');
  assert.equal(response.resolution.outcome, 'target-destroyed');
});

test('LaunchItemMessageHandler deploys yielded materials for non-first-target missions', async () => {
  const context = createTestContext();
  seedLaunchScenario(context);

  const target = context.getCelestialBody('cb-1');
  target.missionId = null;

  const handler = new LaunchItemMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, createLaunchPayload());

  assert.equal(response.success, true);
  assert.equal(response.resolution.yieldedItems.length, 1);
  assert.equal(response.resolution.yieldedItems[0].itemType, 'iron');
  assert.equal(response.resolution.yieldedItems[0].tier, 1);
  assert.equal(response.resolution.yieldedItems[0].state, 'deployed');
  assert.equal(response.resolution.yieldedItems[0].container, null);
  assert.ok(response.resolution.yieldedItems[0].spatial);
  assert.ok(response.resolution.yieldedItems[0].motion);

  const character = context.findCharacter('PilotOne', 'character-1');
  assert.equal(character.ships[0].inventory.length, 0);
  assert.equal(socket.events[0].eventName, LAUNCH_ITEM_RESPONSE_EVENT);
});

test('LaunchItemMessageHandler emits terminal launch-item-response failure for unsupported yield material', async () => {
  const context = createTestContext();
  seedLaunchScenario(context);

  const target = context.getCelestialBody('cb-1');
  target.composition.material = 'Unmapped Crystal';

  const handler = new LaunchItemMessageHandler(context);
  const socket = createMockSocket();
  const response = await handler.handle(socket, createLaunchPayload());

  assert.equal(response.success, false);
  assert.equal(response.message, 'Unsupported launch yield material(s): Unmapped Crystal');
  assert.equal(socket.events.length, 1);
  assert.equal(socket.events[0].eventName, LAUNCH_ITEM_RESPONSE_EVENT);

  const [unconsumedItem] = await context.getItemsByIdsAsync(['item-1']);
  assert.equal(unconsumedItem.state, ITEM_STATE.CONTAINED);

  const unchangedTarget = context.getCelestialBody('cb-1');
  assert.equal(unchangedTarget.state, 'active');
});

test('LaunchItemMessageHandler emits terminal launch-item-response failure on unexpected internal errors', async () => {
  const context = createTestContext();
  seedLaunchScenario(context);

  context.addItemsAsync = async () => {
    throw new Error('forced-add-items-failure');
  };

  const handler = new LaunchItemMessageHandler(context);
  const socket = createMockSocket();
  const response = await handler.handle(socket, createLaunchPayload());

  assert.equal(response.success, false);
  assert.equal(response.message, 'Launch failed: internal runtime error');
  assert.equal(response.correlationId, '0b16ca57-4773-4348-9c69-20598ba55bae');
  assert.equal(socket.events.length, 1);
  assert.equal(socket.events[0].eventName, LAUNCH_ITEM_RESPONSE_EVENT);
  assert.equal(socket.events[0].payload.success, false);
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
