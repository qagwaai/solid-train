'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { SOLAR_SYSTEM_CELESTIAL_SEED_VERSION } = require('../src/model/solar-system-celestial-seed');
const { SOL_SYSTEM_CATALOG } = require('../src/model/sol-system-catalog');
const { createMongoTestHarness } = require('../test-support/mongodb-test-helpers');
const { MessageHandlerContext } = require('../src/handlers/message-handler-context');
const {
  SolarSystemGetMessageHandler,
} = require('../src/handlers/solar-system-get-message-handler');
const {
  CelestialBodyListMessageHandler,
} = require('../src/handlers/celestial-body-list-message-handler');
const { DatabaseService } = require('../src/db/service');
const {
  listAllCelestialBodies,
  seedPlayer,
} = require('../test-support/message-handler-test-helpers');

const SEED_TIMESTAMP = '2026-05-08T00:00:00.000Z';

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

test('seedSolarSystemCelestialBodiesAsync persists Sol catalog and is idempotent', async () => {
  const context = new MessageHandlerContext({
    databaseService: mongoHarness.databaseService,
    log: () => {},
  });

  const first = await context.seedSolarSystemCelestialBodiesAsync({ solarSystemId: 'sol' });
  assert.equal(first.success, true);
  assert.equal(first.solarSystemId, 'sol');
  assert.equal(first.seedVersion, SOLAR_SYSTEM_CELESTIAL_SEED_VERSION);
  assert.equal(first.bodyCount, SOL_SYSTEM_CATALOG.length);
  assert.equal(first.source, 'database-upsert');

  const persisted = await mongoHarness.databaseService.getCelestialBodies({ solarSystemId: 'sol' });
  assert.equal(persisted.length, SOL_SYSTEM_CATALOG.length);

  const earth = persisted.find((body) => body.id === 'sol-earth');
  assert.ok(earth);
  assert.equal(earth.bodyType, 'planet');
  assert.equal(earth.displayName, 'Earth');
  assert.equal(earth.isCatalogBody, true);
  assert.ok(earth.orbitalElements);
  assert.ok(earth.orbitalElements.semiMajorAxisKm > 0);

  // Re-running with the same version should hit database-cache path and not duplicate.
  const second = await context.seedSolarSystemCelestialBodiesAsync({ solarSystemId: 'sol' });
  assert.equal(second.success, true);
  assert.equal(second.source, 'database-cache');
  assert.equal(second.bodyCount, SOL_SYSTEM_CATALOG.length);

  const reloaded = await mongoHarness.databaseService.getCelestialBodies({ solarSystemId: 'sol' });
  assert.equal(reloaded.length, SOL_SYSTEM_CATALOG.length);
});

test('seeded appearance inputs round-trip through a fresh context and service', async () => {
  const createContext = (databaseService) => {
    const context = new MessageHandlerContext({
      databaseService,
      createId: () => 'unused-id',
      log: () => {},
    });
    seedPlayer(context, { playerName: 'PilotOne', characters: [] });
    return context;
  };
  const appearanceInputs = (body) => ({
    id: body.id,
    surfaceArchetype: body.surfaceArchetype,
    planetType: body.planetType ?? null,
    orbitalElements: body.orbitalElements ?? null,
    physicalCatalog: body.physicalCatalog ?? null,
    visualization: body.visualization ?? null,
  });

  const firstContext = createContext(mongoHarness.databaseService);
  const firstResponse = await new SolarSystemGetMessageHandler(firstContext).buildResponse({
    playerName: 'PilotOne',
    solarSystemId: 'sol',
    asOf: SEED_TIMESTAMP,
  });
  assert.equal(firstResponse.success, true);
  const originalEarth = firstResponse.bodies.find((body) => body.id === 'sol-earth');
  assert.ok(originalEarth);
  const originalAppearanceInputs = appearanceInputs(originalEarth);

  const freshContext = createContext(new DatabaseService());
  const getResponse = await new SolarSystemGetMessageHandler(freshContext).buildResponse({
    playerName: 'PilotOne',
    solarSystemId: 'sol',
  });
  assert.equal(getResponse.success, true);
  const earthFromGet = getResponse.bodies.find((body) => body.id === originalAppearanceInputs.id);
  assert.deepEqual(appearanceInputs(earthFromGet), originalAppearanceInputs);

  const listed = await listAllCelestialBodies(new CelestialBodyListMessageHandler(freshContext), {
    playerName: 'PilotOne',
    solarSystemId: 'sol',
  });
  const earthFromList = listed.find((body) => body.id === originalAppearanceInputs.id);
  assert.deepEqual(appearanceInputs(earthFromList), originalAppearanceInputs);
});
