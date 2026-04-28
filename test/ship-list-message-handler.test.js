'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ShipListMessageHandler
} = require('../src/handlers/ship-list-message-handler');
const {
  SHIP_LIST_RESPONSE_EVENT
} = require('../src/model/ship-list');
const {
  INVALID_SESSION_EVENT,
  INVALID_SESSION_MESSAGE
} = require('../src/model/session');
const {
  createMockSocket,
  createTestContext,
  seedItems,
  seedPlayer
} = require('../test-support/message-handler-test-helpers');

test('ShipListMessageHandler returns ships for a player character', async () => {
  const context = createTestContext();
  seedItems(context, [
    {
      id: 'item-1',
      itemType: 'expendable-dart-drone',
      displayName: 'Expendable Dart Drone',
      state: 'contained',
      damageStatus: 'intact',
      container: {
        containerType: 'ship',
        containerId: 'ship-1'
      },
      owningPlayerId: 'player-seeded',
      owningCharacterId: 'character-1',
      kinematics: null,
      createdAt: '2026-04-17T00:00:00.000Z',
      updatedAt: '2026-04-17T00:00:00.000Z',
      destroyedAt: null,
      destroyedReason: null
    }
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
            name: 'Scout Ship',
            status: 'active',
            model: 'scout-mk2',
            inventory: [
              {
                itemId: 'item-1',
                itemType: 'expendable-dart-drone'
              }
            ],
            kinematics: {
              position: { x: 100.5, y: 200.3, z: 50.1 },
              velocity: { x: 0.5, y: -0.2, z: 0.1 },
              reference: {
                solarSystemId: 'system-sol',
                referenceKind: 'barycentric',
                referenceBodyId: null,
                epochMs: 1713607200000
              }
            }
          }
        ]
      }
    ]
  });
  const handler = new ShipListMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'shippilot',
    characterId: 'character-1',
    sessionKey: 'session-1'
  });

  assert.equal(response.success, true);
  assert.equal(response.message, 'Ship list retrieved successfully');
  assert.equal(response.playerName, 'ShipPilot');
  assert.equal(response.characterId, 'character-1');
  assert.deepEqual(response.ships, [
    {
      id: 'ship-1',
      name: 'Scout Ship',
      shipName: 'Scout Ship',
      status: 'active',
      model: 'scout-mk2',
      inventory: [
        {
          id: 'item-1',
          itemType: 'expendable-dart-drone',
          displayName: 'Expendable Dart Drone',
          state: 'contained',
          damageStatus: 'intact',
          container: {
            containerType: 'ship',
            containerId: 'ship-1'
          },
          owningPlayerId: 'player-seeded',
          owningCharacterId: 'character-1',
          kinematics: null,
          createdAt: '2026-04-17T00:00:00.000Z',
          updatedAt: '2026-04-17T00:00:00.000Z',
          destroyedAt: null,
          destroyedReason: null,
          launchable: true
        }
      ],
      kinematics: {
        position: { x: 100.5, y: 200.3, z: 50.1 },
        velocity: { x: 0.5, y: -0.2, z: 0.1 },
        reference: {
          solarSystemId: 'system-sol',
          referenceKind: 'barycentric',
          referenceBodyId: null,
          epochMs: 1713607200000
        }
      },
      launchable: true
    }
  ]);
  assert.equal(socket.events[0].eventName, SHIP_LIST_RESPONSE_EVENT);
});

test('ShipListMessageHandler handles missing character in player list', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'EdgePilot',
    sessionKey: 'session-1',
    characters: [{ id: 'character-1', characterName: 'ExistingCharacter' }]
  });
  const handler = new ShipListMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'EdgePilot',
    characterId: 'missing-character-id',
    sessionKey: 'session-1'
  });

  assert.deepEqual(response, {
    success: false,
    message: 'Character is not in player list',
    playerName: 'EdgePilot',
    characterId: 'missing-character-id',
    ships: []
  });
  assert.equal(socket.events[0].eventName, SHIP_LIST_RESPONSE_EVENT);
});

test('ShipListMessageHandler emits invalid session when session is not valid', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'SessionPilot',
    sessionKey: 'session-1',
    characters: [{ id: 'character-1', characterName: 'RangerOne' }]
  });
  const handler = new ShipListMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'SessionPilot',
    characterId: 'character-1',
    sessionKey: 'wrong-session'
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
      state: 'contained',
      damageStatus: 'intact',
      container: {
        containerType: 'ship',
        containerId: 'ship-1'
      },
      owningPlayerId: 'player-seeded',
      owningCharacterId: 'character-1',
      kinematics: null,
      createdAt: '2026-04-17T00:00:00.000Z',
      updatedAt: '2026-04-17T00:00:00.000Z',
      destroyedAt: null,
      destroyedReason: null
    }
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
            name: 'Orbital Scout',
            status: 'active',
            model: 'scout-mk3',
            inventory: [
              {
                itemId: 'item-1',
                itemType: 'expendable-dart-drone'
              }
            ],
            kinematics: {
              position: { x: 150.0, y: 250.5, z: 75.3 },
              velocity: { x: 1.2, y: 0.8, z: -0.5 },
              reference: {
                solarSystemId: 'system-sol',
                referenceKind: 'body-centered',
                referenceBodyId: 'earth',
                epochMs: 1713607200000
              }
            }
          },
          {
            id: 'ship-2',
            name: 'Silent Runner',
            status: 'idle'
          }
        ]
      }
    ]
  });
  const handler = new ShipListMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'KinematicsPilot',
    characterId: 'character-1',
    sessionKey: 'session-1'
  });

  assert.equal(response.success, true);
  assert.equal(response.ships.length, 2);
  assert.deepEqual(response.ships[0].inventory, [
    {
      id: 'item-1',
      itemType: 'expendable-dart-drone',
      displayName: 'Expendable Dart Drone',
      state: 'contained',
      damageStatus: 'intact',
      container: {
        containerType: 'ship',
        containerId: 'ship-1'
      },
      owningPlayerId: 'player-seeded',
      owningCharacterId: 'character-1',
      kinematics: null,
      createdAt: '2026-04-17T00:00:00.000Z',
      updatedAt: '2026-04-17T00:00:00.000Z',
      destroyedAt: null,
      destroyedReason: null,
      launchable: true
    }
  ]);
  assert.deepEqual(response.ships[0].kinematics, {
    position: { x: 150.0, y: 250.5, z: 75.3 },
    velocity: { x: 1.2, y: 0.8, z: -0.5 },
    reference: {
      solarSystemId: 'system-sol',
      referenceKind: 'body-centered',
      referenceBodyId: 'earth',
      epochMs: 1713607200000
    }
  });
  assert.equal(response.ships[1].kinematics, undefined);
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
        containerId: 'ship-1'
      },
      owningPlayerId: 'player-seeded',
      owningCharacterId: 'character-1',
      kinematics: null,
      createdAt: '2026-04-17T00:00:00.000Z',
      updatedAt: '2026-04-17T00:00:00.000Z',
      destroyedAt: null,
      destroyedReason: null
    }
  ]);
  context.databaseService = {
    async getItemsByIds() {
      return [];
    },
    async getItemsByContainer() {
      return [];
    }
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
            inventory: [
              {
                itemId: 'item-cache-only',
                itemType: 'expendable-dart-drone'
              }
            ]
          }
        ]
      }
    ]
  });

  const handler = new ShipListMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'ShipPilot',
    characterId: 'character-1',
    sessionKey: 'session-1'
  });

  assert.equal(response.success, true);
  assert.equal(response.ships[0].inventory.length, 1);
  assert.equal(response.ships[0].inventory[0].id, 'item-cache-only');
  assert.equal(socket.events[0].eventName, SHIP_LIST_RESPONSE_EVENT);
});

test('ShipListMessageHandler includes ship-contained items beyond inventory references', async () => {
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
        containerId: 'ship-1'
      },
      owningPlayerId: 'player-seeded',
      owningCharacterId: 'character-1',
      kinematics: null,
      createdAt: '2026-04-17T00:00:00.000Z',
      updatedAt: '2026-04-17T00:00:00.000Z',
      destroyedAt: null,
      destroyedReason: null
    },
    {
      id: 'item-extra',
      itemType: 'expendable-dart-drone',
      displayName: 'Drone Extra',
      state: 'contained',
      damageStatus: 'intact',
      container: {
        containerType: 'ship',
        containerId: 'ship-1'
      },
      owningPlayerId: 'player-seeded',
      owningCharacterId: 'character-1',
      kinematics: null,
      createdAt: '2026-04-17T00:00:00.000Z',
      updatedAt: '2026-04-17T00:00:00.000Z',
      destroyedAt: null,
      destroyedReason: null
    }
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
            inventory: [
              {
                itemId: 'item-ref',
                itemType: 'expendable-dart-drone'
              }
            ]
          }
        ]
      }
    ]
  });

  const handler = new ShipListMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'ShipPilot',
    characterId: 'character-1',
    sessionKey: 'session-1'
  });

  assert.equal(response.success, true);
  assert.equal(response.ships[0].inventory.length, 2);
  assert.ok(response.ships[0].inventory.some((item) => item.id === 'item-ref'));
  assert.ok(response.ships[0].inventory.some((item) => item.id === 'item-extra'));
  assert.equal(socket.events[0].eventName, SHIP_LIST_RESPONSE_EVENT);
});
