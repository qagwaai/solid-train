'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createMongoTestHarness } = require('../test-support/mongodb-test-helpers');
const { universeBody } = require('../test-support/universe-metadata-test-helpers');
const { DatabaseService } = require('../src/db/service');
const { MessageHandlerContext } = require('../src/handlers/message-handler-context');
const {
  SolarSystemGetMessageHandler,
} = require('../src/handlers/solar-system-get-message-handler');
const { seedPlayer } = require('../test-support/message-handler-test-helpers');
const { renameCelestialSeed } = require('../src/model/celestial-seed-ownership');

let harness;
test.before(async () => {
  harness = await createMongoTestHarness();
});
test.after(async () => {
  if (harness) await harness.teardown();
});
test.beforeEach(async () => {
  await harness.clearDatabase();
});

test('typed metadata survives Mongo, fresh services and whole-system canonical reads', async () => {
  const body = universeBody();
  await harness.databaseService.addOrUpdateCelestialBody(body);
  const fresh = new DatabaseService();
  const stored = await fresh.getCelestialBodyById(body.id);
  assert.deepEqual(stored.universeMetadata, body.universeMetadata);
  const context = new MessageHandlerContext({ databaseService: fresh, log: () => {} });
  seedPlayer(context, { playerName: 'Pilot', characters: [] });
  const response = await new SolarSystemGetMessageHandler(context).buildResponse({
    playerName: 'Pilot',
    solarSystemId: 'alpha-centauri',
  });
  const returned = response.bodies.find((entry) => entry.id === body.id);
  assert.deepEqual(returned.universeMetadata, body.universeMetadata);
});

test('seed-owned Mongo updates preserve mined/scanned state and retirement history', async () => {
  const body = universeBody();
  const previous = {
    ...structuredClone(body),
    state: 'destroyed',
    destroyedAt: '2026-11-07T00:00:00.000Z',
    destroyedReason: 'mined',
    debrisSeed: 123,
    debris: [{ material: 'Iron', rarity: 'Common', quantity: 2, itemType: 'iron' }],
  };
  previous.universeMetadata.lifecycle = {
    status: 'retired',
    retiredAt: '2026-11-07T01:00:00.000Z',
    reason: 'policy revision',
  };
  await harness.databaseService.addOrUpdateCelestialBody(previous);
  const stored = await harness.databaseService.addOrUpdateCelestialBody(body, {
    preserveGameplay: true,
  });
  assert.equal(stored.state, 'destroyed');
  assert.equal(stored.destroyedReason, 'mined');
  assert.deepEqual(
    stored.debris.map(({ material, rarity, quantity, itemType }) => ({
      material,
      rarity,
      quantity,
      itemType,
    })),
    previous.debris
  );
  assert.equal(stored.universeMetadata.lifecycle.status, 'retired');
  await assert.rejects(
    () => harness.databaseService.addOrUpdateCelestialBody(body),
    /Retirement history/
  );
});

test('population hosts and canonical materials are validated before persistence', async () => {
  const body = universeBody();
  body.universeMetadata.population = {
    id: 'outer',
    kind: 'scattered-asteroids',
    hostBodyId: 'absent',
    abundance: 'sparse',
    estimatedTotalCount: null,
    policyVersion: 'v1',
  };
  await assert.rejects(
    () => harness.databaseService.addOrUpdateCelestialBody(body),
    /Unresolved population/
  );
  assert.equal(await harness.databaseService.getCelestialBodyById(body.id), null);
  delete body.universeMetadata.population;
  body.universeMetadata.resourceProfile.materialItemTypes = ['fictional-unknown-item'];
  await assert.rejects(
    () => harness.databaseService.addOrUpdateCelestialBody(body),
    /canonical raw-material/
  );
});

test('population descriptors, protected names and name-only updates survive canonical Mongo writes', async () => {
  const host = universeBody({
    id: 'host',
    displayName: 'Host',
    bodyType: 'star',
    surfaceArchetype: 'star',
  });
  delete host.universeMetadata.resourceProfile;
  await harness.databaseService.addOrUpdateCelestialBody(host);
  const body = universeBody();
  body.universeMetadata.population = {
    id: 'outer',
    kind: 'scattered-asteroids',
    hostBodyId: host.id,
    abundance: 'sparse',
    estimatedTotalCount: null,
    policyVersion: 'v1',
  };
  const stored = await harness.databaseService.addOrUpdateCelestialBody(body);
  assert.deepEqual(stored.universeMetadata.population, body.universeMetadata.population);
  const context = new MessageHandlerContext({ log: () => {} });
  const canonical = context.normalizeCelestialBody(stored);
  const renamed = renameCelestialSeed(canonical, {
    ...canonical.universeMetadata.naming,
    preferredName: 'Voyager',
    aliases: [body.displayName],
    lane: 'narrative',
    language: 'English',
    motivation: 'Later expedition',
  });
  const updated = await harness.databaseService.addOrUpdateCelestialBody(renamed);
  assert.equal(updated.id, body.id);
  assert.equal(updated.displayName, 'Voyager');
  assert.deepEqual(updated.spatial, stored.spatial);
  const protectedBody = context.normalizeCelestialBody(updated);
  protectedBody.universeMetadata.naming.lane = 'protected';
  await harness.databaseService.addOrUpdateCelestialBody(protectedBody);
  const seed = structuredClone(protectedBody);
  seed.displayName = 'Policy rename';
  seed.universeMetadata.naming.preferredName = seed.displayName;
  seed.universeMetadata.naming.lane = 'systematic';
  const preserved = await harness.databaseService.addOrUpdateCelestialBody(seed, {
    preserveGameplay: true,
  });
  assert.equal(preserved.displayName, 'Voyager');
  assert.equal(preserved.universeMetadata.naming.lane, 'protected');
  const legacyWrite = context.normalizeCelestialBody(preserved);
  delete legacyWrite.universeMetadata;
  assert.deepEqual(
    (await harness.databaseService.addOrUpdateCelestialBody(legacyWrite)).universeMetadata,
    preserved.universeMetadata
  );
});

test('force reseeding Alpha Centauri preserves persisted gameplay state without affecting Sol', async () => {
  const context = new MessageHandlerContext({
    databaseService: harness.databaseService,
    log: () => {},
  });
  const first = await context.seedSolarSystemCelestialBodiesAsync({
    solarSystemId: 'alpha-centauri',
  });
  assert.equal(first.source, 'database-upsert');
  const bodies = await harness.databaseService.getCelestialBodies({
    solarSystemId: 'alpha-centauri',
  });
  const planet = bodies.find((entry) => entry.bodyType === 'planet');
  await harness.databaseService.addOrUpdateCelestialBody({
    ...context.normalizeCelestialBody(planet),
    state: 'destroyed',
    destroyedAt: '2026-11-07T00:00:00.000Z',
    destroyedReason: 'test-history',
  });
  const second = await context.seedSolarSystemCelestialBodiesAsync({
    solarSystemId: 'alpha-centauri',
    force: true,
  });
  assert.equal(second.source, 'database-upsert');
  assert.equal((await harness.databaseService.getCelestialBodyById(planet.id)).state, 'destroyed');
  assert.equal(
    (await harness.databaseService.getCelestialBodies({ solarSystemId: 'sol' })).length,
    0
  );
});
