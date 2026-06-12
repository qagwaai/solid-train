'use strict';

const marketService = require('./market-service');

function buildMarketKey(marketId, solarSystemId) {
  return `${solarSystemId}:${marketId}`;
}

function cacheMarket(ctx, market) {
  const normalized = ctx.normalizeMarket(market);
  if (!normalized.marketId || !normalized.solarSystemId) {
    return null;
  }

  ctx.marketsByKey.set(buildMarketKey(normalized.marketId, normalized.solarSystemId), normalized);
  return normalized;
}

function getMarket(ctx, marketId, solarSystemId = '') {
  const normalizedMarketId = ctx.toNonEmptyString(marketId);
  const normalizedSolarSystemId = ctx.toNonEmptyString(solarSystemId).toLowerCase();
  if (!normalizedMarketId) {
    return null;
  }

  if (normalizedSolarSystemId) {
    return (
      ctx.marketsByKey.get(buildMarketKey(normalizedMarketId, normalizedSolarSystemId)) || null
    );
  }

  const allMarkets = Array.from(ctx.marketsByKey.values());
  return allMarkets.find((market) => market.marketId === normalizedMarketId) || null;
}

async function getMarketWithOwnerProfileAsync(ctx, marketId, solarSystemId = '') {
  const market = getMarket(ctx, marketId, solarSystemId);
  if (!market) {
    return null;
  }

  const owner =
    typeof ctx.getMarketOwnerProfileAsync === 'function'
      ? await ctx.getMarketOwnerProfileAsync(market.marketId, market.solarSystemId)
      : null;

  return {
    ...market,
    owner,
  };
}

function applyMarketRestock(ctx, market, nowTimestamp) {
  return marketService.applyMarketRestock(ctx, market, nowTimestamp);
}

async function getMarketsAsync(ctx, query = {}) {
  return marketService.getMarketsAsync(ctx, query);
}

async function buildOwnerProfilesByMarketKey(ctx, query = {}) {
  if (typeof ctx.getSeededNpcProfilesAsync !== 'function') {
    return new Map();
  }

  const profiles = await ctx.getSeededNpcProfilesAsync({
    solarSystemId: ctx.toNonEmptyString(query?.solarSystemId).toLowerCase(),
  });

  return new Map(
    profiles.map((profile) => [`${profile.solarSystemId}:${profile.marketId}`, profile])
  );
}

async function getMarketsWithOwnerProfilesAsync(ctx, query = {}) {
  const markets =
    typeof ctx.getMarketsAsync === 'function'
      ? await ctx.getMarketsAsync(query)
      : await getMarketsAsync(ctx, query);

  const ownerProfilesByMarketKey = await buildOwnerProfilesByMarketKey(ctx, query);

  return Promise.all(
    markets.map(async (market) => {
      const owner =
        ownerProfilesByMarketKey.get(buildMarketKey(market.marketId, market.solarSystemId)) ||
        (typeof ctx.getMarketOwnerProfileAsync === 'function'
          ? await ctx.getMarketOwnerProfileAsync(market.marketId, market.solarSystemId)
          : null);

      return {
        ...market,
        owner,
      };
    })
  );
}

async function getMarketsByLocationAsync(ctx, query = {}) {
  return marketService.getMarketsByLocationAsync(ctx, query);
}

async function getMarketsByLocationWithOwnerProfilesAsync(ctx, query = {}) {
  const markets =
    typeof ctx.getMarketsByLocationAsync === 'function'
      ? await ctx.getMarketsByLocationAsync(query)
      : await getMarketsByLocationAsync(ctx, query);

  const ownerProfilesByMarketKey = await buildOwnerProfilesByMarketKey(ctx, query);

  return Promise.all(
    markets.map(async (market) => {
      const owner =
        ownerProfilesByMarketKey.get(buildMarketKey(market.marketId, market.solarSystemId)) ||
        (typeof ctx.getMarketOwnerProfileAsync === 'function'
          ? await ctx.getMarketOwnerProfileAsync(market.marketId, market.solarSystemId)
          : null);

      return {
        ...market,
        owner,
      };
    })
  );
}

async function getMarketQuoteAsync(ctx, request = {}) {
  return marketService.getMarketQuoteAsync(ctx, request);
}

async function getMarketInventoryAsync(ctx, query = {}) {
  return marketService.getMarketInventoryAsync(ctx, query);
}

async function getMarketLedgerAsync(ctx, query = {}) {
  return marketService.getMarketLedgerAsync(ctx, query);
}

module.exports = {
  cacheMarket,
  getMarket,
  getMarketWithOwnerProfileAsync,
  applyMarketRestock,
  getMarketsAsync,
  getMarketsWithOwnerProfilesAsync,
  getMarketsByLocationAsync,
  getMarketsByLocationWithOwnerProfilesAsync,
  getMarketQuoteAsync,
  getMarketInventoryAsync,
  getMarketLedgerAsync,
};
