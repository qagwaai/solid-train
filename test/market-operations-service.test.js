'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const marketOperationsService = require('../src/handlers/context/market-operations-service');

function createCtx(overrides = {}) {
  return {
    marketsByKey: new Map(),
    toNonEmptyString(value) {
      return typeof value === 'string' ? value.trim() : '';
    },
    normalizeMarket(market) {
      return market;
    },
    ...overrides,
  };
}

test('cacheMarket stores normalized market keyed by solarSystemId:marketId', () => {
  const ctx = createCtx({
    normalizeMarket() {
      return {
        marketId: 'sol-earth-orbit-1',
        solarSystemId: 'sol',
        marketName: 'Earth L1 Exchange',
      };
    },
  });

  const normalized = marketOperationsService.cacheMarket(ctx, { marketId: 'ignored' });

  assert.equal(normalized.marketId, 'sol-earth-orbit-1');
  assert.equal(ctx.marketsByKey.size, 1);
  assert.deepEqual(ctx.marketsByKey.get('sol:sol-earth-orbit-1'), normalized);
});

test('cacheMarket returns null when normalized market lacks key parts', () => {
  const ctx = createCtx({
    normalizeMarket() {
      return { marketId: '', solarSystemId: '' };
    },
  });

  const result = marketOperationsService.cacheMarket(ctx, { marketId: 'x' });

  assert.equal(result, null);
  assert.equal(ctx.marketsByKey.size, 0);
});

test('getMarket resolves by explicit solarSystemId', () => {
  const ctx = createCtx();
  ctx.marketsByKey.set('sol:m1', { marketId: 'm1', solarSystemId: 'sol' });
  ctx.marketsByKey.set('alpha-centauri:m1', { marketId: 'm1', solarSystemId: 'alpha-centauri' });

  const market = marketOperationsService.getMarket(ctx, 'm1', 'alpha-centauri');

  assert.ok(market);
  assert.equal(market.solarSystemId, 'alpha-centauri');
});

test('getMarket falls back to first id match when solarSystemId omitted', () => {
  const ctx = createCtx();
  ctx.marketsByKey.set('sol:m1', { marketId: 'm1', solarSystemId: 'sol' });

  const market = marketOperationsService.getMarket(ctx, 'm1');

  assert.ok(market);
  assert.equal(market.marketId, 'm1');
  assert.equal(market.solarSystemId, 'sol');
});

test('getMarket returns null for invalid/unknown ids', () => {
  const ctx = createCtx();
  ctx.marketsByKey.set('sol:m1', { marketId: 'm1', solarSystemId: 'sol' });

  assert.equal(marketOperationsService.getMarket(ctx, ''), null);
  assert.equal(marketOperationsService.getMarket(ctx, 'missing'), null);
});
