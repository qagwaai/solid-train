'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { MessageHandlerContext } = require('../src/handlers/message-handler-context');
const { SOLAR_SYSTEM_MARKET_SEED_VERSION } = require('../src/model/solar-system-market-seed');

function createContextWithDb(db) {
  let nextId = 0;
  return new MessageHandlerContext({
    databaseService: db,
    log: () => {},
    createId: () => `id-${++nextId}`,
    getCurrentTimestamp: () => '2026-05-05T00:00:00.000Z',
  });
}

test('seedSolarSystemMarketsAsync upserts seeded markets and writes seed-state metadata', async () => {
  const upserts = [];
  let stateWrite = null;
  const db = {
    async getSolarSystemMarketSeedState() {
      return null;
    },
    async upsertMarket(market) {
      upserts.push(market);
      return market;
    },
    async setSolarSystemMarketSeedState(solarSystemId, seedVersion, seededAt) {
      stateWrite = { solarSystemId, seedVersion, seededAt };
      return stateWrite;
    },
    async getMarkets() {
      return upserts;
    },
  };

  const context = createContextWithDb(db);
  context.marketsByKey.clear();

  const result = await context.seedSolarSystemMarketsAsync({ solarSystemId: 'sol' });

  assert.equal(result.success, true);
  assert.equal(result.source, 'database-upsert');
  assert.equal(result.marketCount, 14);
  assert.equal(upserts.length, 14);
  assert.equal(stateWrite.solarSystemId, 'sol');
  assert.equal(stateWrite.seedVersion, SOLAR_SYSTEM_MARKET_SEED_VERSION);
  assert.equal(stateWrite.seededAt, '2026-05-05T00:00:00.000Z');

  const fromCache = await context.getMarketsAsync({ solarSystemId: 'sol' });
  assert.equal(fromCache.length, 14);
  assert.ok(fromCache.some((market) => market.isStarterMarket));
});

test('seedSolarSystemMarketsAsync uses cached database markets when seed version is current', async () => {
  const persistedMarkets = [
    {
      marketId: 'sol-belt-01',
      solarSystemId: 'sol',
      marketName: 'Persisted Belt One',
      siteType: 'free-floating',
      siteName: 'Persisted Belt One',
      isStarterMarket: true,
      spatial: {
        solarSystemId: 'sol',
        frame: 'barycentric',
        positionKm: { x: 6100, y: 0, z: 0 },
        epochMs: 1746403200000,
      },
      trajectory: {
        kind: 'orbital-elements',
        orbit: {
          anchorBodyId: 'sol-asteroid-belt',
          anchorBodyName: 'Main Asteroid Belt',
          orbitType: 'elliptical',
          semiMajorAxisKm: 6100,
          eccentricity: 0.1,
          inclinationDeg: 0,
          longitudeOfAscendingNodeDeg: 0,
          argumentOfPeriapsisDeg: 0,
          meanAnomalyAtEpochDeg: 0,
          orbitalPeriodSec: 140000,
          epoch: '2026-05-05T00:00:00.000Z',
        },
      },
      restockIntervalMinutes: 60,
      lastRestockAt: '2026-05-05T00:00:00.000Z',
      inventory: [],
      ledger: [],
    },
  ];

  let upsertCalls = 0;
  const db = {
    async getSolarSystemMarketSeedState() {
      return {
        solarSystemId: 'sol',
        seedVersion: SOLAR_SYSTEM_MARKET_SEED_VERSION,
        seededAt: '2026-05-05T00:00:00.000Z',
      };
    },
    async upsertMarket() {
      upsertCalls += 1;
      return null;
    },
    async setSolarSystemMarketSeedState() {
      throw new Error('should not write state when current version is already seeded');
    },
    async getMarkets() {
      return persistedMarkets;
    },
  };

  const context = createContextWithDb(db);
  context.marketsByKey.clear();

  const result = await context.seedSolarSystemMarketsAsync({ solarSystemId: 'sol' });

  assert.equal(result.success, true);
  assert.equal(result.source, 'database-cache');
  assert.equal(result.marketCount, 1);
  assert.equal(upsertCalls, 0);

  const fromCache = await context.getMarketsAsync({ solarSystemId: 'sol' });
  assert.equal(fromCache.length, 1);
  assert.equal(fromCache[0].marketName, 'Persisted Belt One');
  assert.equal(fromCache[0].siteType, 'free-floating');
  assert.deepEqual(fromCache[0].spatial.positionKm, { x: 6100, y: 0, z: 0 });
});
