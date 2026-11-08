'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createMongoTestHarness } = require('../test-support/mongodb-test-helpers');
const { MessageHandlerContext } = require('../src/handlers/message-handler-context');
const { previewCopperValeP3 } = require('../src/model/non-sol-p3-preview');
const { previewCopperValeP4, resolveNamedBody } = require('../src/model/non-sol-p4-preview');
const {
  CelestialBodyListMessageHandler,
} = require('../src/handlers/celestial-body-list-message-handler');
const { seedPlayer, createMockSocket } = require('../test-support/message-handler-test-helpers');

let harness;
test.before(async () => {
  harness = await createMongoTestHarness();
});
test.after(async () => {
  if (harness) await harness.teardown();
});

test('isolated Mongo naming roundtrip preserves aliases, station anchors and mutable P3 state on reruns', async () => {
  const p3 = previewCopperValeP3();
  const p4 = previewCopperValeP4();
  const db = harness.databaseService;
  for (const body of [...p3.baseBodies, ...p3.generatedBodies])
    await db.addOrUpdateCelestialBody(body, { preserveGameplay: true });
  const hostId = p4.station.trajectory.orbit.anchorBodyId;
  const mutable = structuredClone(p3.generatedBodies.find((body) => body.id === hostId));
  mutable.state = 'destroyed';
  mutable.destroyedAt = '2026-11-07T00:00:00.000Z';
  mutable.destroyedReason = 'isolated test history';
  mutable.composition.material = 'iron';
  await db.addOrUpdateCelestialBody(mutable);
  const asteroid = p4.generatedBodies.find((body) => body.bodyType === 'asteroid');
  const savedAsteroid = structuredClone(asteroid);
  savedAsteroid.composition.material = 'carbon';
  savedAsteroid.observability.scanState = 'scanned';
  await db.addOrUpdateCelestialBody(savedAsteroid);

  const context = new MessageHandlerContext({
    databaseService: db,
    log: () => {},
    getCurrentTimestamp: () => p4.epoch,
  });
  const payload = context.createSeedMarketPayload(p4.station, p4.epoch);
  await db.upsertMarket(payload);
  const beforeStation = (await db.getMarkets({ solarSystemId: p4.systemId }))[0];
  beforeStation.priceMultiplier = 1.31;
  beforeStation.inventory[0].stock = 17;
  await db.upsertMarket(beforeStation);

  for (const body of p4.generatedBodies)
    await db.addOrUpdateCelestialBody(body, { preserveGameplay: true });
  const host = await db.getCelestialBodyById(hostId);
  assert.equal(host.displayName, 'Hearthward');
  assert.equal(host.universeMetadata.naming.preferredName, host.displayName);
  assert.equal(host.state, 'destroyed');
  assert.equal(host.destroyedAt, mutable.destroyedAt);
  assert.equal(host.composition.material, 'iron');
  assert.equal((await db.getCelestialBodyById(asteroid.id)).composition.material, 'carbon');
  assert.deepEqual(
    (await db.getCelestialBodyById(asteroid.id)).universeMetadata.resourceProfile,
    asteroid.universeMetadata.resourceProfile
  );

  const fresh = new MessageHandlerContext({
    databaseService: db,
    log: () => {},
    getCurrentTimestamp: () => p4.epoch,
  });
  const readHost = await fresh.getCelestialBodyByIdAsync(hostId);
  assert.equal(readHost.displayName, 'Hearthward');
  assert.deepEqual(readHost.universeMetadata.naming.aliases, host.universeMetadata.naming.aliases);
  const markets = await fresh.getMarketsAsync({ solarSystemId: p4.systemId, asOf: p4.epoch });
  const station = markets.find((entry) => entry.marketId === p4.station.marketId);
  assert.equal(station.trajectory.orbit.anchorBodyName, 'Hearthward');
  assert.deepEqual(station.spatial, p3.station.spatial);
  assert.equal(station.priceMultiplier, 1.31);
  assert.equal(station.inventory[0].stock, 17);

  const persisted = await db.getCelestialBodies({ solarSystemId: p4.systemId });
  for (const entry of p4.assignments) {
    assert.equal(resolveNamedBody(persisted, p4.systemId, entry.preferredName).id, entry.bodyId);
    for (const alias of entry.aliases)
      assert.equal(resolveNamedBody(persisted, p4.systemId, alias).id, entry.bodyId);
  }
  assert.equal(persisted.length, 57);
  seedPlayer(fresh, {
    playerName: 'NamingPilot',
    playerId: 'naming-pilot',
    sessionKey: 'naming-session',
  });
  const listing = await new CelestialBodyListMessageHandler(fresh).handle(createMockSocket(), {
    playerName: 'NamingPilot',
    sessionKey: 'naming-session',
    solarSystemId: p4.systemId,
    positionKm: { x: 0, y: 0, z: 0 },
    distanceKm: 2e10,
    limit: 100,
  });
  assert.equal(listing.success, true, listing.message);
  for (const entry of p4.assignments.filter((assignment) => assignment.bodyId !== hostId)) {
    const listed = listing.celestialBodies.find((body) => body.id === entry.bodyId);
    assert.ok(listed, `Missing named body in canonical list: ${entry.preferredName}`);
    assert.equal(listed.displayName, entry.preferredName);
    assert.deepEqual(listed.universeMetadata.naming.aliases, entry.aliases);
  }
});
