'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Parser = require('@apidevtools/swagger-parser');

const { createSchemaValidator } = require('../src/model/schema-validator');
const {
  generateExoplanetSystemBodies,
  getExoplanetNames,
  getExoplanetRegistryRecords,
  getExoplanetStarEntries,
  getExoplanetSystemSeedHash,
  getExoplanetSystems,
} = require('../src/model/exoplanet-catalog');
const {
  SOLAR_SYSTEM_CELESTIAL_SEED_VERSION,
  buildSeededCelestialBodiesForSolarSystem,
  getSolarSystemCelestialSeedVersion,
} = require('../src/model/solar-system-celestial-seed');
const {
  getSolarSystemById,
  getSolarSystemRegistry,
} = require('../src/model/solar-system-registry');
const {
  getStarCatalogEntries,
  getStarEntryByHygId,
  getStarEntryByStarId,
} = require('../src/model/star-catalog');
const { buildSeededMarketsForSolarSystem } = require('../src/model/solar-system-market-seed');
const {
  getSolarSystemCelestialSeedState,
  setSolarSystemCelestialSeedState,
} = require('../src/db/service/celestial-seed-state-service');
const { syncCatalogCollection } = require('../src/db/service/catalog-sync-service');
const {
  SolarSystemGetMessageHandler,
} = require('../src/handlers/solar-system-get-message-handler');
const { StarGetMessageHandler } = require('../src/handlers/star-get-message-handler');
const { StarListMessageHandler } = require('../src/handlers/star-list-message-handler');
const {
  createMockSocket,
  createTestContext,
  seedPlayer,
} = require('../test-support/message-handler-test-helpers');

const ROOT = path.resolve(__dirname, '..');
const planets = require('../data/exoplanet-planets.json').records;

let contractPromise = null;
function responseSchema(operationPath) {
  contractPromise ||= Parser.dereference(path.join(ROOT, 'api', 'openapi.yaml'));
  return contractPromise.then(
    (contract) =>
      contract.paths[operationPath].post.responses['200'].content['application/json'].schema
  );
}

function assertValid(schema, value, label) {
  const validate = createSchemaValidator({ allErrors: true }).compile(schema);
  assert.equal(validate(value), true, `${label}: ${JSON.stringify(validate.errors)}`);
}

function playerContext() {
  const context = createTestContext();
  seedPlayer(context, { playerName: 'PilotOne', sessionKey: 'session-1' });
  return context;
}

test('EX-5.4a names file keys resolve to catalog ids and the importer never writes it', () => {
  const names = getExoplanetNames();
  const planetIds = new Set(planets.map((planet) => planet.id));
  const systemIds = new Set(getExoplanetSystems().map((system) => system.id));
  const starIds = new Set(
    getExoplanetSystems().flatMap((system) => system.stars.map((star) => star.starId))
  );
  for (const planetId of Object.keys(names.planets)) {
    assert.ok(planetIds.has(planetId), `unknown planet ${planetId}`);
  }
  for (const systemId of Object.keys(names.systems)) {
    assert.ok(systemIds.has(systemId), `unknown system ${systemId}`);
  }
  for (const starId of Object.keys(names.stars)) {
    assert.ok(starIds.has(starId), `unknown star ${starId}`);
  }
  // The refresh report may read the names file to flag orphaned keys; no script may write it.
  const readOnlyConsumers = new Set(['exoplanet-refresh-report.js']);
  for (const script of fs.readdirSync(path.join(ROOT, 'scripts'), { recursive: true })) {
    if (!String(script).endsWith('.js')) continue;
    const text = fs.readFileSync(path.join(ROOT, 'scripts', script), 'utf8');
    if (readOnlyConsumers.has(String(script))) {
      assert.ok(!/write\w*\([^)]*NAMES/i.test(text), `${script} must not write the names file`);
      continue;
    }
    assert.ok(!text.includes('exoplanet-names'), `${script} must not touch the names file`);
  }
});

test('EX-5.4a game names take precedence over catalog names', () => {
  const bodies = generateExoplanetSystemBodies('exo-55-cnc');
  const byId = new Map(bodies.planets.map((body) => [body.id, body]));
  assert.equal(byId.get('exo-55-cnc-b').displayName, 'Galileo');
  assert.equal(byId.get('exo-55-cnc-b').catalogName, '55 Cnc b');
  assert.equal(getSolarSystemById('exo-55-cnc').displayName, 'Copernicus');
  assert.equal(getSolarSystemById('exo-55-cnc').catalogName, '55 Cnc');
});

test('EX-5.1 registry includes every exoplanet system once, merged with existing systems', () => {
  const registry = getSolarSystemRegistry();
  const ids = registry.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length);
  const existing = getExoplanetSystems().filter((system) => system.existing);
  assert.deepEqual(existing.map((system) => system.id).sort(), [
    'alpha-centauri',
    'barnards-star',
    'lalande-21185',
  ]);
  assert.equal(
    registry.filter((entry) => entry.source === 'exoplanet-catalog').length,
    getExoplanetSystems().length - existing.length
  );
  assert.equal(getExoplanetRegistryRecords().length, getExoplanetSystems().length - 3);

  const barnard = getSolarSystemById('barnards-star');
  assert.equal(barnard.source, 'procedural');
  assert.equal(barnard.planetCount, 4);
  assert.equal(barnard.primaryStar.starId, 'barnards-star-star-primary');
  assert.equal(getSolarSystemById('sol').primaryStar.starId, 'sol-sun');

  const planetTotal = registry
    .filter((entry) => entry.source === 'exoplanet-catalog')
    .reduce((sum, entry) => sum + entry.planetCount, 0);
  // Every archive planet except the six on existing systems (Barnard 4, Lalande 2)
  // and the two Proxima planets the curated catalog keeps (D46).
  assert.equal(planetTotal, planets.length - 8);
});

test('EX-5.2 D45 Barnard and Lalande keep procedural stars with archive planets', () => {
  const bodies = buildSeededCelestialBodiesForSolarSystem('barnards-star');
  assert.deepEqual(
    bodies.map((body) => body.id),
    [
      'barnards-star-star-primary',
      'exo-barnard-b',
      'exo-barnard-c',
      'exo-barnard-d',
      'exo-barnard-e',
    ]
  );
  for (const planet of bodies.filter((body) => body.bodyType === 'planet')) {
    assert.equal(planet.parentBodyId, 'barnards-star-star-primary');
    assert.equal(planet.catalogSource, 'exoplanet-catalog');
    assert.equal(planet.spatial.solarSystemId, 'barnards-star');
  }
  const lalande = buildSeededCelestialBodiesForSolarSystem('lalande-21185');
  assert.equal(lalande.filter((body) => body.bodyType === 'planet').length, 2);
  assert.ok(lalande.every((body) => !/-planet-\d/.test(body.id)));

  const market = buildSeededMarketsForSolarSystem('barnards-star').find(
    (entry) => entry.marketId === 'bs-main-station'
  );
  assert.equal(market.trajectory.orbit.anchorBodyId, 'exo-barnard-b');
});

test('EX-5.2 D46 curated Alpha Centauri wins and tags Proxima b and d', () => {
  const bodies = buildSeededCelestialBodiesForSolarSystem('alpha-centauri');
  assert.ok(bodies.every((body) => !body.id.startsWith('exo-')));
  const proximaB = bodies.find((body) => body.id === 'alpha-centauri-proxima-b');
  assert.equal(proximaB.catalogSource, 'exoplanet-catalog');
  assert.deepEqual(proximaB.catalogIds, {
    planetId: 'exo-proxima-cen-b',
    hostId: 'exo-host-proxima-cen',
  });
  const proximaC = bodies.find((body) => body.id === 'alpha-centauri-proxima-c');
  assert.equal(proximaC.catalogSource, undefined);
});

test('EX-5.2 exoplanet systems seed deterministically with catalog provenance', () => {
  const first = buildSeededCelestialBodiesForSolarSystem('exo-55-cnc');
  const second = buildSeededCelestialBodiesForSolarSystem('exo-55-cnc');
  assert.deepEqual(first, second);
  assert.equal(first.filter((body) => body.bodyType === 'star').length, 2);
  assert.equal(first.filter((body) => body.bodyType === 'planet').length, 7);
  for (const body of first) {
    assert.equal(body.catalogSource, 'exoplanet-catalog');
    assert.ok(body.catalogIds);
    assert.ok(Number.isFinite(body.spatial.positionKm.x));
  }
  assert.deepEqual(buildSeededCelestialBodiesForSolarSystem('exo-unknown'), []);
});

test('EX-5.2 D48 seed version is per system for catalog-fed systems', () => {
  assert.equal(getSolarSystemCelestialSeedVersion('sol'), SOLAR_SYSTEM_CELESTIAL_SEED_VERSION);
  assert.equal(
    getSolarSystemCelestialSeedVersion('alpha-centauri'),
    SOLAR_SYSTEM_CELESTIAL_SEED_VERSION
  );
  assert.equal(getSolarSystemCelestialSeedVersion('sirius'), SOLAR_SYSTEM_CELESTIAL_SEED_VERSION);
  const cnc = getSolarSystemCelestialSeedVersion('exo-55-cnc');
  assert.equal(
    cnc,
    `${SOLAR_SYSTEM_CELESTIAL_SEED_VERSION}-exo-${getExoplanetSystemSeedHash('exo-55-cnc')}`
  );
  assert.notEqual(cnc, getSolarSystemCelestialSeedVersion('exo-51-peg'));
  assert.match(getSolarSystemCelestialSeedVersion('barnards-star'), /-exo-[0-9a-f]{12}$/);
});

test('EX-5.3 D48 seed state is one game-state document per system', async () => {
  const documents = new Map();
  const GameStateDocument = {
    findOne: ({ key }) => ({ lean: async () => documents.get(key) || null }),
    findOneAndUpdate: (filter, update) => ({
      lean: async () => {
        documents.set(filter.key, update);
        return update;
      },
    }),
  };
  const ctx = {
    toNonEmptyString: (value) => (typeof value === 'string' ? value.trim() : ''),
    log: () => {},
  };
  await setSolarSystemCelestialSeedState(ctx, GameStateDocument, 'Exo-55-Cnc', 'v1', 't1');
  await setSolarSystemCelestialSeedState(ctx, GameStateDocument, 'sol', 'v2', 't2');
  assert.deepEqual([...documents.keys()].sort(), [
    'solar-system-celestial-seed-state:exo-55-cnc',
    'solar-system-celestial-seed-state:sol',
  ]);
  assert.deepEqual(await getSolarSystemCelestialSeedState(ctx, GameStateDocument, 'exo-55-cnc'), {
    solarSystemId: 'exo-55-cnc',
    seedVersion: 'v1',
    seededAt: 't1',
  });
  assert.equal(await getSolarSystemCelestialSeedState(ctx, GameStateDocument, 'sirius'), null);
});

test('EX-5.3 D49 catalog sync bulk-writes once and skips an unchanged catalog', async () => {
  const writes = [];
  const deletes = [];
  const state = new Map();
  const Model = {
    bulkWrite: async (operations) => writes.push(operations.length),
    deleteMany: async (filter) => {
      deletes.push(filter);
      return { deletedCount: 1 };
    },
  };
  const GameStateDocument = {
    findOne: ({ key }) => ({ lean: async () => state.get(key) || null }),
    findOneAndUpdate: async (filter, update) => state.set(filter.key, update),
  };
  const ctx = { log: () => {} };
  const records = Array.from({ length: 2500 }, (_, index) => ({ starId: `s-${index}` }));
  const options = { stateKey: 'star-catalog-sync-state', keyField: 'starId', records };

  const first = await syncCatalogCollection(ctx, Model, GameStateDocument, options);
  assert.equal(first.skipped, false);
  assert.equal(first.upserted, 2500);
  assert.equal(first.removed, 1);
  assert.deepEqual(writes, [1000, 1000, 500]);
  assert.equal(deletes[0].starId.$nin.length, 2500);

  const second = await syncCatalogCollection(ctx, Model, GameStateDocument, options);
  assert.equal(second.skipped, true);
  assert.equal(writes.length, 3);
});

test('EX-5.5 D50 D54 star catalog has unique starIds across HYG and exoplanet stars', () => {
  const entries = getStarCatalogEntries();
  const ids = entries.map((entry) => entry.starId);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(getStarEntryByStarId('sol-sun').hygId, '0');
  assert.equal(getStarEntryByHygId('87937').starId, 'barnards-star-star-primary');
  assert.equal(getStarEntryByHygId('87937').catalogSource, 'hyg');
  const exoplanetEntries = getExoplanetStarEntries();
  assert.ok(exoplanetEntries.length > getExoplanetRegistryRecords().length);
  assert.ok(exoplanetEntries.every((entry) => entry.catalogSource === 'exoplanet-catalog'));
  assert.ok(
    exoplanetEntries.every(
      (entry) => !entry.systemId.match(/^(barnards-star|lalande-21185|alpha-centauri)$/)
    )
  );
  const synthesized = getStarEntryByStarId('exo-11-com-star-b');
  assert.equal(synthesized.hygId, null);
  assert.equal(synthesized.approximate, true);
});

test('EX-5.5 star-get finds stars by starId or hygId and the entries match the schema', async () => {
  const context = playerContext();
  const handler = new StarGetMessageHandler(context);
  const schema = (await responseSchema('/socket/star-get')).properties.star;

  const byStarId = await handler.handle(createMockSocket(), {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    starId: 'exo-11-com-star-b',
  });
  assert.equal(byStarId.success, true);
  assert.equal(byStarId.starId, 'exo-11-com-star-b');
  assert.equal(byStarId.hygId, '');
  assertValid(schema, byStarId.star, 'synthesized star');

  const byHygId = await handler.handle(createMockSocket(), {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    hygId: '87937',
  });
  assert.equal(byHygId.success, true);
  assert.equal(byHygId.starId, 'barnards-star-star-primary');
  assertValid(schema, byHygId.star, 'HYG star');

  const missing = await handler.handle(createMockSocket(), {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
  });
  assert.equal(missing.success, false);
  assert.match(missing.message, /starId or hygId/);

  for (const entry of getExoplanetStarEntries().slice(0, 400)) {
    assertValid(schema, entry, entry.starId);
  }
});

test('EX-5.5 star-list includes exoplanet-catalog stars', async () => {
  const context = playerContext();
  const response = await new StarListMessageHandler(context).handle(createMockSocket(), {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    systemId: 'exo-55-cnc',
  });
  assert.equal(response.success, true);
  assert.deepEqual(response.stars.map((star) => star.starId).sort(), [
    'exo-star-55-cnc',
    'exo-star-55-cnc-b',
  ]);
});

test('EX-5.6 solar-system-get serves an exoplanet multi-star system that matches the schema', async () => {
  const context = playerContext();
  const response = await new SolarSystemGetMessageHandler(context).handle(createMockSocket(), {
    playerName: 'PilotOne',
    sessionKey: 'session-1',
    solarSystemId: 'exo-55-cnc',
  });
  assert.equal(response.success, true);
  assert.equal(response.solarSystem.source, 'exoplanet-catalog');
  assert.equal(response.stars.length, 2);
  assert.equal(response.bodies.filter((body) => body.bodyType === 'planet').length, 7);
  const galileo = response.bodies.find((body) => body.id === 'exo-55-cnc-b');
  assert.equal(galileo.displayName, 'Galileo');
  assert.equal(galileo.catalogSource, 'exoplanet-catalog');
  assert.ok(Array.isArray(galileo.approximateFields));

  const schema = await responseSchema('/socket/solar-system-get');
  assertValid(schema.properties.solarSystem, response.solarSystem, 'solarSystem');
  for (const body of response.bodies) {
    assertValid(schema.properties.bodies.items, body, body.id);
  }
});

test('EX-5.6 solar-system-get serves curated and existing systems unchanged in shape', async () => {
  const context = playerContext();
  const schema = await responseSchema('/socket/solar-system-get');
  for (const solarSystemId of ['alpha-centauri', 'barnards-star']) {
    const response = await new SolarSystemGetMessageHandler(context).handle(createMockSocket(), {
      playerName: 'PilotOne',
      sessionKey: 'session-1',
      solarSystemId,
    });
    assert.equal(response.success, true, solarSystemId);
    assertValid(schema.properties.solarSystem, response.solarSystem, solarSystemId);
    for (const body of response.bodies) {
      assertValid(schema.properties.bodies.items, body, body.id);
    }
  }
});
