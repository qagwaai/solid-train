'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createMongoTestHarness
} = require('../test-support/mongodb-test-helpers');
const {
  createCelestialBody
} = require('../test-support/message-handler-test-helpers');

let mongoHarness = null;

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

test('Celestial bodies Mongo round-trip: upsert, read, query, update, and delete', async () => {
  const service = mongoHarness.databaseService;

  const created = await service.addOrUpdateCelestialBody(createCelestialBody({
    id: 'cb-1',
    sourceScanId: 'scan-1',
    createdByCharacterId: 'character-1',
    missionId: 'mission-1',
    spatial: {
      solarSystemId: 'sol',
      positionKm: { x: 1000, y: 2000, z: 3000 }
    }
  }));
  assert.equal(created.id, 'cb-1');

  const byId = await service.getCelestialBodyById('cb-1');
  assert.equal(byId.id, 'cb-1');

  const listed = await service.getCelestialBodies({
    createdByCharacterId: 'character-1',
    missionId: 'mission-1'
  });
  assert.equal(listed.length, 1);

  const nearby = await service.findCelestialBodiesNearPosition({
    solarSystemId: 'sol',
    positionKm: { x: 1000, y: 2000, z: 3000 },
    distanceKm: 10,
    createdByCharacterId: 'character-1',
    missionId: 'mission-1',
    stateValues: ['active']
  });
  assert.equal(nearby.length, 1);
  assert.equal(nearby[0].celestialBody.id, 'cb-1');

  const updated = await service.addOrUpdateCelestialBody(createCelestialBody({
    id: 'cb-1',
    sourceScanId: 'scan-1',
    createdByCharacterId: 'character-1',
    missionId: 'mission-1',
    state: 'destroyed',
    destroyedAt: '2026-05-07T00:20:00.000Z',
    destroyedReason: 'test-cleanup',
    spatial: {
      solarSystemId: 'sol',
      positionKm: { x: 1000, y: 2000, z: 3000 }
    }
  }));
  assert.equal(updated.state, 'destroyed');

  const deleted = await service.deleteCelestialBodyById('cb-1');
  assert.equal(deleted, true);

  const missing = await service.getCelestialBodyById('cb-1');
  assert.equal(missing, null);
});

test('Celestial bodies Mongo negative paths: invalid upsert key and invalid delete id', async () => {
  const service = mongoHarness.databaseService;

  await assert.rejects(
    service.addOrUpdateCelestialBody({
      sourceScanId: '',
      createdByCharacterId: '',
      missionId: ''
    }),
    /requires id or sourceScanId\+createdByCharacterId\+missionId/
  );

  assert.equal(await service.deleteCelestialBodyById(''), false);
  assert.deepEqual(await service.findCelestialBodiesNearPosition({
    solarSystemId: '',
    positionKm: { x: 0, y: 0, z: 0 },
    distanceKm: 1
  }), []);
});
