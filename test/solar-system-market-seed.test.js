'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  SOLAR_SYSTEM_MARKET_SEED_VERSION,
  buildSeededMarketsForSolarSystem,
} = require('../src/model/solar-system-market-seed');

test('buildSeededMarketsForSolarSystem builds Sol market set with required orbit metadata', () => {
  const seeded = buildSeededMarketsForSolarSystem('sol', '2026-05-05T00:00:00.000Z');

  assert.equal(typeof SOLAR_SYSTEM_MARKET_SEED_VERSION, 'string');
  assert.equal(seeded.length, 14);
  assert.ok(seeded.every((market) => market.solarSystemId === 'sol'));
  assert.ok(seeded.every((market) => market.orbit));
  assert.ok(seeded.every((market) => market.orbit.orbitType === 'elliptical'));
  assert.ok(seeded.every((market) => typeof market.orbit.orbitalPeriodSec === 'number'));

  const starter = seeded.find((market) => market.isStarterMarket);
  assert.ok(starter);
  assert.equal(starter.marketId, 'sol-ceres-exchange');

  const moon = seeded.find((market) => market.marketId === 'sol-moon-orbit');
  assert.ok(moon);
  assert.equal(moon.orbit.anchorBodyId, 'sol-moon');

  const earth = seeded.find((market) => market.marketId === 'sol-earth-orbit');
  assert.ok(earth);
  assert.equal(earth.orbit.anchorBodyId, 'sol-earth');

  const pluto = seeded.find((market) => market.marketId === 'sol-pluto-orbit');
  assert.ok(pluto);
  assert.equal(pluto.orbit.anchorBodyId, 'sol-pluto');
});

test('buildSeededMarketsForSolarSystem returns empty for unsupported systems', () => {
  assert.deepEqual(
    buildSeededMarketsForSolarSystem('proxima-centauri', '2026-05-05T00:00:00.000Z'),
    []
  );
  assert.deepEqual(buildSeededMarketsForSolarSystem('', '2026-05-05T00:00:00.000Z'), []);
  assert.deepEqual(buildSeededMarketsForSolarSystem(null, '2026-05-05T00:00:00.000Z'), []);
});

test('buildSeededMarketsForSolarSystem builds alpha-centauri market set', () => {
  const seeded = buildSeededMarketsForSolarSystem('alpha-centauri', '2026-05-05T00:00:00.000Z');
  assert.ok(seeded.length > 0);
  assert.ok(seeded.every((market) => market.solarSystemId === 'alpha-centauri'));
  assert.ok(seeded.every((market) => market.orbit));
  assert.ok(seeded.some((market) => market.isStarterMarket));
});

test('buildSeededMarketsForSolarSystem builds barnards-star market set', () => {
  const seeded = buildSeededMarketsForSolarSystem('barnards-star', '2026-05-05T00:00:00.000Z');
  assert.ok(seeded.length > 0);
  assert.ok(seeded.every((market) => market.solarSystemId === 'barnards-star'));
  assert.ok(seeded.every((market) => market.orbit));
  assert.ok(seeded.some((market) => market.isStarterMarket));
});
