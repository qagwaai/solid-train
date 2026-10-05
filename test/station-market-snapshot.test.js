'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Ajv = require('ajv');
const Parser = require('@apidevtools/swagger-parser');
const { MessageHandlerContext } = require('../src/handlers/message-handler-context');
const { MarketListMessageHandler } = require('../src/handlers/market-list-message-handler');
const { MarketListByLocationMessageHandler } = require('../src/handlers/market-list-by-location-message-handler');
const { seedPlayer } = require('../test-support/message-handler-test-helpers');
const { buildSeededMarketsForSolarSystem } = require('../src/model/solar-system-market-seed');
const { buildSeededCelestialBodiesForSolarSystem } = require('../src/model/solar-system-celestial-seed');
const { getSolarSystemRegistry } = require('../src/model/solar-system-registry');
const { materializeStationSnapshotAsync, computeRelativeOrbitPositionKm } = require('../src/handlers/context/orbital-math');

const EPOCH = '2026-01-01T00:00:00.000Z';
const EPOCH_MS = Date.parse(EPOCH);

function context() {
  return new MessageHandlerContext({
    log: () => {},
    getCurrentTimestamp: () => '2026-10-04T00:00:00.000Z',
    celestialBodiesById: new Map(
      buildSeededCelestialBodiesForSolarSystem('sol', EPOCH).map((body) => [body.id, body])
    ),
  });
}

function station(ctx, marketId, circular = false) {
  const seed = buildSeededMarketsForSolarSystem('sol').find((market) => market.marketId === marketId);
  if (circular) seed.trajectory.orbit.eccentricity = 0;
  return ctx.cacheMarket(ctx.createSeedMarketPayload(seed, EPOCH));
}

for (const [marketId, hostId, radius] of [
  ['sol-moon-orbit', 'sol-luna', 1200],
  ['sol-earth-orbit', 'sol-earth', 4200],
]) {
  test(`${marketId}: circular station is ${radius} km from canonical host at its fixed epoch`, async () => {
    const ctx = context();
    const market = station(ctx, marketId, true);
    const host = ctx.celestialBodiesById.get(hostId);
    const snapshot = await materializeStationSnapshotAsync(ctx, market);
    assert.equal(snapshot.marketId, marketId);
    assert.equal(snapshot.trajectory.orbit.anchorBodyId, hostId);
    assert.equal(snapshot.spatial.epochMs, EPOCH_MS);
    assert.equal(snapshot.spatial.epochMs, host.spatial.epochMs);
    assert.ok(Math.abs(ctx.calculateDistanceKm(snapshot.spatial.positionKm, host.spatial.positionKm) - radius) < 1e-7);
    const relative = computeRelativeOrbitPositionKm(ctx, market.trajectory.orbit, EPOCH);
    for (const axis of ['x', 'y', 'z']) {
      assert.equal(snapshot.spatial.positionKm[axis], host.spatial.positionKm[axis] + relative[axis]);
    }
    // In particular, Luna's stored global snapshot already includes Earth.
    assert.notDeepEqual(snapshot.spatial.positionKm, market.spatial.positionKm);
    assert.deepEqual(
      await ctx.resolveMarketPositionKmAsync(market, '2030-01-01T00:00:00.000Z'),
      snapshot.spatial.positionKm
    );
  });
}

test('station element epoch and snapshots are stable across request/service times', async () => {
  const first = buildSeededMarketsForSolarSystem('sol', '2026-05-01T00:00:00.000Z');
  const second = buildSeededMarketsForSolarSystem('sol', '2029-05-01T00:00:00.000Z');
  assert.deepEqual(first.filter((m) => m.siteType === 'station'), second.filter((m) => m.siteType === 'station'));
  const ctx = context();
  station(ctx, 'sol-moon-orbit');
  const original = structuredClone([...ctx.marketsByKey.values()]);
  const early = await ctx.getMarketsByLocationAsync({
    solarSystemId: 'sol', positionKm: { x: 0, y: 0, z: 0 }, distanceAu: 2,
    locationTypes: ['station'], asOf: EPOCH,
  });
  const late = await ctx.getMarketsByLocationAsync({
    solarSystemId: 'sol', positionKm: { x: 0, y: 0, z: 0 }, distanceAu: 2,
    locationTypes: ['station'], asOf: '2030-01-01T00:00:00.000Z',
  });
  assert.deepEqual(early[0].spatial, late[0].spatial);
  assert.equal(late[0].spatial.epochMs, EPOCH_MS);
  assert.deepEqual([...ctx.marketsByKey.values()][0].spatial, original[0].spatial, 'read correction must not persist to cache');
});

test('elliptical station uses existing orbital helper at host epoch, not a constant radius', async () => {
  const ctx = context();
  const market = station(ctx, 'sol-moon-orbit');
  const host = ctx.celestialBodiesById.get('sol-luna');
  const offset = computeRelativeOrbitPositionKm(ctx, market.trajectory.orbit, EPOCH);
  const snapshot = await materializeStationSnapshotAsync(ctx, market);
  assert.ok(Math.abs(ctx.calculateDistanceKm(host.spatial.positionKm, snapshot.spatial.positionKm) - Math.hypot(offset.x, offset.y, offset.z)) < 1e-7);
  assert.notEqual(Math.hypot(offset.x, offset.y, offset.z), 1200);
});

test('different host and element epochs use the persisted host time, never the request time', async () => {
  const ctx = context();
  const market = station(ctx, 'sol-moon-orbit');
  const host = ctx.celestialBodiesById.get('sol-luna');
  host.spatial = {
    solarSystemId: 'sol', frame: 'barycentric', epochMs: 1791142493195,
    positionKm: { x: 146637990.12582126, y: 28769104.428153206, z: -32985.38079495271 },
  };
  const relative = computeRelativeOrbitPositionKm(ctx, market.trajectory.orbit, new Date(host.spatial.epochMs).toISOString());
  const snapshot = await materializeStationSnapshotAsync(ctx, market);
  assert.equal(snapshot.spatial.epochMs, host.spatial.epochMs);
  assert.notEqual(snapshot.spatial.epochMs, Date.parse(market.trajectory.orbit.epoch));
  for (const axis of ['x', 'y', 'z']) {
    assert.equal(snapshot.spatial.positionKm[axis], host.spatial.positionKm[axis] + relative[axis]);
  }
  assert.deepEqual(
    await ctx.resolveMarketPositionKmAsync(market, new Date(1791156190454).toISOString()),
    snapshot.spatial.positionKm
  );
  const radius = ctx.calculateDistanceKm(host.spatial.positionKm, snapshot.spatial.positionKm);
  assert.ok(radius >= 1176 && radius <= 1224);
});

test('missing element epoch is rejected instead of replacing it with current time', async () => {
  const ctx = context();
  const market = station(ctx, 'sol-moon-orbit');
  delete market.trajectory.orbit.epoch;
  await assert.rejects(materializeStationSnapshotAsync(ctx, market), { code: 'MARKET_ANCHOR_UNRESOLVED' });
  ctx.cacheMarket(market);
  await assert.rejects(ctx.getMarketsAsync({ solarSystemId: 'sol' }), { code: 'MARKET_ANCHOR_UNRESOLVED' });
});

for (const anchor of ['sol-moon', 'nonexistent', '']) {
  test(`invalid station anchor '${anchor}' fails, even with Earth/parent/stored spatial present`, async () => {
    const ctx = context();
    const market = station(ctx, 'sol-moon-orbit');
    market.trajectory.orbit.anchorBodyId = anchor;
    market.parentBodyId = 'sol-earth';
    await assert.rejects(
      materializeStationSnapshotAsync(ctx, market),
      (error) => error.code === 'MARKET_ANCHOR_UNRESOLVED' && error.message.includes('sol-moon-orbit')
    );
    await assert.rejects(ctx.resolveMarketPositionKmAsync(market, EPOCH), { code: 'MARKET_ANCHOR_UNRESOLVED' });
  });
}

for (const [name, change] of [
  ['cross-system host', (host) => { host.spatial.solarSystemId = 'other'; }],
  ['invalid host epoch', (host) => { host.spatial.epochMs = NaN; }],
  ['invalid host vector', (host) => { host.spatial.positionKm.x = Infinity; }],
]) {
  test(`${name} is rejected without a fallback`, async () => {
    const ctx = context();
    const market = station(ctx, 'sol-moon-orbit');
    change(ctx.celestialBodiesById.get('sol-luna'));
    await assert.rejects(materializeStationSnapshotAsync(ctx, market), { code: 'MARKET_ANCHOR_UNRESOLVED' });
  });
}

test('list, location and route feed copy the same canonical host-epoch snapshot', async () => {
  const ctx = context();
  station(ctx, 'sol-moon-orbit', true);
  seedPlayer(ctx, { playerName: 'SnapshotPilot' });
  const payload = {
    playerName: 'SnapshotPilot', solarSystemId: 'sol',
    positionKm: { x: 0, y: 0, z: 0 }, distanceAu: 2, locationTypes: ['station'],
  };
  const list = await new MarketListMessageHandler(ctx).buildResponse(payload);
  const local = await new MarketListByLocationMessageHandler(ctx).buildResponse(payload);
  assert.equal(list.success, true);
  assert.equal(local.success, true);
  assert.deepEqual(local.markets[0].spatial, list.markets[0].spatial);
  assert.deepEqual(local.markets[0].route.stations[0].spatial, list.markets[0].spatial);
});

test('unresolved persisted legacy anchor returns explicit failure in both market handlers', async () => {
  const ctx = context();
  station(ctx, 'sol-moon-orbit').trajectory.orbit.anchorBodyId = 'sol-moon';
  seedPlayer(ctx, { playerName: 'SnapshotPilot' });
  const payload = {
    playerName: 'SnapshotPilot', solarSystemId: 'sol',
    positionKm: { x: 0, y: 0, z: 0 }, distanceAu: 2,
  };
  for (const Handler of [MarketListMessageHandler, MarketListByLocationMessageHandler]) {
    const response = await new Handler(ctx).buildResponse(payload);
    assert.equal(response.success, false);
    assert.match(response.message, /MARKET_ANCHOR_UNRESOLVED.*sol-moon/);
    assert.deepEqual(response.markets, []);
  }
});

test('every affected market operation example validates against resolved schemas', async (t) => {
  const contract = await Parser.dereference(path.resolve(__dirname, '../api/openapi/market/openapi.yaml'));
  const ajv = new Ajv({ allErrors: true, schemaId: 'auto', strictKeywords: true });
  let count = 0;
  for (const operationPath of ['/socket/market-list', '/socket/market-list-by-location']) {
    const operation = contract.paths[operationPath].post;
    for (const payload of [operation.requestBody, ...Object.values(operation.responses)]) {
      for (const content of Object.values(payload.content || {})) {
        const validate = ajv.compile(content.schema);
        for (const [name, example] of Object.entries(content.examples || {})) {
          assert.ok(validate(example.value), `${operationPath} ${name}: ${ajv.errorsText(validate.errors)}`);
          count++;
        }
      }
    }
  }
  assert.equal(count, 9);
  t.diagnostic(`${count} affected examples validated`);
  assert.equal(contract.info.version, '4.0.0');
});

test('entire implemented market catalog resolves exact station hosts in registry-generated bodies', () => {
  const implemented = [];
  for (const system of getSolarSystemRegistry()) {
    const markets = buildSeededMarketsForSolarSystem(system.id);
    if (!markets.length) continue;
    implemented.push(system.id);
    const bodies = new Map(buildSeededCelestialBodiesForSolarSystem(system.id, EPOCH).map((body) => [body.id, body]));
    for (const market of markets.filter((m) => m.siteType === 'station')) {
      const host = bodies.get(market.trajectory.orbit.anchorBodyId);
      assert.ok(host, `${system.id}/${market.marketId}: exact host must be generated`);
      assert.equal(host.spatial.solarSystemId, system.id);
      assert.equal(host.spatial.frame, 'barycentric');
      assert.ok(Number.isFinite(host.spatial.epochMs));
    }
  }
  assert.deepEqual(implemented.sort(), ['alpha-centauri', 'barnards-star', 'sol']);
});

for (const [system, marketId, hostId, a, e, period] of [
  ['alpha-centauri', 'ac-proxima-station', 'alpha-centauri-star-tertiary', 3200, 0.02, 95000],
  ['barnards-star', 'bs-main-station', 'barnards-star-planet-1', 2800, 0.03, 88000],
]) {
  test(`${system}: cold celestial then market seeding retains approved host and authored orbit`, async () => {
    const ctx = new MessageHandlerContext({ log: () => {}, getCurrentTimestamp: () => EPOCH });
    assert.equal(ctx.celestialBodiesById.size, 0);
    const failed = await ctx.seedSolarSystemMarketsAsync({ solarSystemId: system });
    assert.equal(failed.reason, 'MARKET_ANCHOR_UNRESOLVED');
    assert.equal(ctx.marketsByKey.size, 0);
    assert.equal((await ctx.seedSolarSystemCelestialBodiesAsync({ solarSystemId: system })).success, true);
    assert.equal((await ctx.seedSolarSystemMarketsAsync({ solarSystemId: system })).success, true);
    const market = (await ctx.getMarketsAsync({ solarSystemId: system })).find((m) => m.marketId === marketId);
    const host = ctx.celestialBodiesById.get(hostId);
    assert.equal(market.trajectory.orbit.anchorBodyId, hostId);
    assert.equal(market.trajectory.orbit.semiMajorAxisKm, a);
    assert.equal(market.trajectory.orbit.eccentricity, e);
    assert.equal(market.trajectory.orbit.orbitalPeriodSec, period);
    for (const field of ['inclinationDeg', 'longitudeOfAscendingNodeDeg', 'argumentOfPeriapsisDeg', 'meanAnomalyAtEpochDeg']) {
      assert.equal(market.trajectory.orbit[field], 0, `${field} must retain authored phase/orientation`);
    }
    assert.equal(market.trajectory.orbit.epoch, EPOCH);
    assert.equal(market.spatial.epochMs, host.spatial.epochMs);
    // At element epoch M=0 => E=0, so the elliptical radius is a(1-e), not a.
    assert.ok(Math.abs(ctx.calculateDistanceKm(market.spatial.positionKm, host.spatial.positionKm) - a * (1 - e)) < 1e-6);
    const legacy = structuredClone(market);
    legacy.trajectory.orbit.anchorBodyId = system === 'alpha-centauri' ? 'ac-proxima' : 'bs-b1';
    await assert.rejects(materializeStationSnapshotAsync(ctx, legacy), { code: 'MARKET_ANCHOR_UNRESOLVED' });
  });
}
