'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseService } = require('../src/db/service');
const { JumpGate } = require('../src/db/models');
const {
  createShip
} = require('../test-support/message-handler-test-helpers');
const {
  createMongoTestHarness
} = require('../test-support/mongodb-test-helpers');

let mongoHarness = null;

function createMarket(overrides = {}) {
  return {
    marketId: overrides.marketId || 'sol-test-market',
    solarSystemId: overrides.solarSystemId || 'sol',
    marketName: overrides.marketName || 'Test Exchange',
    siteType: 'station',
    siteName: 'Test Station',
    spatial: {
      solarSystemId: overrides.solarSystemId || 'sol',
      frame: 'barycentric',
      positionKm: { x: 10, y: 20, z: 30 },
      epochMs: 1713360000000
    },
    trajectory: {
      kind: 'orbital-elements',
      orbit: {
        anchorBodyId: 'sol',
        anchorBodyName: 'Sol',
        orbitType: 'elliptical',
        semiMajorAxisKm: 1000,
        eccentricity: 0,
        inclinationDeg: 0,
        longitudeOfAscendingNodeDeg: 0,
        argumentOfPeriapsisDeg: 0,
        meanAnomalyAtEpochDeg: 0,
        orbitalPeriodSec: 100,
        epoch: '2026-05-07T00:00:00.000Z'
      }
    },
    isStarterMarket: false,
    priceMultiplier: 1,
    driftPercentPerHour: 0,
    restockIntervalMinutes: 60,
    lastRestockAt: '2026-05-07T00:00:00.000Z',
    inventory: [],
    ledger: []
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

test('DatabaseService market seed-state round-trip normalizes system id and updates existing entry', async () => {
  const service = mongoHarness.databaseService;

  assert.equal(await service.getSolarSystemMarketSeedState('sol'), null);
  assert.equal(await service.getSolarSystemMarketSeedState(''), null);

  const created = await service.setSolarSystemMarketSeedState(
    'SoL',
    'seed-v1',
    '2026-05-07T00:00:00.000Z'
  );
  assert.ok(created);

  const firstRead = await service.getSolarSystemMarketSeedState('sol');
  assert.equal(firstRead.solarSystemId, 'sol');
  assert.equal(firstRead.seedVersion, 'seed-v1');

  await service.setSolarSystemMarketSeedState(
    'SOL',
    'seed-v2',
    '2026-05-07T01:00:00.000Z'
  );

  const secondRead = await service.getSolarSystemMarketSeedState('sOl');
  assert.equal(secondRead.seedVersion, 'seed-v2');
  assert.equal(secondRead.seededAt, '2026-05-07T01:00:00.000Z');
});

test('DatabaseService setSolarSystemMarketSeedState returns null for invalid inputs', async () => {
  const service = mongoHarness.databaseService;

  assert.equal(await service.setSolarSystemMarketSeedState('', 'seed-v1', '2026-05-07T00:00:00.000Z'), null);
  assert.equal(await service.setSolarSystemMarketSeedState('sol', '', '2026-05-07T00:00:00.000Z'), null);
  assert.equal(await service.setSolarSystemMarketSeedState('sol', 'seed-v1', ''), null);
});

test('DatabaseService upsertMarket/getMarkets supports invalid and filtered query branches', async () => {
  const service = mongoHarness.databaseService;

  assert.equal(await service.upsertMarket({ marketId: '', solarSystemId: 'sol' }), null);
  assert.equal(await service.upsertMarket({ marketId: 'm-1', solarSystemId: '' }), null);

  const inserted = await service.upsertMarket(createMarket({ marketId: 'sol-m1', solarSystemId: 'sol' }));
  assert.equal(inserted.marketId, 'sol-m1');

  await service.upsertMarket(createMarket({ marketId: 'ac-m1', solarSystemId: 'alpha-centauri' }));

  const allMarkets = await service.getMarkets();
  assert.equal(allMarkets.length, 2);

  const solMarkets = await service.getMarkets({ solarSystemId: 'sol' });
  assert.equal(solMarkets.length, 1);
  assert.equal(solMarkets[0].marketId, 'sol-m1');
});

test('DatabaseService addShip covers invalid playerName, missing player, missing character, and success', async () => {
  const service = mongoHarness.databaseService;

  assert.equal(await service.addShip('', 'character-1', createShip({ id: 'ship-1' })), null);
  assert.equal(await service.addShip('unknown-player', 'character-1', createShip({ id: 'ship-1' })), null);

  await service.registerPlayer({
    playerId: 'p-ship-1',
    playerName: 'ShipPilot',
    email: 'ship@example.com',
    password: 'secret'
  });

  assert.equal(await service.addShip('ShipPilot', 'missing-character', createShip({ id: 'ship-1' })), null);

  await service.addCharacter('ShipPilot', {
    id: 'character-1',
    characterName: 'Captain',
    createdAt: '2026-05-07T00:00:00.000Z',
    ships: [],
    missions: [],
    creditLedger: []
  });

  const updated = await service.addShip('ShipPilot', 'character-1', createShip({ id: 'ship-1' }));
  const character = updated.characters.find((entry) => entry.id === 'character-1');
  assert.equal(character.ships.length, 1);
  assert.equal(character.ships[0].id, 'ship-1');
});

test('DatabaseService mission methods cover invalid playerName, missing entities, add, replace, and list', async () => {
  const service = mongoHarness.databaseService;

  assert.equal(await service.addOrUpdateMission('', 'character-1', { missionId: 'm-1', status: 'available' }), null);
  assert.equal(await service.addOrUpdateMission('unknown-player', 'character-1', { missionId: 'm-1', status: 'available' }), null);

  await service.registerPlayer({
    playerId: 'p-mission-1',
    playerName: 'MissionPilot',
    email: 'mission@example.com',
    password: 'secret'
  });

  assert.equal(await service.addOrUpdateMission('MissionPilot', 'missing-character', { missionId: 'm-1', status: 'available' }), null);

  await service.addCharacter('MissionPilot', {
    id: 'character-1',
    characterName: 'Runner',
    createdAt: '2026-05-07T00:00:00.000Z',
    ships: [],
    missions: [],
    creditLedger: []
  });

  const added = await service.addOrUpdateMission('MissionPilot', 'character-1', {
    missionId: 'm-1',
    status: 'available',
    updatedAt: '2026-05-07T00:00:00.000Z'
  });
  const addedCharacter = added.characters.find((entry) => entry.id === 'character-1');
  assert.equal(addedCharacter.missions.length, 1);
  assert.equal(addedCharacter.missions[0].status, 'available');

  const replaced = await service.addOrUpdateMission('MissionPilot', 'character-1', {
    missionId: 'm-1',
    status: 'accepted',
    updatedAt: '2026-05-07T01:00:00.000Z'
  });
  const replacedCharacter = replaced.characters.find((entry) => entry.id === 'character-1');
  assert.equal(replacedCharacter.missions.length, 1);
  assert.equal(replacedCharacter.missions[0].status, 'accepted');

  assert.deepEqual(await service.getMissions('', 'character-1'), []);
  assert.deepEqual(await service.getMissions('unknown-player', 'character-1'), []);
  assert.deepEqual(await service.getMissions('MissionPilot', 'missing-character'), []);

  const listed = await service.getMissions('MissionPilot', 'character-1');
  assert.equal(listed.length, 1);
  assert.equal(listed[0].missionId, 'm-1');
});

test('DatabaseService getShips covers empty playerName, missing player, and missing character', async () => {
  const service = mongoHarness.databaseService;

  assert.deepEqual(await service.getShips('', 'character-1'), []);
  assert.deepEqual(await service.getShips('unknown-player', 'character-1'), []);

  await service.registerPlayer({
    playerId: 'p-ships-1',
    playerName: 'ShipsPilot',
    email: 'ships@example.com',
    password: 'secret'
  });

  assert.deepEqual(await service.getShips('ShipsPilot', 'missing-character'), []);
});

test('DatabaseService getJumpGatesAsync returns [] when in-memory fallback enabled', async () => {
  const service = new DatabaseService({ useInMemoryFallback: true });
  const gates = await service.getJumpGatesAsync();
  assert.deepEqual(gates, []);
});

test('DatabaseService getJumpGatesAsync catch path returns [] when JumpGate.find throws', async () => {
  const service = mongoHarness.databaseService;
  const originalFind = JumpGate.find;

  JumpGate.find = () => ({
    lean: async () => {
      throw new Error('forced jump-gate failure');
    }
  });

  try {
    const gates = await service.getJumpGatesAsync();
    assert.deepEqual(gates, []);
  } finally {
    JumpGate.find = originalFind;
  }
});
