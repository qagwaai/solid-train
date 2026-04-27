'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ShipUpsertMessageHandler
} = require('../src/handlers/ship-upsert-message-handler');
const {
  SHIP_UPSERT_RESPONSE_EVENT
} = require('../src/model/ship-upsert');
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

function createShipUpdate(overrides = {}) {
  return {
    id: 'ship-1',
    location: {
      positionKm: { x: 100.5, y: 200.3, z: 50.1 }
    },
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
    ...overrides
  };
}

test('ShipUpsertMessageHandler updates ship location and kinematics', async () => {
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
            shipName: 'Scout Ship',
            inventory: [
              {
                itemId: 'item-1',
                itemType: 'expendable-dart-drone'
              }
            ],
            createdAt: '2026-04-17T00:00:00.000Z'
          }
        ]
      }
    ]
  });

  const handler = new ShipUpsertMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'shippilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
    ship: createShipUpdate()
  });

  assert.equal(response.success, true);
  assert.equal(response.message, 'Ship updated successfully');
  assert.equal(response.playerName, 'ShipPilot');
  assert.equal(response.characterId, 'character-1');
  assert.equal(response.ship.id, 'ship-1');
  assert.deepEqual(response.ship.location, {
    positionKm: { x: 100.5, y: 200.3, z: 50.1 }
  });
  assert.deepEqual(response.ship.inventory, [
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
  assert.deepEqual(response.ship.kinematics.reference, {
    solarSystemId: 'system-sol',
    referenceKind: 'barycentric',
    referenceBodyId: null,
    distanceUnit: 'km',
    velocityUnit: 'km/s',
    epochMs: 1713607200000
  });
  assert.equal(socket.events[0].eventName, SHIP_UPSERT_RESPONSE_EVENT);
});

test('ShipUpsertMessageHandler rejects missing location and kinematics update', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'ShipPilot',
    sessionKey: 'session-1',
    characters: [
      {
        id: 'character-1',
        characterName: 'RangerOne',
        ships: [{ id: 'ship-1', shipName: 'Scout Ship', createdAt: '2026-04-17T00:00:00.000Z' }]
      }
    ]
  });

  const handler = new ShipUpsertMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'ShipPilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
    ship: { id: 'ship-1' }
  });

  assert.equal(response.success, false);
  assert.equal(response.message, 'ship.location, ship.kinematics, ship.model, and/or ship.tier is required');
  assert.equal(socket.events[0].eventName, SHIP_UPSERT_RESPONSE_EVENT);
});

test('ShipUpsertMessageHandler emits invalid session before mutation', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'SessionPilot',
    sessionKey: 'session-1',
    characters: [
      {
        id: 'character-1',
        characterName: 'RangerOne',
        ships: [{ id: 'ship-1', shipName: 'Scout Ship', createdAt: '2026-04-17T00:00:00.000Z' }]
      }
    ]
  });

  const handler = new ShipUpsertMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'SessionPilot',
    characterId: 'character-1',
    sessionKey: 'wrong-session',
    ship: createShipUpdate()
  });

  assert.deepEqual(response, { message: INVALID_SESSION_MESSAGE });
  assert.equal(socket.events[0].eventName, INVALID_SESSION_EVENT);
});

test('ShipUpsertMessageHandler updates ship model and tier', async () => {
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
            shipName: 'Scout Ship',
            model: 'Scavenger Pod',
            tier: 1,
            inventory: [
              {
                itemId: 'item-1',
                itemType: 'expendable-dart-drone'
              }
            ],
            createdAt: '2026-04-17T00:00:00.000Z'
          }
        ]
      }
    ]
  });

  const handler = new ShipUpsertMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'shippilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
    ship: { id: 'ship-1', model: 'Reaver Hauler', tier: 2 }
  });

  assert.equal(response.success, true);
  assert.equal(response.message, 'Ship updated successfully');
  assert.equal(response.ship.model, 'Reaver Hauler');
  assert.equal(response.ship.tier, 2);
  assert.equal(response.ship.inventory[0].id, 'item-1');
  assert.equal(socket.events[0].eventName, SHIP_UPSERT_RESPONSE_EVENT);
});
