'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  SOLAR_SYSTEM_MARKET_SEED_VERSION,
  buildSeededMarketsForSolarSystem,
} = require('../src/model/solar-system-market-seed');
const { SOL_SYSTEM_CATALOG } = require('../src/model/sol-system-catalog');

test('buildSeededMarketsForSolarSystem builds Sol market set with required orbit metadata', () => {
  const seeded = buildSeededMarketsForSolarSystem('sol', '2026-05-05T00:00:00.000Z');

  assert.equal(typeof SOLAR_SYSTEM_MARKET_SEED_VERSION, 'string');
  assert.equal(seeded.length, 14);
  assert.ok(seeded.every((market) => market.solarSystemId === 'sol'));
  assert.ok(seeded.every((market) => market.spatial));
  assert.ok(seeded.every((market) => market.trajectory?.orbit));
  assert.ok(seeded.every((market) => market.trajectory.orbit.orbitType === 'elliptical'));
  assert.ok(seeded.every((market) => typeof market.trajectory.orbit.orbitalPeriodSec === 'number'));

  const starter = seeded.find((market) => market.isStarterMarket);
  assert.ok(starter);
  assert.equal(starter.marketId, 'sol-ceres-exchange');

  const moon = seeded.find((market) => market.marketId === 'sol-moon-orbit');
  assert.ok(moon);
  assert.equal(moon.trajectory.orbit.anchorBodyId, 'sol-luna');

  const earth = seeded.find((market) => market.marketId === 'sol-earth-orbit');
  assert.ok(earth);
  assert.equal(earth.trajectory.orbit.anchorBodyId, 'sol-earth');

  const pluto = seeded.find((market) => market.marketId === 'sol-pluto-orbit');
  assert.ok(pluto);
  assert.equal(pluto.trajectory.orbit.anchorBodyId, 'sol-pluto');
});

test('affected bundled Sol stations have 10000 km mean-radius periapsis altitude', () => {
  const catalog = new Map(SOL_SYSTEM_CATALOG.map((body) => [body.id, body]));
  const seeded = buildSeededMarketsForSolarSystem('sol');
  const expectedSemiMajorAxisKm = {
    'sol-mercury-orbit': 12824.432989690722,
    'sol-venus-orbit': 16213.939393939394,
    'sol-earth-orbit': 16536.363636363636,
    'sol-moon-orbit': 11976.938775510203,
    'sol-jupiter-orbit': 83240.625,
    'sol-saturn-orbit': 70342.26804123711,
    'sol-uranus-orbit': 36083.67346938776,
    'sol-neptune-orbit': 35692.78350515464,
  };
  for (const [marketId, semiMajorAxisKm] of Object.entries(expectedSemiMajorAxisKm)) {
    const market = seeded.find((entry) => entry.marketId === marketId);
    assert.ok(market);
    const orbit = market.trajectory.orbit;
    assert.equal(orbit.semiMajorAxisKm, semiMajorAxisKm);
    const radiusKm = catalog.get(orbit.anchorBodyId).physical.meanRadiusKm;
    const periapsisKm = orbit.semiMajorAxisKm * (1 - orbit.eccentricity);
    assert.ok(Math.abs(periapsisKm - (radiusKm + 10000)) < 1e-9);
  }
});

test('Mars and Pluto bundled station orbits remain unchanged', () => {
  const seeded = buildSeededMarketsForSolarSystem('sol');
  const mars = seeded.find((entry) => entry.marketId === 'sol-mars-orbit');
  const pluto = seeded.find((entry) => entry.marketId === 'sol-pluto-orbit');
  assert.equal(mars.trajectory.orbit.semiMajorAxisKm, 3800);
  assert.equal(mars.trajectory.orbit.eccentricity, 0.02);
  assert.equal(pluto.trajectory.orbit.semiMajorAxisKm, 2100);
  assert.equal(pluto.trajectory.orbit.eccentricity, 0.05);
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
  assert.ok(seeded.every((market) => market.spatial));
  assert.ok(seeded.every((market) => market.trajectory?.orbit));
  assert.ok(seeded.some((market) => market.isStarterMarket));
});

test('buildSeededMarketsForSolarSystem builds barnards-star market set', () => {
  const seeded = buildSeededMarketsForSolarSystem('barnards-star', '2026-05-05T00:00:00.000Z');
  assert.ok(seeded.length > 0);
  assert.ok(seeded.every((market) => market.solarSystemId === 'barnards-star'));
  assert.ok(seeded.every((market) => market.spatial));
  assert.ok(seeded.every((market) => market.trajectory?.orbit));
  assert.ok(seeded.some((market) => market.isStarterMarket));
});
