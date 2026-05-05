'use strict';

const SOLAR_SYSTEM_MARKET_SEED_VERSION = '2026-05-sol-v1';
const SOLAR_SYSTEM_MARKET_SEED_STATE_KEY = 'solar-system-market-seed-state';
const DEFAULT_ORBIT_EPOCH = '2026-01-01T00:00:00.000Z';

const SOL_PLANETARY_MARKETS = [
  {
    marketId: 'sol-mercury-orbit',
    marketName: 'Hermes Relay Market',
    anchorBodyId: 'sol-mercury',
    anchorBodyName: 'Mercury',
    semiMajorAxisKm: 2200,
    eccentricity: 0.03,
    orbitalPeriodSec: 86400,
    priceMultiplier: 1.18,
    driftPercentPerHour: 7
  },
  {
    marketId: 'sol-venus-orbit',
    marketName: 'Aphrodite Sky Exchange',
    anchorBodyId: 'sol-venus',
    anchorBodyName: 'Venus',
    semiMajorAxisKm: 3500,
    eccentricity: 0.01,
    orbitalPeriodSec: 120000,
    priceMultiplier: 1.05,
    driftPercentPerHour: 5
  },
  {
    marketId: 'sol-earth-orbit',
    marketName: 'Terra Orbital Trade Ring',
    anchorBodyId: 'sol-earth',
    anchorBodyName: 'Earth',
    semiMajorAxisKm: 4200,
    eccentricity: 0.01,
    orbitalPeriodSec: 108000,
    priceMultiplier: 1.0,
    driftPercentPerHour: 4
  },
  {
    marketId: 'sol-moon-orbit',
    marketName: 'Luna Nearside Bazaar',
    anchorBodyId: 'sol-moon',
    anchorBodyName: 'Earth Moon',
    semiMajorAxisKm: 1200,
    eccentricity: 0.02,
    orbitalPeriodSec: 54000,
    priceMultiplier: 1.02,
    driftPercentPerHour: 4
  },
  {
    marketId: 'sol-mars-orbit',
    marketName: 'Ares Orbital Shipyard',
    anchorBodyId: 'sol-mars',
    anchorBodyName: 'Mars',
    semiMajorAxisKm: 3800,
    eccentricity: 0.02,
    orbitalPeriodSec: 130000,
    priceMultiplier: 1.07,
    driftPercentPerHour: 5
  },
  {
    marketId: 'sol-jupiter-orbit',
    marketName: 'Jovian Gate Market',
    anchorBodyId: 'sol-jupiter',
    anchorBodyName: 'Jupiter',
    semiMajorAxisKm: 9800,
    eccentricity: 0.04,
    orbitalPeriodSec: 260000,
    priceMultiplier: 0.93,
    driftPercentPerHour: 8
  },
  {
    marketId: 'sol-saturn-orbit',
    marketName: 'Ringside Logistics Hub',
    anchorBodyId: 'sol-saturn',
    anchorBodyName: 'Saturn',
    semiMajorAxisKm: 8600,
    eccentricity: 0.03,
    orbitalPeriodSec: 245000,
    priceMultiplier: 0.95,
    driftPercentPerHour: 7
  },
  {
    marketId: 'sol-uranus-orbit',
    marketName: 'Tilted Crown Exchange',
    anchorBodyId: 'sol-uranus',
    anchorBodyName: 'Uranus',
    semiMajorAxisKm: 7200,
    eccentricity: 0.02,
    orbitalPeriodSec: 230000,
    priceMultiplier: 0.97,
    driftPercentPerHour: 6
  },
  {
    marketId: 'sol-neptune-orbit',
    marketName: 'Blue Frontier Port',
    anchorBodyId: 'sol-neptune',
    anchorBodyName: 'Neptune',
    semiMajorAxisKm: 7400,
    eccentricity: 0.03,
    orbitalPeriodSec: 240000,
    priceMultiplier: 0.99,
    driftPercentPerHour: 6
  },
  {
    marketId: 'sol-pluto-orbit',
    marketName: 'Pluto Outpost Exchange',
    anchorBodyId: 'sol-pluto',
    anchorBodyName: 'Pluto',
    semiMajorAxisKm: 2100,
    eccentricity: 0.05,
    orbitalPeriodSec: 112000,
    priceMultiplier: 1.1,
    driftPercentPerHour: 9
  }
];

const SOL_ASTEROID_BELT_MARKETS = [
  {
    marketId: 'sol-ceres-exchange',
    marketName: 'Belt Foundry One',
    locationName: 'Inner Belt Relay 01',
    semiMajorAxisKm: 6100,
    eccentricity: 0.12,
    orbitalPeriodSec: 140000,
    isStarterMarket: true,
    priceMultiplier: 0.99,
    driftPercentPerHour: 6
  },
  {
    marketId: 'sol-belt-02',
    marketName: 'Belt Prospectors Exchange',
    locationName: 'Inner Belt Relay 02',
    semiMajorAxisKm: 6900,
    eccentricity: 0.18,
    orbitalPeriodSec: 156000,
    priceMultiplier: 0.98,
    driftPercentPerHour: 7
  },
  {
    marketId: 'sol-belt-03',
    marketName: 'Belt Drift Market',
    locationName: 'Outer Belt Relay 03',
    semiMajorAxisKm: 7600,
    eccentricity: 0.15,
    orbitalPeriodSec: 168000,
    priceMultiplier: 0.96,
    driftPercentPerHour: 7
  },
  {
    marketId: 'sol-belt-04',
    marketName: 'Belt Frontier Depot',
    locationName: 'Outer Belt Relay 04',
    semiMajorAxisKm: 8200,
    eccentricity: 0.11,
    orbitalPeriodSec: 176000,
    priceMultiplier: 0.95,
    driftPercentPerHour: 8
  }
];

function buildOrbit(overrides = {}, epoch = DEFAULT_ORBIT_EPOCH) {
  return {
    anchorBodyId: overrides.anchorBodyId,
    anchorBodyName: overrides.anchorBodyName,
    orbitType: overrides.orbitType || 'elliptical',
    semiMajorAxisKm: overrides.semiMajorAxisKm,
    eccentricity: overrides.eccentricity,
    inclinationDeg: overrides.inclinationDeg ?? 0,
    longitudeOfAscendingNodeDeg: overrides.longitudeOfAscendingNodeDeg ?? 0,
    argumentOfPeriapsisDeg: overrides.argumentOfPeriapsisDeg ?? 0,
    meanAnomalyAtEpochDeg: overrides.meanAnomalyAtEpochDeg ?? 0,
    orbitalPeriodSec: overrides.orbitalPeriodSec,
    epoch
  };
}

function buildSolSeedMarkets(asOfTimestamp) {
  const epoch = typeof asOfTimestamp === 'string' && asOfTimestamp.trim()
    ? asOfTimestamp.trim()
    : DEFAULT_ORBIT_EPOCH;

  const planetary = SOL_PLANETARY_MARKETS.map((entry, index) => ({
    marketId: entry.marketId,
    solarSystemId: 'sol',
    marketName: entry.marketName,
    locationType: 'station',
    locationName: `${entry.anchorBodyName} Orbital Market`,
    priceMultiplier: entry.priceMultiplier,
    driftPercentPerHour: entry.driftPercentPerHour,
    restockIntervalMinutes: 60,
    orbit: buildOrbit({
      anchorBodyId: entry.anchorBodyId,
      anchorBodyName: entry.anchorBodyName,
      semiMajorAxisKm: entry.semiMajorAxisKm,
      eccentricity: entry.eccentricity,
      inclinationDeg: (index % 2) * 1.5,
      meanAnomalyAtEpochDeg: (index * 23) % 360,
      orbitalPeriodSec: entry.orbitalPeriodSec
    }, epoch)
  }));

  const belt = SOL_ASTEROID_BELT_MARKETS.map((entry, index) => ({
    marketId: entry.marketId,
    solarSystemId: 'sol',
    marketName: entry.marketName,
    locationType: 'free-floating',
    locationName: entry.locationName,
    isStarterMarket: Boolean(entry.isStarterMarket),
    priceMultiplier: entry.priceMultiplier,
    driftPercentPerHour: entry.driftPercentPerHour,
    restockIntervalMinutes: 60,
    orbit: buildOrbit({
      anchorBodyId: 'sol-asteroid-belt',
      anchorBodyName: 'Main Asteroid Belt',
      semiMajorAxisKm: entry.semiMajorAxisKm,
      eccentricity: entry.eccentricity,
      inclinationDeg: 3 + (index * 0.7),
      argumentOfPeriapsisDeg: (45 + (index * 17)) % 360,
      meanAnomalyAtEpochDeg: (index * 81) % 360,
      orbitalPeriodSec: entry.orbitalPeriodSec
    }, epoch)
  }));

  return [...belt, ...planetary];
}

function buildSeededMarketsForSolarSystem(solarSystemId, asOfTimestamp) {
  const normalizedSolarSystemId = typeof solarSystemId === 'string'
    ? solarSystemId.trim().toLowerCase()
    : '';

  if (normalizedSolarSystemId !== 'sol') {
    return [];
  }

  return buildSolSeedMarkets(asOfTimestamp);
}

module.exports = {
  SOLAR_SYSTEM_MARKET_SEED_VERSION,
  SOLAR_SYSTEM_MARKET_SEED_STATE_KEY,
  buildSeededMarketsForSolarSystem
};
