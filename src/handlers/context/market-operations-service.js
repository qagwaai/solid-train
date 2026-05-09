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

function applyMarketRestock(ctx, market, nowTimestamp) {
  return marketService.applyMarketRestock(ctx, market, nowTimestamp);
}

async function getMarketsAsync(ctx, query = {}) {
  return marketService.getMarketsAsync(ctx, query);
}

async function getMarketsByLocationAsync(ctx, query = {}) {
  return marketService.getMarketsByLocationAsync(ctx, query);
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
  applyMarketRestock,
  getMarketsAsync,
  getMarketsByLocationAsync,
  getMarketQuoteAsync,
  getMarketInventoryAsync,
  getMarketLedgerAsync,
};
