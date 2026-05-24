'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { ShipListMessageHandler } = require('../src/handlers/ship-list-message-handler');
const { ShipUpsertMessageHandler } = require('../src/handlers/ship-upsert-message-handler');
const {
  createMockSocket,
  createTestContext,
  seedPlayer,
} = require('../test-support/message-handler-test-helpers');

function createOwnership(overrides = {}) {
  return {
    ownerType: 'player-character',
    playerId: 'player-seeded',
    characterId: 'character-1',
    npcId: null,
    factionId: null,
    ...overrides,
  };
}

function createShipWithOwnership(overrides = {}) {
  return {
    id: 'ship-1',
    shipName: 'Scout Ship',
    model: 'Scavenger Pod',
    tier: 1,
    createdAt: '2026-05-24T00:00:00.000Z',
    inventory: [],
    spatial: {
      solarSystemId: 'sol',
      frame: 'barycentric',
      positionKm: { x: 0, y: 0, z: 0 },
      epochMs: 1713360000000,
    },
    launchable: true,
    damageProfile: null,
    ownership: createOwnership(),
    ...overrides,
  };
}

test('Option3 strict cutover: ship-upsert rejects legacy ship payload without ownership metadata', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'CompatPilot',
    playerId: 'player-seeded',
    sessionKey: 'session-1',
    characters: [
      {
        id: 'character-1',
        characterName: 'LegacyCaptain',
        ships: [
          {
            id: 'ship-1',
            shipName: 'Legacy Scout',
            model: 'Scavenger Pod',
            tier: 1,
            createdAt: '2026-05-24T00:00:00.000Z',
            inventory: [],
            spatial: {
              solarSystemId: 'sol',
              frame: 'barycentric',
              positionKm: { x: 0, y: 0, z: 0 },
              epochMs: 1713360000000,
            },
            launchable: true,
            damageProfile: null,
          },
        ],
      },
    ],
  });

  const handler = new ShipUpsertMessageHandler(context);
  const response = await handler.handle(createMockSocket(), {
    playerName: 'CompatPilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
    ship: {
      id: 'ship-1',
      model: 'Scavenger Pod',
    },
  });

  assert.deepEqual(response, {
    success: false,
    reason: 'OWNERSHIP_VALIDATION_FAILED',
    message: 'ship.ownership is required',
    playerName: 'CompatPilot',
    characterId: 'character-1',
  });
});

test('Option3 contract: ship-list returns strict ownership metadata for character-owned ship', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'OwnerPilot',
    playerId: 'player-seeded',
    sessionKey: 'session-1',
    characters: [
      {
        id: 'character-1',
        characterName: 'OwnerOne',
        ships: [createShipWithOwnership()],
      },
    ],
  });

  const handler = new ShipListMessageHandler(context);
  const response = await handler.handle(createMockSocket(), {
    playerName: 'OwnerPilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
  });

  assert.equal(response.success, true);
  assert.deepEqual(response.ships[0].ownership, {
    ownerType: 'player-character',
    playerId: 'player-seeded',
    characterId: 'character-1',
    npcId: null,
    factionId: null,
  });
});

test('Option3 negative: ship-upsert rejects ownership payload missing discriminator fields', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'NpcPilot',
    playerId: 'player-seeded',
    sessionKey: 'session-1',
    characters: [
      {
        id: 'character-1',
        characterName: 'OwnerOne',
        ships: [createShipWithOwnership()],
      },
    ],
  });

  const handler = new ShipUpsertMessageHandler(context);
  const response = await handler.handle(createMockSocket(), {
    playerName: 'NpcPilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
    ship: {
      id: 'ship-1',
      model: 'Reaver Hauler',
      ownership: {
        ownerType: 'npc-pirate',
      },
    },
  });

  assert.deepEqual(response, {
    success: false,
    reason: 'OWNERSHIP_VALIDATION_FAILED',
    message: 'ship.ownership.npcId is required when ownerType is npc-pirate',
    playerName: 'NpcPilot',
    characterId: 'character-1',
  });
});

test('Option3 negative: ship-upsert rejects conflicting owner fields', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'ConflictPilot',
    playerId: 'player-seeded',
    sessionKey: 'session-1',
    characters: [
      {
        id: 'character-1',
        characterName: 'OwnerOne',
        ships: [createShipWithOwnership()],
      },
    ],
  });

  const handler = new ShipUpsertMessageHandler(context);
  const response = await handler.handle(createMockSocket(), {
    playerName: 'ConflictPilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
    ship: {
      id: 'ship-1',
      model: 'Reaver Hauler',
      ownership: {
        ownerType: 'npc-pirate',
        npcId: 'npc-pirate-9',
        characterId: 'character-1',
      },
    },
  });

  assert.deepEqual(response, {
    success: false,
    reason: 'OWNERSHIP_CONFLICT',
    message: 'ship.ownership must not include characterId when ownerType is npc-pirate',
    playerName: 'ConflictPilot',
    characterId: 'character-1',
  });
});

test('Option3 negative: ship-upsert blocks cross-player ship hijack attempts with explicit reason', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'PlayerOne',
    playerId: 'player-1',
    sessionKey: 'session-1',
    characters: [
      {
        id: 'character-1',
        characterName: 'OwnerOne',
        ships: [createShipWithOwnership({ id: 'ship-a' })],
      },
    ],
  });
  seedPlayer(context, {
    playerName: 'PlayerTwo',
    playerId: 'player-2',
    sessionKey: 'session-2',
    characters: [
      {
        id: 'character-2',
        characterName: 'Intruder',
        ships: [
          createShipWithOwnership({
            id: 'ship-b',
            ownership: createOwnership({ playerId: 'player-2', characterId: 'character-2' }),
          }),
        ],
      },
    ],
  });

  const handler = new ShipUpsertMessageHandler(context);
  const response = await handler.handle(createMockSocket(), {
    playerName: 'PlayerTwo',
    characterId: 'character-2',
    sessionKey: 'session-2',
    ship: {
      id: 'ship-a',
      model: 'Hijacker Mk2',
      ownership: {
        ownerType: 'player-character',
        playerId: 'player-2',
        characterId: 'character-2',
      },
    },
  });

  assert.deepEqual(response, {
    success: false,
    reason: 'SHIP_OWNERSHIP_MISMATCH',
    message: 'Ship ownership mismatch for requested mutation',
    playerName: 'PlayerTwo',
    characterId: 'character-2',
  });
});

test('Option3 negative: illegal ownership transition unknown -> player-character requires explicit claim token', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'UnknownPilot',
    playerId: 'player-seeded',
    sessionKey: 'session-1',
    characters: [
      {
        id: 'character-1',
        characterName: 'Claimant',
        ships: [
          createShipWithOwnership({
            ownership: {
              ownerType: 'unknown',
              playerId: null,
              characterId: null,
              npcId: null,
              factionId: null,
            },
          }),
        ],
      },
    ],
  });

  const handler = new ShipUpsertMessageHandler(context);
  const response = await handler.handle(createMockSocket(), {
    playerName: 'UnknownPilot',
    characterId: 'character-1',
    sessionKey: 'session-1',
    ship: {
      id: 'ship-1',
      model: 'Recovered Scout',
      ownership: {
        ownerType: 'player-character',
        playerId: 'player-seeded',
        characterId: 'character-1',
      },
    },
  });

  assert.deepEqual(response, {
    success: false,
    reason: 'OWNERSHIP_CLAIM_TOKEN_REQUIRED',
    message: 'Ownership transition unknown -> player-character requires claimToken',
    playerName: 'UnknownPilot',
    characterId: 'character-1',
  });
});
