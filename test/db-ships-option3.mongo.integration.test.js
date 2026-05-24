'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createMongoTestHarness } = require('../test-support/mongodb-test-helpers');

let mongoHarness = null;

function createOwnership(overrides = {}) {
  return {
    ownerType: 'player-character',
    playerId: 'player-1',
    characterId: 'character-1',
    npcId: null,
    factionId: null,
    ...overrides,
  };
}

function createShipRecord(overrides = {}) {
  return {
    id: 'ship-1',
    shipName: 'Scavenger Pod',
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

test.before(async () => {
  mongoHarness = await createMongoTestHarness();
});

test.after(async () => {
  if (mongoHarness) {
    await mongoHarness.teardown();
  }
});

test.beforeEach(async () => {
  await mongoHarness.clearDatabase();
});

test('Option3 DB contract: ship repository methods are available on DatabaseService', async () => {
  const service = mongoHarness.databaseService;

  assert.equal(typeof service.createShip, 'function');
  assert.equal(typeof service.getShipById, 'function');
  assert.equal(typeof service.updateShip, 'function');
  assert.equal(typeof service.deleteShip, 'function');
  assert.equal(typeof service.listShipsByOwner, 'function');
  assert.equal(typeof service.transferShipOwnership, 'function');
});

test('Option3 DB behavior: create/read supports npc, unowned, and unknown ownership states', async () => {
  const service = mongoHarness.databaseService;

  await service.createShip(
    createShipRecord({
      id: 'ship-player',
      ownership: createOwnership({ ownerType: 'player-character' }),
    })
  );

  await service.createShip(
    createShipRecord({
      id: 'ship-npc',
      ownership: createOwnership({
        ownerType: 'npc-pirate',
        playerId: null,
        characterId: null,
        npcId: 'npc-black-flag-1',
        factionId: 'pirates',
      }),
    })
  );

  await service.createShip(
    createShipRecord({
      id: 'ship-unowned',
      ownership: createOwnership({
        ownerType: 'unowned',
        playerId: null,
        characterId: null,
        npcId: null,
        factionId: null,
      }),
    })
  );

  await service.createShip(
    createShipRecord({
      id: 'ship-unknown',
      ownership: createOwnership({
        ownerType: 'unknown',
        playerId: null,
        characterId: null,
        npcId: null,
        factionId: null,
      }),
    })
  );

  const playerShip = await service.getShipById('ship-player');
  const npcShip = await service.getShipById('ship-npc');
  const unownedShip = await service.getShipById('ship-unowned');
  const unknownShip = await service.getShipById('ship-unknown');

  assert.equal(playerShip.ownership.ownerType, 'player-character');
  assert.equal(npcShip.ownership.ownerType, 'npc-pirate');
  assert.equal(unownedShip.ownership.ownerType, 'unowned');
  assert.equal(unknownShip.ownership.ownerType, 'unknown');
});

test('Option3 DB negative: conflicting ownership fields are rejected', async () => {
  const service = mongoHarness.databaseService;

  await assert.rejects(
    service.createShip(
      createShipRecord({
        id: 'ship-conflict',
        ownership: {
          ownerType: 'npc-pirate',
          playerId: null,
          characterId: 'character-1',
          npcId: 'npc-1',
          factionId: 'pirates',
        },
      })
    ),
    /ownership/i
  );
});

test('Option3 DB negative: cross-player ownership transfer without authorization is rejected', async () => {
  const service = mongoHarness.databaseService;

  await service.createShip(
    createShipRecord({
      id: 'ship-transfer',
      ownership: createOwnership({
        ownerType: 'player-character',
        playerId: 'player-1',
        characterId: 'character-1',
      }),
    })
  );

  await assert.rejects(
    service.transferShipOwnership({
      shipId: 'ship-transfer',
      actorPlayerId: 'player-2',
      fromOwner: {
        ownerType: 'player-character',
        playerId: 'player-1',
        characterId: 'character-1',
      },
      toOwner: {
        ownerType: 'player-character',
        playerId: 'player-2',
        characterId: 'character-2',
      },
    }),
    /unauthorized|forbidden|ownership/i
  );
});

test('Option3 DB negative: dangling inventory references are rejected at write time', async () => {
  const service = mongoHarness.databaseService;

  await assert.rejects(
    service.createShip(
      createShipRecord({
        id: 'ship-dangling-items',
        inventory: [
          {
            itemId: 'missing-item-id',
            itemType: 'hull-patch-kit',
          },
        ],
      })
    ),
    /inventory|item/i
  );
});
