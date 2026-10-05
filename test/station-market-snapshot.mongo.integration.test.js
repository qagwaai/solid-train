'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createMongoTestHarness } = require('../test-support/mongodb-test-helpers');
const { MessageHandlerContext } = require('../src/handlers/message-handler-context');
const { DatabaseService } = require('../src/db/service');
const { buildSeededCelestialBodiesForSolarSystem } = require('../src/model/solar-system-celestial-seed');
const { buildSeededMarketsForSolarSystem, SOLAR_SYSTEM_MARKET_SEED_VERSION } = require('../src/model/solar-system-market-seed');
const { SolarSystemGetMessageHandler } = require('../src/handlers/solar-system-get-message-handler');
const { MarketListMessageHandler } = require('../src/handlers/market-list-message-handler');
const { MarketListByLocationMessageHandler } = require('../src/handlers/market-list-by-location-message-handler');
const { seedPlayer } = require('../test-support/message-handler-test-helpers');
const { computeRelativeOrbitPositionKm } = require('../src/handlers/context/orbital-math');

const EPOCH = '2026-03-04T05:06:07.000Z';
let harness;
test.before(async () => { harness = await createMongoTestHarness(); });
test.after(async () => { if (harness) await harness.teardown(); });
test.beforeEach(async () => {
  await harness.clearDatabase();
  for (const host of buildSeededCelestialBodiesForSolarSystem('sol', EPOCH)) {
    await harness.databaseService.addOrUpdateCelestialBody(host);
  }
});

function freshContext() {
  return new MessageHandlerContext({
    databaseService: new DatabaseService(), log: () => {},
    getCurrentTimestamp: () => '2030-01-01T00:00:00.000Z',
  });
}

test('isolated Mongo roundtrip and fresh service reads retain canonical host epochs without writes', async () => {
  const ctx = freshContext();
  const seeded = await ctx.seedSolarSystemMarketsAsync({ solarSystemId: 'sol', asOf: EPOCH });
  assert.equal(seeded.success, true);
  const before = await harness.databaseService.getMarkets({ solarSystemId: 'sol' });
  const persistedMoon = before.find((m) => m.marketId === 'sol-moon-orbit');
  assert.equal(persistedMoon.trajectory.orbit.anchorBodyId, 'sol-luna');
  assert.equal(persistedMoon.spatial.epochMs, Date.parse(EPOCH));
  const read = freshContext();
  const list = await read.getMarketsAsync({ solarSystemId: 'sol', asOf: EPOCH });
  const local = await read.getMarketsByLocationAsync({
    solarSystemId: 'sol', positionKm: { x: 0, y: 0, z: 0 }, distanceAu: 100,
    locationTypes: ['station'], asOf: '2030-01-01T00:00:00.000Z',
  });
  assert.deepEqual(list.find((m) => m.marketId === persistedMoon.marketId).spatial, persistedMoon.spatial);
  assert.deepEqual(local.find((m) => m.marketId === persistedMoon.marketId).spatial, persistedMoon.spatial);
  const seedRead = await read.seedSolarSystemMarketsAsync({ solarSystemId: 'sol' });
  assert.equal(seedRead.source, 'database-cache');
  assert.deepEqual(await harness.databaseService.getMarkets({ solarSystemId: 'sol' }), before);
});

test('old revision is blocked without writes; approved force repair preserves economy data and station ID', async () => {
  const ctx = freshContext();
  const seed = buildSeededMarketsForSolarSystem('sol', EPOCH).find((m) => m.marketId === 'sol-moon-orbit');
  const legacy = ctx.createSeedMarketPayload(seed, EPOCH);
  legacy.trajectory.orbit.anchorBodyId = 'sol-moon';
  legacy.inventory[0].stock = 7;
  legacy.ledger = [{
    transactionId: 'preserve-transaction', requestId: 'preserve-request',
    characterId: 'preserve-character', itemId: legacy.inventory[0].itemId,
    direction: 'buy', quantity: 1, unitPrice: 25, totalPrice: 25, timestamp: EPOCH,
  }];
  legacy.shipListings[0].status = 'sold';
  legacy.shipListings[0].quantityAvailable = 0;
  await harness.databaseService.upsertMarket(legacy);
  await harness.databaseService.setSolarSystemMarketSeedState('sol', '2026-05-sol-v1', EPOCH);
  const before = await harness.databaseService.getMarkets({ solarSystemId: 'sol' });
  const blocked = await ctx.seedSolarSystemMarketsAsync({ solarSystemId: 'sol' });
  assert.equal(blocked.success, false);
  assert.equal(blocked.reason, 'MARKET_SEED_REPAIR_REQUIRED');
  assert.deepEqual(await harness.databaseService.getMarkets({ solarSystemId: 'sol' }), before);
  await assert.rejects(freshContext().getMarketsAsync({ solarSystemId: 'sol' }), { code: 'MARKET_ANCHOR_UNRESOLVED' });

  const repaired = await ctx.seedSolarSystemMarketsAsync({ solarSystemId: 'sol', force: true, asOf: EPOCH });
  assert.equal(repaired.success, true);
  const after = (await harness.databaseService.getMarkets({ solarSystemId: 'sol' })).find((m) => m.marketId === legacy.marketId);
  assert.equal(after.trajectory.orbit.anchorBodyId, 'sol-luna');
  assert.equal(after.spatial.epochMs, Date.parse(EPOCH));
  assert.equal(String(after._id), String(before[0]._id));
  for (const field of ['inventory', 'ledger', 'shipListings', 'marketName', 'siteName', 'lastRestockAt']) {
    assert.deepEqual(after[field], before[0][field], `${field} must survive repair`);
  }
  assert.equal((await harness.databaseService.getSolarSystemMarketSeedState('sol')).seedVersion, SOLAR_SYSTEM_MARKET_SEED_VERSION);
  const repeated = freshContext();
  let writes = 0;
  repeated.databaseService.upsertMarket = async () => { writes++; throw new Error('unexpected write'); };
  assert.equal((await repeated.seedSolarSystemMarketsAsync({ solarSystemId: 'sol' })).source, 'database-cache');
  assert.equal(writes, 0);
});

test('invalid canonical host fails preflight with no market or seed-state writes', async () => {
  const ctx = freshContext();
  ctx.getCelestialBodyByIdAsync = async (id) => id === 'sol-luna'
    ? null : harness.databaseService.getCelestialBodyById(id);
  const failed = await ctx.seedSolarSystemMarketsAsync({ solarSystemId: 'sol', force: true });
  assert.equal(failed.success, false);
  assert.equal(failed.reason, 'MARKET_ANCHOR_UNRESOLVED');
  assert.equal((await harness.databaseService.getMarkets({ solarSystemId: 'sol' })).length, 0);
  assert.equal(await harness.databaseService.getSolarSystemMarketSeedState('sol'), null);
});

test('even current-revision persisted legacy anchors fail visibly without reseeding', async () => {
  const ctx = freshContext();
  const seed = buildSeededMarketsForSolarSystem('sol', EPOCH).find((m) => m.marketId === 'sol-moon-orbit');
  const legacy = ctx.createSeedMarketPayload(seed, EPOCH);
  legacy.trajectory.orbit.anchorBodyId = 'sol-moon';
  await harness.databaseService.upsertMarket(legacy);
  await harness.databaseService.setSolarSystemMarketSeedState('sol', SOLAR_SYSTEM_MARKET_SEED_VERSION, EPOCH);
  const before = await harness.databaseService.getMarkets({ solarSystemId: 'sol' });
  const result = await ctx.seedSolarSystemMarketsAsync({ solarSystemId: 'sol' });
  assert.equal(result.success, false);
  assert.equal(result.reason, 'MARKET_ANCHOR_UNRESOLVED');
  assert.deepEqual(await harness.databaseService.getMarkets({ solarSystemId: 'sol' }), before);
});

test('current seed metadata without persisted markets does not suppress an ordinary retry', async () => {
  const system = 'barnards-star';
  const ctx = freshContext();
  await harness.databaseService.setSolarSystemMarketSeedState(system, SOLAR_SYSTEM_MARKET_SEED_VERSION, EPOCH);
  assert.equal((await ctx.seedSolarSystemMarketsAsync({ solarSystemId: system })).reason, 'MARKET_ANCHOR_UNRESOLVED');
  assert.equal((await harness.databaseService.getMarkets({ solarSystemId: system })).length, 0);
  assert.equal((await ctx.seedSolarSystemCelestialBodiesAsync({ solarSystemId: system, asOf: EPOCH })).source, 'database-upsert');
  const retry = await ctx.seedSolarSystemMarketsAsync({ solarSystemId: system, asOf: EPOCH });
  assert.equal(retry.success, true);
  assert.equal(retry.source, 'database-upsert');
  assert.equal(retry.seedVersion, SOLAR_SYSTEM_MARKET_SEED_VERSION);
});

for (const [system, marketId, hostId, legacyId] of [
  ['alpha-centauri', 'ac-proxima-station', 'alpha-centauri-star-tertiary', 'ac-proxima'],
  ['barnards-star', 'bs-main-station', 'barnards-star-planet-1', 'bs-b1'],
]) {
  test(`${system}: cold persisted seed, failed-empty retry, fresh get/list/location/route shapes`, async () => {
    const ctx = freshContext();
    assert.equal((await harness.databaseService.getCelestialBodies({ solarSystemId: system })).length, 0);
    assert.equal(ctx.celestialBodiesById.size, 0);
    const failed = await ctx.seedSolarSystemMarketsAsync({ solarSystemId: system, asOf: EPOCH });
    assert.equal(failed.reason, 'MARKET_ANCHOR_UNRESOLVED');
    assert.equal((await harness.databaseService.getMarkets({ solarSystemId: system })).length, 0);
    assert.equal(await harness.databaseService.getSolarSystemMarketSeedState(system), null);
    assert.equal((await ctx.seedSolarSystemCelestialBodiesAsync({ solarSystemId: system, asOf: EPOCH })).source, 'database-upsert');
    // Same context retry: failures are not memoized, and no force/revision bump is needed.
    assert.equal((await ctx.seedSolarSystemMarketsAsync({ solarSystemId: system, asOf: EPOCH })).source, 'database-upsert');
    assert.equal((await harness.databaseService.getSolarSystemMarketSeedState(system)).seedVersion, SOLAR_SYSTEM_MARKET_SEED_VERSION);

    const before = await harness.databaseService.getMarkets({ solarSystemId: system });
    const read = freshContext();
    seedPlayer(read, { playerName: 'ColdPilot' });
    const payload = {
      playerName: 'ColdPilot', solarSystemId: system, asOf: EPOCH,
      positionKm: { x: 0, y: 0, z: 0 }, distanceAu: 100000, locationTypes: ['station'],
    };
    const get = await new SolarSystemGetMessageHandler(read).buildResponse(payload);
    assert.equal(get.success, true);
    assert.equal(get.solarSystem.id, system);
    assert.ok(get.stars.length > 0);
    assert.ok(get.bodies.some((body) => body.id === hostId));
    const list = await new MarketListMessageHandler(read).buildResponse(payload);
    const location = await new MarketListByLocationMessageHandler(read).buildResponse(payload);
    assert.equal(list.success, true);
    assert.equal(location.success, true);
    for (const station of list.markets.filter((market) => market.siteType === 'station')) {
      const orbit = station.trajectory.orbit;
      const host = get.bodies.find((body) => body.id === orbit.anchorBodyId);
      assert.ok(host, 'every station resolves its declared exact host');
      assert.equal(station.spatial.epochMs, host.spatial.epochMs);
      assert.equal(station.spatial.solarSystemId, host.spatial.solarSystemId);
      assert.equal(station.spatial.frame, host.spatial.frame);
      // Independent Kepler radius calculation at the persisted host's epoch.
      const mean = orbit.meanAnomalyAtEpochDeg * Math.PI / 180
        + 2 * Math.PI * (host.spatial.epochMs - Date.parse(orbit.epoch)) / (orbit.orbitalPeriodSec * 1000);
      let eccentric = mean % (2 * Math.PI);
      const phase = eccentric;
      for (let i = 0; i < 20; i++) {
        eccentric -= (eccentric - orbit.eccentricity * Math.sin(eccentric) - phase)
          / (1 - orbit.eccentricity * Math.cos(eccentric));
      }
      const radius = orbit.semiMajorAxisKm * (1 - orbit.eccentricity * Math.cos(eccentric));
      // Proxima's global coordinates are ~6e11 km: subtraction loses a few ULPs.
      const tolerance = Math.max(1e-6, 4 * Number.EPSILON * Math.hypot(...Object.values(host.spatial.positionKm)));
      assert.ok(Math.abs(read.calculateDistanceKm(station.spatial.positionKm, host.spatial.positionKm) - radius) < tolerance);
      assert.ok(Math.abs(radius - orbit.semiMajorAxisKm) > 1e-3, 'elliptical phase is not treated as a circular radius');
      const relative = computeRelativeOrbitPositionKm(read, orbit, new Date(host.spatial.epochMs).toISOString());
      assert.ok(Math.abs(Math.hypot(relative.x, relative.y, relative.z) - radius) < 1e-7);
      for (const axis of ['x', 'y', 'z']) {
        assert.equal(station.spatial.positionKm[axis], host.spatial.positionKm[axis] + relative[axis]);
      }
      const local = location.markets.find((market) => market.marketId === station.marketId);
      assert.ok(local);
      assert.deepEqual(local.spatial, station.spatial);
      assert.deepEqual(local.route.stations.find((entry) => entry.marketId === station.marketId).spatial, station.spatial);
    }
    assert.equal(list.markets.find((market) => market.marketId === marketId).trajectory.orbit.anchorBodyId, hostId);
    assert.equal((await read.seedSolarSystemMarketsAsync({ solarSystemId: system })).source, 'database-cache');
    assert.deepEqual(await harness.databaseService.getMarkets({ solarSystemId: system }), before);

    // Even v2 legacy records require an explicitly approved repair, never read-time aliases.
    const legacy = before.find((market) => market.marketId === marketId);
    legacy.trajectory.orbit.anchorBodyId = legacyId;
    await harness.databaseService.upsertMarket(legacy);
    const persistedLegacy = await harness.databaseService.getMarkets({ solarSystemId: system });
    const blocked = await freshContext().seedSolarSystemMarketsAsync({ solarSystemId: system });
    assert.equal(blocked.reason, 'MARKET_ANCHOR_UNRESOLVED');
    await assert.rejects(freshContext().getMarketsAsync({ solarSystemId: system }), { code: 'MARKET_ANCHOR_UNRESOLVED' });
    assert.deepEqual(await harness.databaseService.getMarkets({ solarSystemId: system }), persistedLegacy);
  });
}
