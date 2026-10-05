'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createMongoTestHarness } = require('../test-support/mongodb-test-helpers');
const { createCelestialBody, seedPlayer } = require('../test-support/message-handler-test-helpers');
const { createMockSocket } = require('../test-support/message-handler-test-helpers');
const { DatabaseService } = require('../src/db/service');
const { MongoConnection } = require('../src/db/connection');
const { SolarSystemGetMessageHandler } = require('../src/handlers/solar-system-get-message-handler');
const { CelestialBodyListMessageHandler } = require('../src/handlers/celestial-body-list-message-handler');
const { buildSeededCelestialBodiesForSolarSystem } = require('../src/model/solar-system-celestial-seed');
const { MessageHandlerContext } = require('../src/handlers/message-handler-context');
const {
  CelestialBodyUpsertMessageHandler,
} = require('../src/handlers/celestial-body-upsert-message-handler');

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

  const created = await service.addOrUpdateCelestialBody(
    createCelestialBody({
      id: 'cb-1',
      sourceScanId: 'scan-1',
      createdByCharacterId: 'character-1',
      missionId: 'mission-1',
      spatial: {
        solarSystemId: 'sol',
        positionKm: { x: 1000, y: 2000, z: 3000 },
      },
    })
  );
  assert.equal(created.id, 'cb-1');

  const byId = await service.getCelestialBodyById('cb-1');
  assert.equal(byId.id, 'cb-1');

  const listed = await service.getCelestialBodies({
    createdByCharacterId: 'character-1',
    missionId: 'mission-1',
  });
  assert.equal(listed.length, 1);

  const nearby = await service.findCelestialBodiesNearPosition({
    solarSystemId: 'sol',
    positionKm: { x: 1000, y: 2000, z: 3000 },
    distanceKm: 10,
    createdByCharacterId: 'character-1',
    missionId: 'mission-1',
    stateValues: ['active'],
  });
  assert.equal(nearby.length, 1);
  assert.equal(nearby[0].celestialBody.id, 'cb-1');

  const updated = await service.addOrUpdateCelestialBody(
    createCelestialBody({
      id: 'cb-1',
      sourceScanId: 'scan-1',
      createdByCharacterId: 'character-1',
      missionId: 'mission-1',
      state: 'destroyed',
      destroyedAt: '2026-05-07T00:20:00.000Z',
      destroyedReason: 'test-cleanup',
      spatial: {
        solarSystemId: 'sol',
        positionKm: { x: 1000, y: 2000, z: 3000 },
      },
    })
  );
  assert.equal(updated.state, 'destroyed');

  const deleted = await service.deleteCelestialBodyById('cb-1');
  assert.equal(deleted, true);

  const missing = await service.getCelestialBodyById('cb-1');
  assert.equal(missing, null);
});

test('celestial-body upsert persists required archetype and requested solar system', async () => {
  const context = new MessageHandlerContext({
    databaseService: new DatabaseService(),
    createId: () => 'unused-id',
    log: () => {},
  });
  seedPlayer(context, {
    playerName: 'PilotOne',
    characters: [{ id: 'character-1', characterName: 'Ranger' }],
  });
  const orbitalElements = {
    semiMajorAxisKm: 1000000,
    eccentricity: 0.01,
    inclinationDeg: 2,
    longitudeOfAscendingNodeDeg: 3,
    argumentOfPeriapsisDeg: 4,
    meanAnomalyAtEpochDeg: 5,
    orbitalPeriodSec: 60000,
    epoch: '2000-01-01T12:00:00.000Z',
    anchorBodyId: null,
  };
  const physicalCatalog = {
    massKg: 5e24,
    meanRadiusKm: 6000,
    rotationPeriodSec: 86400,
    compositionTags: ['silicate'],
  };
  const response = await new CelestialBodyUpsertMessageHandler(context).handle(createMockSocket(), {
    playerName: 'PilotOne',
    celestialBody: createCelestialBody({
      id: 'cb-appearance-roundtrip',
      createdByCharacterId: 'character-1',
      bodyType: 'planet',
      surfaceArchetype: 'rocky',
      planetType: 'rocky',
      spatial: { solarSystemId: 'alpha-centauri', positionKm: { x: 1, y: 2, z: 3 } },
      orbitalElements,
      physicalCatalog,
      visualization: { colorHex: '#987654', spectralClass: 'G' },
    }),
  });
  assert.equal(response.success, true);
  const persisted =
    await mongoHarness.databaseService.getCelestialBodyById('cb-appearance-roundtrip');
  assert.equal(persisted.spatial.solarSystemId, 'alpha-centauri');
  assert.equal(persisted.surfaceArchetype, 'rocky');
  assert.equal(persisted.planetType, 'rocky');
  assert.deepEqual(persisted.orbitalElements, orbitalElements);
  assert.equal(persisted.physicalCatalog.massKg, physicalCatalog.massKg);
  assert.deepEqual(persisted.physicalCatalog.compositionTags, physicalCatalog.compositionTags);
  assert.equal(persisted.visualization.colorHex, '#987654');
});

test('Celestial bodies Mongo negative paths: invalid upsert key and invalid delete id', async () => {
  const service = mongoHarness.databaseService;

  await assert.rejects(
    service.addOrUpdateCelestialBody({
      sourceScanId: '',
      createdByCharacterId: '',
      missionId: '',
      surfaceArchetype: 'asteroid',
    }),
    /requires id or sourceScanId\+createdByCharacterId\+missionId/
  );

  assert.equal(await service.deleteCelestialBodyById(''), false);

  const bodyWithoutArchetype = createCelestialBody({ id: 'cb-missing-archetype' });
  delete bodyWithoutArchetype.surfaceArchetype;
  await assert.rejects(service.addOrUpdateCelestialBody(bodyWithoutArchetype), /surfaceArchetype/);
  assert.deepEqual(
    await service.findCelestialBodiesNearPosition({
      solarSystemId: '',
      positionKm: { x: 0, y: 0, z: 0 },
      distanceKm: 1,
    }),
    []
  );
});

test('stellar source fields, identity, archetype and orbitals survive Mongo reconnection and fresh-context get/list', async (t) => {
  const createContext = () => {
    const context = new MessageHandlerContext({ databaseService: new DatabaseService(), log: () => {} });
    seedPlayer(context, { playerName: 'Pilot', characters: [{ id: 'system-catalog', characterName: 'Catalog' }] });
    return context;
  };
  const initial = createContext();
  const snapshots = new Map();
  for (const solarSystemId of ['sol', 'alpha-centauri', 'sirius']) {
    const result = await initial.seedSolarSystemCelestialBodiesAsync({
      solarSystemId, asOf: '2026-05-18T00:00:00.000Z',
    });
    assert.equal(result.source, 'database-upsert');
    snapshots.set(solarSystemId, await initial.getCelestialBodiesAsync({ solarSystemId }));
  }

  // Use a different service, different context, and actual disconnected/reconnected
  // Mongo connection. No in-memory context body can satisfy these assertions.
  await mongoHarness.mongoConnection.disconnect();
  const freshConnection = new MongoConnection({ mongoUri: mongoHarness.mongoServer.getUri() });
  await freshConnection.connect();
  let checked = 0;
  try {
    const fresh = createContext();
    assert.equal(fresh.celestialBodiesById.size, 0);
    for (const [solarSystemId, original] of snapshots) {
      const get = await new SolarSystemGetMessageHandler(fresh).buildResponse({
        playerName: 'Pilot', solarSystemId, asOf: '2030-01-01T00:00:00.000Z',
      });
      assert.equal(get.success, true);
      const list = await new CelestialBodyListMessageHandler(fresh).buildResponse({
        playerName: 'Pilot', solarSystemId,
      });
      assert.equal(list.success, true);
      const identityAndSource = (body) => ({
        id: body.id,
        bodyType: body.bodyType,
        surfaceArchetype: body.surfaceArchetype,
        spectralClass: body.spectralClass,
        luminositySolar: body.luminositySolar,
        orbitalElements: body.orbitalElements ?? null,
        spatial: body.spatial,
        physicalCatalog: body.physicalCatalog ?? null,
        physical: body.physical ?? null,
        visualization: body.visualization ?? null,
      });
      for (const body of original) {
        assert.deepEqual(identityAndSource(get.bodies.find((entry) => entry.id === body.id)), identityAndSource(body));
        assert.deepEqual(identityAndSource(list.celestialBodies.find((entry) => entry.id === body.id)), identityAndSource(body));
        checked += 1;
      }
      const seeded = buildSeededCelestialBodiesForSolarSystem(solarSystemId, '2026-05-18T00:00:00.000Z');
      for (const star of seeded.filter((entry) => entry.bodyType === 'star')) {
        const persistedStar = get.stars.find((entry) => entry.id === star.id);
        assert.ok(persistedStar, star.id);
        assert.equal(persistedStar.spectralClass, star.spectralClass);
        assert.equal(persistedStar.luminositySolar, star.luminositySolar);
      }
    }
  } finally {
    await freshConnection.disconnect();
    await mongoHarness.mongoConnection.connect();
  }
  t.diagnostic(`${checked} persisted bodies verified through reconnected get and list; companions included`);
});

test('canonical star upsert and unscanned composition persist without inferred fields', async () => {
  const context = new MessageHandlerContext({ databaseService: new DatabaseService(), log: () => {} });
  seedPlayer(context, { playerName: 'Pilot', characters: [{ id: 'char-1', characterName: 'Pilot' }] });
  const star = createCelestialBody({
    id: 'cb-source-star',
    bodyType: 'star',
    surfaceArchetype: 'star',
    spectralClass: 'K',
    luminositySolar: 0.5,
    visualization: { colorHex: '#ffd07a' },
    spatial: { solarSystemId: 'alpha-centauri', positionKm: { x: 10, y: 20, z: 30 } },
  });
  const response = await new CelestialBodyUpsertMessageHandler(context).handle(createMockSocket(), {
    playerName: 'Pilot', celestialBody: star,
  });
  assert.equal(response.success, true);
  await mongoHarness.mongoConnection.disconnect();
  await mongoHarness.mongoConnection.connect();
  const persisted = await new DatabaseService().getCelestialBodyById(star.id);
  assert.equal(persisted.bodyType, 'star');
  assert.equal(persisted.surfaceArchetype, 'star');
  assert.equal(persisted.spectralClass, 'K');
  assert.equal(persisted.luminositySolar, 0.5);
  assert.equal(persisted.visualization.colorHex, '#ffd07a');
  assert.deepEqual(persisted.spatial, star.spatial);

  const unscanned = createCelestialBody({ id: 'cb-unscanned', state: 'unscanned', composition: null });
  assert.equal((await new DatabaseService().addOrUpdateCelestialBody(unscanned)).composition, null);
  for (const field of ['bodyType', 'spatial', 'observability', 'state']) {
    const invalid = createCelestialBody({ id: `cb-invalid-${field}` });
    delete invalid[field];
    await assert.rejects(new DatabaseService().addOrUpdateCelestialBody(invalid));
    assert.equal(await new DatabaseService().getCelestialBodyById(invalid.id), null);
  }
});
