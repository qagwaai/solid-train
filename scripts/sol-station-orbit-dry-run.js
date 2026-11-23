'use strict';

const { createHash } = require('node:crypto');
const mongoose = require('mongoose');
const { Market, Player } = require('../src/db/models');
const { buildSeededMarketsForSolarSystem } = require('../src/model/solar-system-market-seed');

const MARKET_IDS = [
  'sol-mercury-orbit',
  'sol-venus-orbit',
  'sol-earth-orbit',
  'sol-moon-orbit',
  'sol-jupiter-orbit',
  'sol-saturn-orbit',
  'sol-uranus-orbit',
  'sol-neptune-orbit',
];

function canonical(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function revision(value) {
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

function orbitOf(market) {
  return market?.trajectory?.orbit || market?.orbit || null;
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is required for a read-only live dry run');
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  try {
    const seedMarkets = buildSeededMarketsForSolarSystem('sol').filter((market) =>
      MARKET_IDS.includes(market.marketId)
    );
    const seedById = new Map(seedMarkets.map((market) => [market.marketId, market]));

    const liveMarkets = await Market.find({
      solarSystemId: 'sol',
      marketId: { $in: MARKET_IDS },
    })
      .lean()
      .exec();
    const liveById = new Map(liveMarkets.map((market) => [market.marketId, market]));

    const players = await Player.find({
      'characters.ships.navigationPlacement.sourceMarketId': { $in: MARKET_IDS },
    })
      .lean()
      .exec();

    const ships = [];
    for (const player of players) {
      for (const character of player.characters || []) {
        for (const ship of character.ships || []) {
          const placement = ship.navigationPlacement;
          if (placement && MARKET_IDS.includes(placement.sourceMarketId)) {
            ships.push({
              shipId: ship.id,
              characterId: character.id,
              sourceMarketId: placement.sourceMarketId,
              lineageId: placement.lineageId,
              sourceModelRevision: placement.sourceModelRevision,
              shipRevision: placement.shipRevision,
              epochMs: placement.epochMs,
            });
          }
        }
      }
    }

    const records = seedMarkets.map((seed) => {
      const live = liveById.get(seed.marketId);
      const liveOrbit = orbitOf(live);
      const seedOrbit = orbitOf(seed);
      const differences = liveOrbit
        ? Object.keys(seedOrbit)
            .filter((key) => JSON.stringify(liveOrbit[key]) !== JSON.stringify(seedOrbit[key]))
            .map((key) => ({
              field: key,
              stored: liveOrbit[key] ?? null,
              seed: seedOrbit[key] ?? null,
            }))
        : [{ field: 'market', stored: null, seed: 'missing-live-market' }];
      const dependentShips = ships.filter((ship) => ship.sourceMarketId === seed.marketId);
      return {
        marketId: seed.marketId,
        anchorBodyId: seedOrbit.anchorBodyId,
        liveIdentity: live
          ? {
              id: String(live._id),
              marketId: live.marketId,
              __v: live.__v,
              updatedAt: live.updatedAt ? new Date(live.updatedAt).toISOString() : null,
              orbitRevision: revision(liveOrbit),
            }
          : null,
        seedOrbitRevision: revision(seedOrbit),
        differences,
        needsMigration:
          !live ||
          liveOrbit?.semiMajorAxisKm !== seedOrbit.semiMajorAxisKm ||
          differences.length > 0,
        dependentShipCount: dependentShips.length,
        dependentShips,
        sourceModelRevisions: [...new Set(dependentShips.map((ship) => ship.sourceModelRevision))],
      };
    });

    const report = {
      mode: 'read-only-dry-run',
      writesPerformed: false,
      seedVersion: require('../src/model/solar-system-market-seed').SOLAR_SYSTEM_MARKET_SEED_VERSION,
      meanRadiusPeriapsisAltitudeKm: 10000,
      liveReadScope: 'Market and Player navigationPlacement records only',
      records,
      missingLiveMarketIds: MARKET_IDS.filter((marketId) => !liveById.has(marketId)),
      dependentShipCount: ships.length,
      dependentSourceModelRevisions: [...new Set(ships.map((ship) => ship.sourceModelRevision))],
    };

    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
