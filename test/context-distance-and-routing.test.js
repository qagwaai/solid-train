'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestContext } = require('../test-support/message-handler-test-helpers');

const ASTRONOMICAL_UNIT_KM = 149_597_870.7;

// ---------------------------------------------------------------------------
// calculateDistanceAu
// ---------------------------------------------------------------------------

test('calculateDistanceAu returns exactly 1.0 AU for a position 1 AU from origin', () => {
  const context = createTestContext();

  const result = context.calculateDistanceAu(
    { x: 0, y: 0, z: 0 },
    { x: ASTRONOMICAL_UNIT_KM, y: 0, z: 0 }
  );

  assert.ok(Math.abs(result - 1.0) < 1e-9, `Expected ~1.0 AU, got ${result}`);
});

test('calculateDistanceAu returns 0 for identical positions', () => {
  const context = createTestContext();

  const result = context.calculateDistanceAu(
    { x: 500, y: -200, z: 100 },
    { x: 500, y: -200, z: 100 }
  );

  assert.equal(result, 0);
});

test('calculateDistanceAu uses the IAU constant 149597870.7 km per AU', () => {
  const context = createTestContext();

  // 3D distance of exactly 2 AU along the diagonal axes
  const twoAuKm = 2 * ASTRONOMICAL_UNIT_KM;
  // Place vector so that sqrt(x²) = twoAuKm
  const result = context.calculateDistanceAu({ x: 0, y: 0, z: 0 }, { x: twoAuKm, y: 0, z: 0 });

  assert.ok(Math.abs(result - 2.0) < 1e-9, `Expected ~2.0 AU, got ${result}`);
});

// ---------------------------------------------------------------------------
// loadGateNetworkAsync + getHopPathBetweenSystems
// ---------------------------------------------------------------------------

function makeGateService(gates) {
  return {
    async getJumpGatesAsync() {
      return gates;
    },
  };
}

test('getHopPathBetweenSystems returns hops:0 and empty path for same system', async () => {
  const context = createTestContext();

  const result = await context.getHopPathBetweenSystems('sol', 'sol');

  assert.deepEqual(result, { hops: 0, path: [] });
});

test('getHopPathBetweenSystems returns 1 hop for directly connected systems', async () => {
  const context = createTestContext();
  context.databaseService = makeGateService([
    {
      gateId: 'gate-sol-proxima',
      sourceSystemId: 'sol',
      destSystemId: 'proxima-centauri',
      traversalCostAu: 5,
      traversalTimeHours: 48,
    },
  ]);

  const result = await context.getHopPathBetweenSystems('sol', 'proxima-centauri');

  assert.deepEqual(result, { hops: 1, path: ['gate-sol-proxima'] });
});

test('getHopPathBetweenSystems returns correct hop count and path for multi-hop route', async () => {
  const context = createTestContext();
  context.databaseService = makeGateService([
    {
      gateId: 'gate-a-b',
      sourceSystemId: 'alpha',
      destSystemId: 'beta',
      traversalCostAu: 5,
      traversalTimeHours: 24,
    },
    {
      gateId: 'gate-b-c',
      sourceSystemId: 'beta',
      destSystemId: 'gamma',
      traversalCostAu: 5,
      traversalTimeHours: 24,
    },
  ]);

  const result = await context.getHopPathBetweenSystems('alpha', 'gamma');

  assert.ok(result !== null);
  assert.equal(result.hops, 2);
  assert.deepEqual(result.path, ['gate-a-b', 'gate-b-c']);
});

test('getHopPathBetweenSystems returns null when systems are not connected', async () => {
  const context = createTestContext();
  context.databaseService = makeGateService([
    {
      gateId: 'gate-sol-proxima',
      sourceSystemId: 'sol',
      destSystemId: 'proxima-centauri',
      traversalCostAu: 5,
      traversalTimeHours: 48,
    },
  ]);

  const result = await context.getHopPathBetweenSystems('sol', 'kepler-442');

  assert.equal(result, null);
});

test('getHopPathBetweenSystems does not traverse backwards on one-way gates', async () => {
  const context = createTestContext();
  // Gate is only sol -> proxima; reverse should not be found
  context.databaseService = makeGateService([
    {
      gateId: 'gate-sol-proxima',
      sourceSystemId: 'sol',
      destSystemId: 'proxima-centauri',
      traversalCostAu: 5,
      traversalTimeHours: 48,
    },
  ]);

  const result = await context.getHopPathBetweenSystems('proxima-centauri', 'sol');

  assert.equal(result, null);
});

// ---------------------------------------------------------------------------
// loadGateNetworkAsync caching
// ---------------------------------------------------------------------------

test('loadGateNetworkAsync caches the gate graph and does not call DB a second time', async () => {
  const context = createTestContext();
  let callCount = 0;
  context.databaseService = {
    async getJumpGatesAsync() {
      callCount++;
      return [
        {
          gateId: 'gate-1',
          sourceSystemId: 'sol',
          destSystemId: 'proxima-centauri',
          traversalCostAu: 5,
          traversalTimeHours: 24,
        },
      ];
    },
  };

  await context.loadGateNetworkAsync();
  await context.loadGateNetworkAsync();
  await context.loadGateNetworkAsync();

  assert.equal(callCount, 1);
});

// ---------------------------------------------------------------------------
// getRouteForMarketAsync
// ---------------------------------------------------------------------------

test('getRouteForMarketAsync returns { kind: in-system } for the same solar system', async () => {
  const context = createTestContext();

  const result = await context.getRouteForMarketAsync('sol', 'sol');

  assert.deepEqual(result, { kind: 'in-system' });
});

test('getRouteForMarketAsync returns { kind: gate-route, hops: N } for a reachable system', async () => {
  const context = createTestContext();
  context.databaseService = makeGateService([
    {
      gateId: 'gate-sol-proxima',
      sourceSystemId: 'sol',
      destSystemId: 'proxima-centauri',
      traversalCostAu: 5,
      traversalTimeHours: 48,
    },
    {
      gateId: 'gate-proxima-kepler',
      sourceSystemId: 'proxima-centauri',
      destSystemId: 'kepler-442',
      traversalCostAu: 10,
      traversalTimeHours: 96,
    },
  ]);

  const directResult = await context.getRouteForMarketAsync('sol', 'proxima-centauri');
  assert.deepEqual(directResult, { kind: 'gate-route', hops: 1 });

  const twoHopResult = await context.getRouteForMarketAsync('sol', 'kepler-442');
  assert.deepEqual(twoHopResult, { kind: 'gate-route', hops: 2 });
});

test('getRouteForMarketAsync returns { kind: no-route } for an unreachable system', async () => {
  const context = createTestContext();
  context.databaseService = makeGateService([
    {
      gateId: 'gate-sol-proxima',
      sourceSystemId: 'sol',
      destSystemId: 'proxima-centauri',
      traversalCostAu: 5,
      traversalTimeHours: 48,
    },
  ]);

  const result = await context.getRouteForMarketAsync('sol', 'tau-ceti');

  assert.deepEqual(result, { kind: 'no-route' });
});

// ---------------------------------------------------------------------------
// _normalizeDriveProfile
// ---------------------------------------------------------------------------

test('_normalizeDriveProfile returns a valid profile when all fields are positive', () => {
  const context = createTestContext();

  const result = context._normalizeDriveProfile({
    id: 'mk1-drive',
    name: 'Standard Drive Mk1',
    rangeAu: 10,
    cruiseSpeedAuPerHour: 0.5,
    fuelCostPerAu: 2.5,
  });

  assert.deepEqual(result, {
    id: 'mk1-drive',
    name: 'Standard Drive Mk1',
    rangeAu: 10,
    cruiseSpeedAuPerHour: 0.5,
    fuelCostPerAu: 2.5,
  });
});

test('_normalizeDriveProfile returns null for null or missing input', () => {
  const context = createTestContext();

  assert.equal(context._normalizeDriveProfile(null), null);
  assert.equal(context._normalizeDriveProfile(undefined), null);
  assert.equal(context._normalizeDriveProfile('string'), null);
});

test('_normalizeDriveProfile returns null when id or name is empty', () => {
  const context = createTestContext();

  assert.equal(
    context._normalizeDriveProfile({
      id: '',
      name: 'Valid Name',
      rangeAu: 10,
      cruiseSpeedAuPerHour: 0.5,
      fuelCostPerAu: 2.5,
    }),
    null
  );

  assert.equal(
    context._normalizeDriveProfile({
      id: 'mk1',
      name: '',
      rangeAu: 10,
      cruiseSpeedAuPerHour: 0.5,
      fuelCostPerAu: 2.5,
    }),
    null
  );
});

test('_normalizeDriveProfile returns null when any numeric field is zero, negative, or non-finite', () => {
  const context = createTestContext();
  const base = {
    id: 'mk1',
    name: 'Drive',
    rangeAu: 10,
    cruiseSpeedAuPerHour: 0.5,
    fuelCostPerAu: 2.5,
  };

  assert.equal(context._normalizeDriveProfile({ ...base, rangeAu: 0 }), null);
  assert.equal(context._normalizeDriveProfile({ ...base, rangeAu: -5 }), null);
  assert.equal(context._normalizeDriveProfile({ ...base, rangeAu: Infinity }), null);
  assert.equal(context._normalizeDriveProfile({ ...base, cruiseSpeedAuPerHour: 0 }), null);
  assert.equal(context._normalizeDriveProfile({ ...base, fuelCostPerAu: NaN }), null);
});
