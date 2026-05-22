'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { ShipListMessageHandler } = require('../src/handlers/ship-list-message-handler');
const { SHIP_LIST_RESPONSE_EVENT } = require('../src/model/ship-list');
const { INVALID_SESSION_EVENT, INVALID_SESSION_MESSAGE } = require('../src/model/session');
const {
  createMockSocket,
  createTestContext,
  seedItems,
  seedPlayer,
} = require('../test-support/message-handler-test-helpers');

test('ShipListMessageHandler returns ships for a player character', async () => {
  const context = createTestContext();
  seedItems(context, [
    {
      id: 'item-1',
      itemType: 'expendable-dart-drone',
      displayName: 'Expendable Dart Drone',
      tier: 1,
      state: 'contained',
      damageStatus: 'intact',
      container: {
        containerType: 'ship',
        containerId: 'ship-1',
      },
      owningPlayerId: 'player-seeded',
      owningCharacterId: 'character-1',
      spatial: null,
      createdAt: '2026-04-17T00:00:00.000Z',
      updatedAt: '2026-04-17T00:00:00.000Z',
      destroyedAt: null,
      destroyedReason: null,
    },
  ]);
  seedPlayer(context, {
    playerName: 'ShipPilot',
    sessionKey: 'session-1',
    characters: [
      {
        id: 'character-1',
        characterName: 'RangerOne',
        ships: [
          {
            id: 'ship-1',
            shipName: 'Scout Ship',
            status: 'active',
            model: 'scout-mk2',
            inventory: [
              {
                itemId: 'item-1',
                itemType: 'expendable-dart-drone',
              },
            ],
            spatial: {
              solarSystemId: 'system-sol',
              frame: 'barycentric',
              positionKm: { x: 100.5, y: 200.3, z: 50.1 },
              epochMs: 1713607200000,
            },
            motion: {
              velocityKmPerSec: { x: 0.5, y: -0.2, z: 0.1 },
            },
          },
        ],
      },
    ],
  });
  const handler = new ShipListMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'shippilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
  });

  assert.equal(response.success, true);
  assert.equal(response.message, 'Ship list retrieved successfully');
  assert.equal(response.playerName, 'ShipPilot');
  assert.equal(response.characterId, 'character-1');
  assert.deepEqual(response.ships, [
    {
      id: 'ship-1',
      name: 'Scout Ship',
      status: 'active',
      model: 'scout-mk2',
      tier: 1,
      createdAt: '',
      inventory: [
        {
          id: 'item-1',
          itemType: 'expendable-dart-drone',
          displayName: 'Expendable Dart Drone',
          tier: 1,
          state: 'contained',
          damageStatus: 'intact',
          container: {
            containerType: 'ship',
            containerId: 'ship-1',
          },
          owningPlayerId: 'player-seeded',
          owningCharacterId: 'character-1',
          spatial: null,
          createdAt: '2026-04-17T00:00:00.000Z',
          updatedAt: '2026-04-17T00:00:00.000Z',
          destroyedAt: null,
          destroyedReason: null,
          launchable: true,
          quantity: 1,
        },
      ],
      spatial: {
        solarSystemId: 'system-sol',
        frame: 'barycentric',
        positionKm: { x: 100.5, y: 200.3, z: 50.1 },
        epochMs: 1713607200000,
      },
      motion: {
        velocityKmPerSec: { x: 0.5, y: -0.2, z: 0.1 },
      },
      launchable: true,
      damageProfile: null,
    },
  ]);
  assert.equal(socket.events[0].eventName, SHIP_LIST_RESPONSE_EVENT);
});

test('ShipListMessageHandler handles missing character in player list', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'EdgePilot',
    sessionKey: 'session-1',
    characters: [{ id: 'character-1', characterName: 'ExistingCharacter' }],
  });
  const handler = new ShipListMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'EdgePilot',
    characterId: 'missing-character-id',
    sessionKey: 'session-1',
  });

  assert.deepEqual(response, {
    success: false,
    message: 'Character is not in player list',
    playerName: 'EdgePilot',
    characterId: 'missing-character-id',
    ships: [],
  });
  assert.equal(socket.events[0].eventName, SHIP_LIST_RESPONSE_EVENT);
});

test('ShipListMessageHandler emits invalid session when session is not valid', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'SessionPilot',
    sessionKey: 'session-1',
    characters: [{ id: 'character-1', characterName: 'RangerOne' }],
  });
  const handler = new ShipListMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'SessionPilot',
    characterId: 'character-1',
    sessionKey: 'wrong-session',
  });

  assert.deepEqual(response, { message: INVALID_SESSION_MESSAGE });
  assert.equal(socket.events[0].eventName, INVALID_SESSION_EVENT);
});

test('ShipListMessageHandler returns ships with kinematics data', async () => {
  const context = createTestContext();
  seedItems(context, [
    {
      id: 'item-1',
      itemType: 'expendable-dart-drone',
      displayName: 'Expendable Dart Drone',
          tier: 1,
      state: 'contained',
      damageStatus: 'intact',
      container: {
        containerType: 'ship',
        containerId: 'ship-1',
      },
      owningPlayerId: 'player-seeded',
      owningCharacterId: 'character-1',
      spatial: null,
      createdAt: '2026-04-17T00:00:00.000Z',
      updatedAt: '2026-04-17T00:00:00.000Z',
      destroyedAt: null,
      destroyedReason: null,
    },
  ]);
  seedPlayer(context, {
    playerName: 'KinematicsPilot',
    sessionKey: 'session-1',
    characters: [
      {
        id: 'character-1',
        characterName: 'Navigator',
        ships: [
          {
            id: 'ship-1',
            shipName: 'Orbital Scout',
            status: 'active',
            model: 'scout-mk3',
            inventory: [
              {
                itemId: 'item-1',
                itemType: 'expendable-dart-drone',
              },
            ],
            spatial: {
              solarSystemId: 'system-sol',
              frame: 'barycentric',
              positionKm: { x: 150.0, y: 250.5, z: 75.3 },
              epochMs: 1713607200000,
            },
            motion: {
              velocityKmPerSec: { x: 1.2, y: 0.8, z: -0.5 },
            },
          },
          {
            id: 'ship-2',
            shipName: 'Silent Runner',
            status: 'idle',
            spatial: {
              solarSystemId: 'system-sol',
              frame: 'barycentric',
              positionKm: { x: 0, y: 0, z: 0 },
              epochMs: 0,
            },
          },
        ],
      },
    ],
  });
  const handler = new ShipListMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'KinematicsPilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
  });

  assert.equal(response.success, true);
  assert.equal(typeof response.ships[0].name, 'string');
  assert.equal('shipName' in response.ships[0], false);
  assert.equal(response.ships.length, 2);
  assert.deepEqual(response.ships[0].inventory, [
    {
      id: 'item-1',
      itemType: 'expendable-dart-drone',
      displayName: 'Expendable Dart Drone',
      tier: 1,
      state: 'contained',
      damageStatus: 'intact',
      container: {
        containerType: 'ship',
        containerId: 'ship-1',
      },
      owningPlayerId: 'player-seeded',
      owningCharacterId: 'character-1',
      spatial: null,
      createdAt: '2026-04-17T00:00:00.000Z',
      updatedAt: '2026-04-17T00:00:00.000Z',
      destroyedAt: null,
      destroyedReason: null,
      launchable: true,
      quantity: 1,
    },
  ]);
  assert.deepEqual(response.ships[0].spatial, {
    solarSystemId: 'system-sol',
    frame: 'barycentric',
    positionKm: { x: 150.0, y: 250.5, z: 75.3 },
    epochMs: 1713607200000,
  });
  assert.deepEqual(response.ships[0].motion, {
    velocityKmPerSec: { x: 1.2, y: 0.8, z: -0.5 },
  });
  assert.ok(response.ships[1].spatial);
  assert.deepEqual(response.ships[1].inventory, []);
  assert.equal(socket.events[0].eventName, SHIP_LIST_RESPONSE_EVENT);
});

test('ShipListMessageHandler hydrates inventory from cache when DB item lookup returns empty', async () => {
  const context = createTestContext();
  seedItems(context, [
    {
      id: 'item-cache-only',
      itemType: 'expendable-dart-drone',
      displayName: 'Expendable Dart Drone',
      state: 'contained',
      damageStatus: 'intact',
      container: {
        containerType: 'ship',
        containerId: 'ship-1',
      },
      owningPlayerId: 'player-seeded',
      owningCharacterId: 'character-1',
      spatial: null,
      createdAt: '2026-04-17T00:00:00.000Z',
      updatedAt: '2026-04-17T00:00:00.000Z',
      destroyedAt: null,
      destroyedReason: null,
    },
  ]);
  context.databaseService = {
    async getItemsByIds() {
      return [];
    },
    async getItemsByContainer() {
      return [];
    },
  };
  seedPlayer(context, {
    playerName: 'ShipPilot',
    sessionKey: 'session-1',
    characters: [
      {
        id: 'character-1',
        characterName: 'RangerOne',
        ships: [
          {
            id: 'ship-1',
            shipName: 'Scout Ship',
            spatial: {
              solarSystemId: 'sol',
              frame: 'barycentric',
              positionKm: { x: 0, y: 0, z: 0 },
              epochMs: 0,
            },
            inventory: [
              {
                itemId: 'item-cache-only',
                itemType: 'expendable-dart-drone',
              },
            ],
          },
        ],
      },
    ],
  });

  const handler = new ShipListMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'ShipPilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
  });

  assert.equal(response.success, true);
  assert.equal(response.ships[0].inventory.length, 1);
  assert.equal(response.ships[0].inventory[0].id, 'item-cache-only');
  assert.equal(socket.events[0].eventName, SHIP_LIST_RESPONSE_EVENT);
});

test('ShipListMessageHandler does not project unreferenced ship-contained items', async () => {
  const context = createTestContext();
  seedItems(context, [
    {
      id: 'item-ref',
      itemType: 'expendable-dart-drone',
      displayName: 'Drone Ref',
      state: 'contained',
      damageStatus: 'intact',
      container: {
        containerType: 'ship',
        containerId: 'ship-1',
      },
      owningPlayerId: 'player-seeded',
      owningCharacterId: 'character-1',
      spatial: null,
      createdAt: '2026-04-17T00:00:00.000Z',
      updatedAt: '2026-04-17T00:00:00.000Z',
      destroyedAt: null,
      destroyedReason: null,
    },
    {
      id: 'item-extra',
      itemType: 'expendable-dart-drone',
      displayName: 'Drone Extra',
      state: 'contained',
      damageStatus: 'intact',
      container: {
        containerType: 'ship',
        containerId: 'ship-1',
      },
      owningPlayerId: 'player-seeded',
      owningCharacterId: 'character-1',
      spatial: null,
      createdAt: '2026-04-17T00:00:00.000Z',
      updatedAt: '2026-04-17T00:00:00.000Z',
      destroyedAt: null,
      destroyedReason: null,
    },
  ]);
  seedPlayer(context, {
    playerName: 'ShipPilot',
    sessionKey: 'session-1',
    characters: [
      {
        id: 'character-1',
        characterName: 'RangerOne',
        ships: [
          {
            id: 'ship-1',
            shipName: 'Scout Ship',
            spatial: {
              solarSystemId: 'sol',
              frame: 'barycentric',
              positionKm: { x: 0, y: 0, z: 0 },
              epochMs: 0,
            },
            inventory: [
              {
                itemId: 'item-ref',
                itemType: 'expendable-dart-drone',
              },
            ],
          },
        ],
      },
    ],
  });

  const handler = new ShipListMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'ShipPilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
  });

  assert.equal(response.success, true);
  assert.equal(response.ships[0].inventory.length, 1);
  assert.ok(response.ships[0].inventory.some((item) => item.id === 'item-ref'));
  assert.ok(!response.ships[0].inventory.some((item) => item.id === 'item-extra'));
  assert.equal(socket.events[0].eventName, SHIP_LIST_RESPONSE_EVENT);
});

test('ShipListMessageHandler includes driveProfile when ship has a valid drive profile', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'DrivePilot',
    sessionKey: 'session-1',
    characters: [
      {
        id: 'character-1',
        characterName: 'Navigator',
        ships: [
          {
            id: 'ship-1',
            shipName: 'Fast Runner',
            model: 'hauler-mk2',
            spatial: {
              solarSystemId: 'sol',
              frame: 'barycentric',
              positionKm: { x: 0, y: 0, z: 0 },
              epochMs: 0,
            },
            driveProfile: {
              id: 'standard-drive-mk1',
              name: 'Standard Drive Mk1',
              rangeAu: 10,
              cruiseSpeedAuPerHour: 0.5,
              fuelCostPerAu: 2.5,
            },
          },
        ],
      },
    ],
  });

  const handler = new ShipListMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'DrivePilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
  });

  assert.equal(response.success, true);
  assert.deepEqual(response.ships[0].driveProfile, {
    id: 'standard-drive-mk1',
    name: 'Standard Drive Mk1',
    rangeAu: 10,
    cruiseSpeedAuPerHour: 0.5,
    fuelCostPerAu: 2.5,
  });
  assert.equal(socket.events[0].eventName, SHIP_LIST_RESPONSE_EVENT);
});

test('ShipListMessageHandler omits driveProfile key when ship has no drive profile', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'NoDrivePilot',
    sessionKey: 'session-1',
    characters: [
      {
        id: 'character-1',
        characterName: 'Drifter',
        ships: [
          {
            id: 'ship-1',
            shipName: 'Scavenger Pod',
            model: 'scavenger-pod',
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

  const handler = new ShipListMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'NoDrivePilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
  });

  assert.equal(response.success, true);
  assert.equal('driveProfile' in response.ships[0], false);
});

test('ShipListMessageHandler omits driveProfile key when driveProfile is null', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'NullDrivePilot',
    sessionKey: 'session-1',
    characters: [
      {
        id: 'character-1',
        characterName: 'Drifter',
        ships: [
          {
            id: 'ship-1',
            shipName: 'Scavenger Pod',
            model: 'scavenger-pod',
            spatial: {
              solarSystemId: 'sol',
              frame: 'barycentric',
              positionKm: { x: 0, y: 0, z: 0 },
              epochMs: 0,
            },
            driveProfile: null,
          },
        ],
      },
    ],
  });

  const handler = new ShipListMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'NullDrivePilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
  });

  assert.equal(response.success, true);
  assert.equal('driveProfile' in response.ships[0], false);
});

test('ShipListMessageHandler omits driveProfile when profile fields are invalid', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'BadDrivePilot',
    sessionKey: 'session-1',
    characters: [
      {
        id: 'character-1',
        characterName: 'Engineer',
        ships: [
          {
            id: 'ship-1',
            shipName: 'Broken Runner',
            model: 'hauler-mk2',
            spatial: {
              solarSystemId: 'sol',
              frame: 'barycentric',
              positionKm: { x: 0, y: 0, z: 0 },
              epochMs: 0,
            },
            driveProfile: {
              id: 'broken-drive',
              name: 'Broken Drive',
              rangeAu: 0, // invalid: must be > 0
              cruiseSpeedAuPerHour: 0.5,
              fuelCostPerAu: 2.5,
            },
          },
        ],
      },
    ],
  });

  const handler = new ShipListMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'BadDrivePilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
  });

  assert.equal(response.success, true);
  assert.equal('driveProfile' in response.ships[0], false);
});

test('ShipListMessageHandler backfills cold-boot starter subsystem inventory items for Scavenger Pod', async () => {
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

  const handler = new ShipListMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'ColdBootPilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
  });

  assert.equal(response.success, true);
  const inventory = response.ships[0].inventory;
  assert.equal(inventory.length, 4);

  const byType = new Map(inventory.map((item) => [item.itemType, item]));
  for (const itemType of ['propulsion-manifold', 'sensor-array', 'power-distribution-bus', 'ship-tractor-beam']) {
    assert.ok(byType.has(itemType));
    const item = byType.get(itemType);
    assert.equal(item.id, `ship-1-starter-${itemType}`);
    assert.equal(item.tier, 1);
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

  assert.equal(socket.events[0].eventName, SHIP_LIST_RESPONSE_EVENT);
});

test('ShipListMessageHandler does not backfill subsystem items for non-cold-boot ships', async () => {
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

  const handler = new ShipListMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'CombatPilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
  });

  assert.equal(response.success, true);
  assert.deepEqual(response.ships[0].inventory, []);
  assert.equal(socket.events[0].eventName, SHIP_LIST_RESPONSE_EVENT);
});

test('ShipListMessageHandler backfills for legacy model value scavenger-pod', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'LegacyModelPilot',
    playerId: 'player-legacy-model',
    sessionKey: 'session-1',
    characters: [
      {
        id: 'character-1',
        characterName: 'Starter',
        ships: [
          {
            id: 'ship-1',
            shipName: 'Scavenger Pod',
            model: 'scavenger-pod',
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

  const handler = new ShipListMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'LegacyModelPilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
  });

  assert.equal(response.success, true);
  const itemTypes = response.ships[0].inventory.map((item) => item.itemType).sort();
  assert.deepEqual(itemTypes, [
    'power-distribution-bus',
    'propulsion-manifold',
    'sensor-array',
    'ship-tractor-beam',
  ]);
  assert.equal(response.ships[0].inventory.every((item) => item.tier === 1), true);
  assert.equal(socket.events[0].eventName, SHIP_LIST_RESPONSE_EVENT);
});

test('ShipListMessageHandler backfilled subsystem rows have non-empty ownership without playerId', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'NoPlayerIdPilot',
    playerId: '',
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

  const handler = new ShipListMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'NoPlayerIdPilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
  });

  assert.equal(response.success, true);
  const subsystemItems = response.ships[0].inventory.filter((item) =>
    ['propulsion-manifold', 'sensor-array', 'power-distribution-bus', 'ship-tractor-beam'].includes(item.itemType)
  );
  assert.equal(subsystemItems.length, 4);
  assert.equal(subsystemItems.every((item) => item.tier === 1), true);
  assert.ok(subsystemItems.every((item) => typeof item.owningPlayerId === 'string' && item.owningPlayerId.length > 0));
  assert.ok(subsystemItems.every((item) => typeof item.owningCharacterId === 'string' && item.owningCharacterId.length > 0));
  assert.equal(socket.events[0].eventName, SHIP_LIST_RESPONSE_EVENT);
});

test('ShipListMessageHandler excludes destroyed items from projected ship inventory even when references are stale', async () => {
  const context = createTestContext();
  seedItems(context, [
    {
      id: 'item-hull-kit',
      itemType: 'hull-patch-kit',
      displayName: 'Hull Patch Kit',
      state: 'destroyed',
      damageStatus: 'destroyed',
      container: null,
      owningPlayerId: 'player-seeded',
      owningCharacterId: 'character-1',
      spatial: null,
      createdAt: '2026-04-17T00:00:00.000Z',
      updatedAt: '2026-04-17T00:00:00.000Z',
      destroyedAt: '2026-04-17T00:00:00.000Z',
      destroyedReason: 'consumed-by:repair',
      launchable: false,
    },
    {
      id: 'item-drone',
      itemType: 'expendable-dart-drone',
      displayName: 'Expendable Dart Drone',
      state: 'contained',
      damageStatus: 'intact',
      container: {
        containerType: 'ship',
        containerId: 'ship-1',
      },
      owningPlayerId: 'player-seeded',
      owningCharacterId: 'character-1',
      spatial: null,
      createdAt: '2026-04-17T00:00:00.000Z',
      updatedAt: '2026-04-17T00:00:00.000Z',
      destroyedAt: null,
      destroyedReason: null,
    },
  ]);
  seedPlayer(context, {
    playerName: 'ShipPilot',
    sessionKey: 'session-1',
    characters: [
      {
        id: 'character-1',
        characterName: 'RangerOne',
        ships: [
          {
            id: 'ship-1',
            shipName: 'Scout Ship',
            model: 'Scavenger Pod',
            tier: 1,
            createdAt: '2026-04-17T00:00:00.000Z',
            inventory: [
              {
                itemId: 'item-hull-kit',
                itemType: 'hull-patch-kit',
              },
              {
                itemId: 'item-drone',
                itemType: 'expendable-dart-drone',
              },
            ],
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

  const handler = new ShipListMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'ShipPilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
  });

  assert.equal(response.success, true);
  assert.equal(response.ships[0].inventory.length, 1);
  assert.equal(response.ships[0].inventory[0].id, 'item-drone');
  assert.equal(
    response.ships[0].inventory.some((item) => item.itemType === 'hull-patch-kit'),
    false
  );
  assert.equal(socket.events[0].eventName, SHIP_LIST_RESPONSE_EVENT);
});
