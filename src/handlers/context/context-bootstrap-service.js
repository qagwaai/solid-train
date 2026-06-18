'use strict';

const { MARKET_CATALOG } = require('../../model/market-catalog');
const { buildDefaultShipListings } = require('../../model/ship-market-catalog');
const { buildSeededNpcsForSolarSystem } = require('../../model/solar-system-npc-seed');
const { buildSeededMarketsForSolarSystem } = require('../../model/solar-system-market-seed');
const npcService = require('./npc-service');
const normalizers = require('./normalizers');

const DEFAULT_RESTOCK_INTERVAL_MINUTES = 60;

async function initializeAsync(ctx, options = {}) {
  const seedDefaults = options.seedDefaults !== false;
  if (!seedDefaults || ctx._seedDefaultsInitialized) {
    return {
      success: true,
      seededDefaults: false,
    };
  }

  let seededDefaults = false;

  if (ctx.marketsByKey.size === 0) {
    seedDefaultMarkets(ctx);
    seededDefaults = true;
  }

  if (ctx.npcBustsById.size === 0 || ctx.seededNpcOwnersById.size === 0) {
    seedDefaultNpcs(ctx);
    seededDefaults = true;
  }

  ctx._seedDefaultsInitialized = true;
  return {
    success: true,
    seededDefaults,
  };
}

function seedDefaultMarkets(ctx) {
  const now = ctx.getCurrentTimestamp();
  const systemIds = ['sol', 'alpha-centauri', 'barnards-star'];

  for (const systemId of systemIds) {
    const defaults = buildSeededMarketsForSolarSystem(systemId, now);
    for (const market of defaults) {
      ctx.cacheMarket(createSeedMarketPayload(ctx, market, now));
    }
  }
}

function seedDefaultNpcs(ctx) {
  const now = ctx.getCurrentTimestamp();
  const systemIds = ['sol'];

  for (const systemId of systemIds) {
    const defaults = buildSeededNpcsForSolarSystem(systemId, now);
    for (const npc of defaults) {
      npcService.cacheSeededNpc(ctx, npc, now);
    }
  }
}

function createSeedMarketPayload(ctx, seedMarket, timestamp) {
  const source = ctx.toPlainObject(seedMarket) || {};
  const siteType = ctx.inferMarketSiteType(source);
  const siteName =
    ctx.toNonEmptyString(source.siteName) || ctx.toNonEmptyString(source.marketName);
  const spatial = ctx.normalizeSpatialState(source.spatial) || undefined;
  const trajectory = ctx.normalizeTrajectoryDescriptor(source.trajectory) || undefined;

  return {
    ...seedMarket,
    solarSystemId: ctx.toNonEmptyString(source.solarSystemId).toLowerCase(),
    siteType,
    siteName,
    ...(spatial ? { spatial } : {}),
    ...(trajectory ? { trajectory } : {}),
    restockIntervalMinutes:
      Number.isInteger(seedMarket?.restockIntervalMinutes) && seedMarket.restockIntervalMinutes > 0
        ? seedMarket.restockIntervalMinutes
        : DEFAULT_RESTOCK_INTERVAL_MINUTES,
    lastRestockAt: ctx.toNonEmptyString(seedMarket?.lastRestockAt) || timestamp,
    inventory: MARKET_CATALOG.map((catalogEntry) =>
      normalizers.getDefaultInventoryEntry(catalogEntry)
    ),
    ledger: [],
    shipListings: buildDefaultShipListings(timestamp),
  };
}

module.exports = {
  initializeAsync,
  seedDefaultMarkets,
  seedDefaultNpcs,
  createSeedMarketPayload,
};
