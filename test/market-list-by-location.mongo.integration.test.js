'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const mongoose = require('mongoose');
const { MessageHandlerContext } = require('../src/handlers/message-handler-context');
const {
  MarketListByLocationMessageHandler,
} = require('../src/handlers/market-list-by-location-message-handler');
const { createMockSocket, seedPlayer } = require('../test-support/message-handler-test-helpers');
const { createMongoTestHarness } = require('../test-support/mongodb-test-helpers');

let mongoHarness = null;

function buildBaseRequest(overrides = {}) {
  return {
    playerName: 'MongoPilot',
    sessionKey: 'session-1',
    solarSystemId: 'sol',
    positionKm: { x: 173241287, y: -897243, z: 416968312 },
    distanceAu: 1000000,
    limit: 50,
    locationTypes: ['station'],
    ...overrides,
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

test('Integration (Option 3): Mongo clear+seed path returns Sol station markets', async () => {
  const context = new MessageHandlerContext({
    createId: randomUUID,
    getCurrentTimestamp: () => '2026-05-07T00:00:00.000Z',
    databaseService: mongoHarness.databaseService,
  });
  const handler = new MarketListByLocationMessageHandler(context);
  const socket = createMockSocket();

  // Ensure this test exercises DB clear+seed flow explicitly.
  context.marketsByKey.clear();
  const beforeSeedMarkets = await mongoHarness.databaseService.getMarkets({ solarSystemId: 'sol' });
  assert.equal(beforeSeedMarkets.length, 0);

  const seedResult = await context.seedSolarSystemMarketsAsync({
    solarSystemId: 'sol',
    force: true,
    asOf: '2026-05-07T00:00:00.000Z',
  });

  assert.equal(seedResult.success, true);
  const persistedMarkets = await mongoHarness.databaseService.getMarkets({ solarSystemId: 'sol' });
  assert.equal(persistedMarkets.length, 14);

  seedPlayer(context, {
    playerName: 'MongoPilot',
    sessionKey: 'session-1',
  });

  const response = await handler.handle(socket, {
    ...buildBaseRequest(),
  });

  assert.equal(response.success, true);
  assert.equal(response.message, 'Local market list retrieved successfully');
  assert.equal(response.markets.length, 10);
  assert.ok(response.markets.every((market) => market.solarSystemId === 'sol'));
  assert.ok(response.markets.every((market) => market.siteType === 'station'));
  assert.ok(response.markets.every((market) => market.route?.kind === 'in-system'));
  assert.ok(response.markets.every((market) => market.marketId.startsWith('sol-')));

  const uniquePositions = new Set(
    response.markets.map(
      (market) =>
        `${market.spatial?.positionKm?.x}:${market.spatial?.positionKm?.y}:${market.spatial?.positionKm?.z}`
    )
  );
  assert.ok(uniquePositions.size > 1, 'market spatial positions should not all be identical');
  assert.ok(
    response.markets.some(
      (market) =>
        market.spatial?.positionKm?.x !== 0 ||
        market.spatial?.positionKm?.y !== 0 ||
        market.spatial?.positionKm?.z !== 0
    ),
    'at least one market should have non-zero spatial coordinates'
  );
  assert.ok(
    response.markets.every((market) => market.trajectory?.orbit?.anchorBodyId),
    'orbital market trajectories should retain anchorBodyId'
  );
});

test('Integration (Option 3): Empty Mongo + empty cache still auto-hydrates seeded Sol markets', async () => {
  const context = new MessageHandlerContext({
    createId: randomUUID,
    getCurrentTimestamp: () => '2026-05-07T00:00:00.000Z',
    databaseService: mongoHarness.databaseService,
  });
  const handler = new MarketListByLocationMessageHandler(context);
  const socket = createMockSocket();

  // Force the request flow to hydrate from seed data inside getMarketsByLocationAsync.
  context.marketsByKey.clear();

  seedPlayer(context, {
    playerName: 'MongoPilot',
    sessionKey: 'session-1',
  });

  const response = await handler.handle(socket, {
    ...buildBaseRequest(),
  });

  assert.equal(response.success, true);
  assert.equal(response.message, 'Local market list retrieved successfully');
  assert.equal(response.markets.length, 10);
  assert.ok(response.markets.every((market) => market.solarSystemId === 'sol'));
  assert.ok(response.markets.every((market) => market.siteType === 'station'));
});

test('Integration (Option 3): Persisted malformed siteType values are inferred for station filter', async () => {
  const context = new MessageHandlerContext({
    createId: randomUUID,
    getCurrentTimestamp: () => '2026-05-07T00:00:00.000Z',
    databaseService: mongoHarness.databaseService,
  });
  const handler = new MarketListByLocationMessageHandler(context);
  const socket = createMockSocket();

  const seedResult = await context.seedSolarSystemMarketsAsync({
    solarSystemId: 'sol',
    force: true,
    asOf: '2026-05-07T00:00:00.000Z',
  });
  assert.equal(seedResult.success, true);

  // Simulate legacy/dirty persisted documents bypassing schema enum constraints.
  await mongoose.connection.collection('markets').updateMany(
    {
      solarSystemId: 'sol',
      marketId: {
        $in: [
          'sol-mercury-orbit',
          'sol-venus-orbit',
          'sol-earth-orbit',
          'sol-moon-orbit',
          'sol-mars-orbit',
          'sol-jupiter-orbit',
          'sol-saturn-orbit',
          'sol-uranus-orbit',
          'sol-neptune-orbit',
          'sol-pluto-orbit',
        ],
      },
    },
    {
      $set: {
        siteType: 'orbital-station',
        siteName: '',
      },
    }
  );

  context.marketsByKey.clear();
  const refreshResult = await context.seedSolarSystemMarketsAsync({
    solarSystemId: 'sol',
    force: false,
    asOf: '2026-05-07T00:00:00.000Z',
  });
  assert.equal(refreshResult.success, true);

  seedPlayer(context, {
    playerName: 'MongoPilot',
    sessionKey: 'session-1',
  });

  const response = await handler.handle(socket, {
    ...buildBaseRequest(),
  });

  assert.equal(response.success, true);
  assert.equal(response.message, 'Local market list retrieved successfully');
  assert.equal(response.markets.length, 10);
  assert.ok(response.markets.every((market) => market.siteType === 'station'));
  assert.equal(
    response.markets.some((market) => market.marketId === 'ac-proxima-station'),
    false
  );
});

test('Integration (Option 3): Persisted mixed-case solarSystemId does not break Sol station query', async () => {
  const context = new MessageHandlerContext({
    createId: randomUUID,
    getCurrentTimestamp: () => '2026-05-07T00:00:00.000Z',
    databaseService: mongoHarness.databaseService,
  });
  const handler = new MarketListByLocationMessageHandler(context);
  const socket = createMockSocket();

  const seedResult = await context.seedSolarSystemMarketsAsync({
    solarSystemId: 'sol',
    force: true,
    asOf: '2026-05-07T00:00:00.000Z',
  });
  assert.equal(seedResult.success, true);

  // Simulate persisted docs written with mixed-case system ids.
  await mongoose.connection
    .collection('markets')
    .updateMany(
      { solarSystemId: 'sol' },
      { $set: { solarSystemId: 'SoL', 'spatial.solarSystemId': 'SoL' } }
    );

  // Rebuild cache from DB-backed seed flow (non-force) and ensure query still succeeds.
  context.marketsByKey.clear();
  const refreshResult = await context.seedSolarSystemMarketsAsync({
    solarSystemId: 'sol',
    force: false,
    asOf: '2026-05-07T00:00:00.000Z',
  });
  assert.equal(refreshResult.success, true);

  seedPlayer(context, {
    playerName: 'MongoPilot',
    sessionKey: 'session-1',
  });

  const response = await handler.handle(socket, {
    ...buildBaseRequest({ solarSystemId: 'SoL' }),
  });

  assert.equal(response.success, true);
  assert.equal(response.message, 'Local market list retrieved successfully');
  assert.equal(response.markets.length, 10);
  assert.ok(response.markets.every((market) => market.solarSystemId === 'sol'));
  assert.ok(response.markets.every((market) => market.siteType === 'station'));
});
