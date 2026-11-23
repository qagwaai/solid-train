'use strict';

const mongoose = require('mongoose');
const { CelestialBody, GameStateDocument, Market, Player } = require('../src/db/models');

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

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  try {
    const markets = await Market.find({
      marketId: { $in: MARKET_IDS },
      solarSystemId: 'sol',
    }).lean();
    for (const market of markets) {
      const orbit = market.trajectory?.orbit;
      console.log(
        JSON.stringify({
          marketId: market.marketId,
          id: String(market._id),
          __v: market.__v,
          orbit,
          spatial: market.spatial,
        })
      );
    }
    const seedState = await GameStateDocument.findOne({ key: 'solar-system-market-seed-state' }).lean();
    console.log(JSON.stringify({ seedState }));

    const players = await Player.find({
      'characters.ships.navigationPlacement.sourceMarketId': { $in: MARKET_IDS },
    }).lean();
    let dependent = 0;
    for (const player of players) {
      for (const character of player.characters || []) {
        for (const ship of character.ships || []) {
          const placement = ship.navigationPlacement;
          if (placement && MARKET_IDS.includes(placement.sourceMarketId)) dependent++;
        }
      }
    }
    console.log(JSON.stringify({ dependentPlacements: dependent }));

    for (const market of markets) {
      const anchorId = market.trajectory?.orbit?.anchorBodyId;
      if (!anchorId) continue;
      const host = await CelestialBody.findOne({ id: anchorId }).lean();
      console.log(
        JSON.stringify({
          marketId: market.marketId,
          hostId: anchorId,
          hostIdentity: host
            ? {
                bodyType: host.bodyType,
                parentBodyId: host.parentBodyId,
                catalogId: host.catalogId,
                isCatalogBody: host.isCatalogBody,
                sourceScanId: host.sourceScanId,
                createdByCharacterId: host.createdByCharacterId,
                state: host.state,
                spatial: host.spatial,
              }
            : null,
        })
      );
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
