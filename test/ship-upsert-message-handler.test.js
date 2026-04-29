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

function createDamageProfile(overrides = {}) {
  return {
    overallStatus: 'damaged',
    summary: 'Hull breach in sector 4',
    origin: 'combat',
    updatedAt: '2026-04-28T10:00:00.000Z',
    systems: [
      {
        code: 'hull',
        label: 'Hull Integrity',
        severity: 'major',
        summary: 'Breach detected',
        repairPriority: 1
      }
    ],
    ...overrides
  };
}

function seedShipPlayer(context) {
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
            createdAt: '2026-04-17T00:00:00.000Z'
          }
        ]
      }
    ]
  });
}

test('ShipUpsertMessageHandler persists status and damageProfile', async () => {
  const context = createTestContext();
  seedShipPlayer(context);

  const handler = new ShipUpsertMessageHandler(context);
  const socket = createMockSocket();
  const profile = createDamageProfile();

  const response = await handler.handle(socket, {
    playerName: 'ShipPilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
    ship: {
      id: 'ship-1',
      status: 'docked',
      damageProfile: profile
    }
  });

  assert.equal(response.success, true);
  assert.equal(response.ship.status, 'docked');
  assert.deepEqual(response.ship.damageProfile, {
    overallStatus: 'damaged',
    summary: 'Hull breach in sector 4',
    origin: 'combat',
    updatedAt: '2026-04-28T10:00:00.000Z',
    systems: [
      {
        code: 'hull',
        label: 'Hull Integrity',
        severity: 'major',
        summary: 'Breach detected',
        repairPriority: 1
      }
    ]
  });
  assert.equal(socket.events[0].eventName, SHIP_UPSERT_RESPONSE_EVENT);
});

test('ShipUpsertMessageHandler echoes persisted status and damageProfile in response', async () => {
  const context = createTestContext();
  seedShipPlayer(context);

  const handler = new ShipUpsertMessageHandler(context);
  const socket = createMockSocket();
  const profile = createDamageProfile();

  const response = await handler.handle(socket, {
    playerName: 'ShipPilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
    ship: { id: 'ship-1', status: 'in-flight', damageProfile: profile }
  });

  assert.equal(response.success, true);
  assert.equal(response.ship.status, 'in-flight');
  assert.equal(response.ship.damageProfile.overallStatus, 'damaged');
  assert.equal(response.ship.damageProfile.origin, 'combat');
  assert.equal(response.ship.damageProfile.systems.length, 1);
});

test('ShipUpsertMessageHandler ship-list returns persisted status and damageProfile', async () => {
  const { ShipListMessageHandler } = require('../src/handlers/ship-list-message-handler');
  const context = createTestContext();
  seedShipPlayer(context);

  const handler = new ShipUpsertMessageHandler(context);
  const listHandler = new ShipListMessageHandler(context);
  const socket = createMockSocket();
  const profile = createDamageProfile();

  await handler.handle(socket, {
    playerName: 'ShipPilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
    ship: { id: 'ship-1', status: 'docked', damageProfile: profile }
  });

  const listResponse = await listHandler.handle(createMockSocket(), {
    playerName: 'ShipPilot',
    characterId: 'character-1',
    sessionKey: 'session-1'
  });

  assert.equal(listResponse.success, true);
  assert.equal(listResponse.ships[0].status, 'docked');
  assert.equal(listResponse.ships[0].damageProfile.overallStatus, 'damaged');
});

test('ShipUpsertMessageHandler partial upsert without damageProfile preserves existing', async () => {
  const context = createTestContext();
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
            status: 'docked',
            damageProfile: createDamageProfile(),
            createdAt: '2026-04-17T00:00:00.000Z'
          }
        ]
      }
    ]
  });

  const handler = new ShipUpsertMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'ShipPilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
    ship: { id: 'ship-1', status: 'in-flight' }
  });

  assert.equal(response.success, true);
  assert.equal(response.ship.status, 'in-flight');
  assert.equal(response.ship.damageProfile.overallStatus, 'damaged');
});

test('ShipUpsertMessageHandler explicit damageProfile null clears stored profile', async () => {
  const context = createTestContext();
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
            damageProfile: createDamageProfile(),
            createdAt: '2026-04-17T00:00:00.000Z'
          }
        ]
      }
    ]
  });

  const handler = new ShipUpsertMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'ShipPilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
    ship: { id: 'ship-1', damageProfile: null }
  });

  assert.equal(response.success, true);
  assert.equal(response.ship.damageProfile, null);
});

test('ShipUpsertMessageHandler rejects invalid damageProfile with success false', async () => {
  const context = createTestContext();
  seedShipPlayer(context);

  const handler = new ShipUpsertMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'ShipPilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
    ship: {
      id: 'ship-1',
      damageProfile: {
        overallStatus: 'broken',
        summary: 'bad data',
        origin: 'combat',
        updatedAt: '2026-04-28T10:00:00.000Z',
        systems: []
      }
    }
  });

  assert.equal(response.success, false);
  assert.ok(response.message.includes('overallStatus'), `Expected message about overallStatus, got: ${response.message}`);
  assert.equal(socket.events[0].eventName, SHIP_UPSERT_RESPONSE_EVENT);
});

test('ShipUpsertMessageHandler rejects non-string status', async () => {
  const context = createTestContext();
  seedShipPlayer(context);

  const handler = new ShipUpsertMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'ShipPilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
    ship: { id: 'ship-1', status: 42 }
  });

  assert.equal(response.success, false);
  assert.ok(response.message.includes('status'), `Expected message about status, got: ${response.message}`);
  assert.equal(socket.events[0].eventName, SHIP_UPSERT_RESPONSE_EVENT);
});

test('ShipUpsertMessageHandler status and damageProfile only update does not require location', async () => {
  const context = createTestContext();
  seedShipPlayer(context);

  const handler = new ShipUpsertMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'ShipPilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
    ship: { id: 'ship-1', status: 'docked', damageProfile: createDamageProfile() }
  });

  assert.equal(response.success, true);
  assert.equal(response.ship.status, 'docked');
});

