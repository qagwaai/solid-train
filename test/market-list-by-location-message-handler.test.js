'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MarketListByLocationMessageHandler
} = require('../src/handlers/market-list-by-location-message-handler');
const {
  MARKET_LIST_BY_LOCATION_RESPONSE_EVENT
} = require('../src/model/market-list-by-location');
const {
  INVALID_SESSION_EVENT,
  INVALID_SESSION_MESSAGE
} = require('../src/model/session');
const {
  createMockSocket,
  createTestContext,
  seedPlayer
} = require('../test-support/message-handler-test-helpers');

function createMarket(overrides = {}) {
  return {
    marketId: 'market-1',
    solarSystemId: 'sol',
    marketName: 'Market One',
    locationType: 'station',
    locationName: 'One',
    isStarterMarket: false,
    orbit: {
      anchorBodyId: 'sol',
      semiMajorAxisKm: 100,
      eccentricity: 0,
      inclinationDeg: 0,
      longitudeOfAscendingNodeDeg: 0,
      argumentOfPeriapsisDeg: 0,
      meanAnomalyAtEpochDeg: 0,
      orbitalPeriodSec: 86400,
      epoch: '2026-04-17T00:00:00.000Z'
    },
    priceMultiplier: 1,
    driftPercentPerHour: 0,
    restockIntervalMinutes: 60,
    lastRestockAt: '2026-04-17T00:00:00.000Z',
    inventory: [],
    ledger: [],
    ...overrides
  };
}

test('MarketListByLocationMessageHandler returns nearest-first markets with docking status', async () => {
  const context = createTestContext();
  context.marketsByKey.clear();

  const nearMarket = context.cacheMarket(createMarket({
    marketId: 'market-near',
    marketName: 'Near Market',
    locationType: 'station',
    orbit: {
      anchorBodyId: 'sol',
      semiMajorAxisKm: 100,
      eccentricity: 0,
      inclinationDeg: 0,
      longitudeOfAscendingNodeDeg: 0,
      argumentOfPeriapsisDeg: 0,
      meanAnomalyAtEpochDeg: 0,
      orbitalPeriodSec: 86400,
      epoch: '2026-04-17T00:00:00.000Z'
    }
  }));

  context.cacheMarket(createMarket({
    marketId: 'market-mid',
    marketName: 'Mid Market',
    locationType: 'free-floating',
    orbit: {
      anchorBodyId: 'sol',
      semiMajorAxisKm: 200,
      eccentricity: 0,
      inclinationDeg: 0,
      longitudeOfAscendingNodeDeg: 0,
      argumentOfPeriapsisDeg: 0,
      meanAnomalyAtEpochDeg: 0,
      orbitalPeriodSec: 86400,
      epoch: '2026-04-17T00:00:00.000Z'
    }
  }));

  seedPlayer(context, {
    playerName: 'MarketPilot',
    sessionKey: 'session-1',
    characters: [
      {
        id: 'character-1',
        characterName: 'One',
        ships: [
          {
            id: 'ship-1',
            kinematics: {
              position: { x: 100, y: 0, z: 0 }
            }
          }
        ]
      }
    ]
  });

  const handler = new MarketListByLocationMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'marketpilot',
    sessionKey: 'session-1',
    solarSystemId: 'sol',
    positionKm: { x: 90, y: 0, z: 0 },
    distanceAu: 0.001,
    limit: 2,
    characterId: 'character-1',
    shipId: 'ship-1'
  });

  assert.equal(response.success, true);
  assert.equal(response.message, 'Local market list retrieved successfully');
  assert.equal(response.playerName, 'MarketPilot');
  assert.equal(response.markets.length, 2);
  assert.equal(response.markets[0].marketId, nearMarket.marketId);
  assert.ok(typeof response.markets[0].distanceAu === 'number');
  assert.ok(response.markets[0].route !== undefined);
  assert.equal(response.isDocked, true);
  assert.equal(response.dockedMarketId, nearMarket.marketId);
  assert.equal(response.markets[0].isDocked, true);
  assert.equal(response.markets[1].isDocked, false);
  assert.equal(socket.events[0].eventName, MARKET_LIST_BY_LOCATION_RESPONSE_EVENT);
});

test('MarketListByLocationMessageHandler filters by locationTypes and applies no-result response', async () => {
  const context = createTestContext();
  context.marketsByKey.clear();

  context.cacheMarket(createMarket({
    marketId: 'market-station',
    locationType: 'station'
  }));
  context.cacheMarket(createMarket({
    marketId: 'market-floating',
    locationType: 'free-floating',
    orbit: {
      anchorBodyId: 'sol',
      semiMajorAxisKm: 200,
      eccentricity: 0,
      inclinationDeg: 0,
      longitudeOfAscendingNodeDeg: 0,
      argumentOfPeriapsisDeg: 0,
      meanAnomalyAtEpochDeg: 0,
      orbitalPeriodSec: 86400,
      epoch: '2026-04-17T00:00:00.000Z'
    }
  }));

  seedPlayer(context, {
    playerName: 'MarketPilot',
    sessionKey: 'session-1'
  });

  const handler = new MarketListByLocationMessageHandler(context);
  const socket = createMockSocket();

  const filtered = await handler.handle(socket, {
    playerName: 'MarketPilot',
    sessionKey: 'session-1',
    solarSystemId: 'sol',
    positionKm: { x: 0, y: 0, z: 0 },
    distanceAu: 0.001,
    locationTypes: ['station']
  });

  assert.equal(filtered.success, true);
  assert.equal(filtered.markets.length, 1);
  assert.equal(filtered.markets[0].marketId, 'market-station');

  const none = await handler.handle(socket, {
    playerName: 'MarketPilot',
    sessionKey: 'session-1',
    solarSystemId: 'sol',
    positionKm: { x: 0, y: 0, z: 0 },
    distanceAu: 0.001,
    locationTypes: ['surface-settlement']
  });

  assert.equal(none.success, true);
  assert.equal(none.message, 'No markets found within distance');
  assert.deepEqual(none.markets, []);
});

test('MarketListByLocationMessageHandler validates required fields and locationTypes format', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'MarketPilot',
    sessionKey: 'session-1'
  });

  const handler = new MarketListByLocationMessageHandler(context);
  const socket = createMockSocket();

  const requiredFailure = await handler.handle(socket, {
    playerName: 'MarketPilot',
    sessionKey: 'session-1',
    solarSystemId: 'sol',
    positionKm: { x: 1, y: 2 },
    distanceAu: -1
  });

  assert.equal(requiredFailure.success, false);
  assert.equal(
    requiredFailure.message,
    'playerName, solarSystemId, positionKm, and distanceAu are required'
  );

  const formatFailure = await handler.handle(socket, {
    playerName: 'MarketPilot',
    sessionKey: 'session-1',
    solarSystemId: 'sol',
    positionKm: { x: 0, y: 0, z: 0 },
    distanceAu: 0.001,
    locationTypes: 'station'
  });

  assert.equal(formatFailure.success, false);
  assert.equal(
    formatFailure.message,
    'locationTypes must be an array of non-empty strings when provided'
  );

  assert.equal(socket.events[0].eventName, MARKET_LIST_BY_LOCATION_RESPONSE_EVENT);
  assert.equal(socket.events[1].eventName, MARKET_LIST_BY_LOCATION_RESPONSE_EVENT);
});

test('MarketListByLocationMessageHandler emits invalid session before query', async () => {
  const context = createTestContext();
  seedPlayer(context, {
    playerName: 'MarketPilot',
    sessionKey: 'session-1'
  });

  const handler = new MarketListByLocationMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'MarketPilot',
    sessionKey: 'bad-session',
    solarSystemId: 'sol',
    positionKm: { x: 0, y: 0, z: 0 },
    distanceAu: 0.001
  });

  assert.deepEqual(response, { message: INVALID_SESSION_MESSAGE });
  assert.equal(socket.events[0].eventName, INVALID_SESSION_EVENT);
});

test('MarketListByLocationMessageHandler route is always in-system because markets are scoped to the request solar system', async () => {
  const context = createTestContext();
  context.marketsByKey.clear();

  // Two markets in the request system
  context.cacheMarket(createMarket({
    marketId: 'market-near',
    solarSystemId: 'sol',
    orbit: {
      anchorBodyId: 'sol',
      semiMajorAxisKm: 100,
      eccentricity: 0,
      inclinationDeg: 0,
      longitudeOfAscendingNodeDeg: 0,
      argumentOfPeriapsisDeg: 0,
      meanAnomalyAtEpochDeg: 0,
      orbitalPeriodSec: 86400,
      epoch: '2026-04-17T00:00:00.000Z'
    }
  }));
  context.cacheMarket(createMarket({
    marketId: 'market-far',
    solarSystemId: 'sol',
    orbit: {
      anchorBodyId: 'sol',
      semiMajorAxisKm: 200,
      eccentricity: 0,
      inclinationDeg: 0,
      longitudeOfAscendingNodeDeg: 0,
      argumentOfPeriapsisDeg: 0,
      meanAnomalyAtEpochDeg: 0,
      orbitalPeriodSec: 86400,
      epoch: '2026-04-17T00:00:00.000Z'
    }
  }));

  // A market in a different system is filtered out before distance/route computation
  context.cacheMarket(createMarket({
    marketId: 'market-other-system',
    solarSystemId: 'proxima-centauri',
    orbit: {
      anchorBodyId: 'proxima-centauri',
      semiMajorAxisKm: 100,
      eccentricity: 0,
      inclinationDeg: 0,
      longitudeOfAscendingNodeDeg: 0,
      argumentOfPeriapsisDeg: 0,
      meanAnomalyAtEpochDeg: 0,
      orbitalPeriodSec: 86400,
      epoch: '2026-04-17T00:00:00.000Z'
    }
  }));

  seedPlayer(context, {
    playerName: 'GatePilot',
    sessionKey: 'session-1'
  });

  const handler = new MarketListByLocationMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'GatePilot',
    sessionKey: 'session-1',
    solarSystemId: 'sol',
    positionKm: { x: 0, y: 0, z: 0 },
    distanceAu: 10
  });

  assert.equal(response.success, true);
  // Only the two sol markets are returned; the proxima-centauri market is excluded
  assert.equal(response.markets.length, 2);
  assert.ok(response.markets.every((m) => m.solarSystemId === 'sol'));
  // All returned markets are in-system by definition
  assert.ok(response.markets.every((m) => m.route.kind === 'in-system'));
});

test('MarketListByLocationMessageHandler route is in-system when no gate network is configured', async () => {
  const context = createTestContext();
  context.marketsByKey.clear();

  context.cacheMarket(createMarket({
    marketId: 'market-1',
    solarSystemId: 'sol',
    orbit: {
      anchorBodyId: 'sol',
      semiMajorAxisKm: 100,
      eccentricity: 0,
      inclinationDeg: 0,
      longitudeOfAscendingNodeDeg: 0,
      argumentOfPeriapsisDeg: 0,
      meanAnomalyAtEpochDeg: 0,
      orbitalPeriodSec: 86400,
      epoch: '2026-04-17T00:00:00.000Z'
    }
  }));

  seedPlayer(context, {
    playerName: 'MarketPilot',
    sessionKey: 'session-1'
  });

  const handler = new MarketListByLocationMessageHandler(context);
  const socket = createMockSocket();

  const response = await handler.handle(socket, {
    playerName: 'MarketPilot',
    sessionKey: 'session-1',
    solarSystemId: 'sol',
    positionKm: { x: 0, y: 0, z: 0 },
    distanceAu: 0.001
  });

  assert.equal(response.success, true);
  assert.equal(response.markets.length, 1);
  assert.deepEqual(response.markets[0].route, { kind: 'in-system' });
});
