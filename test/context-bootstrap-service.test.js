'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { MessageHandlerContext } = require('../src/handlers/message-handler-context');

function createContext() {
  let nextId = 0;
  return new MessageHandlerContext({
    log: () => {},
    createId: () => `id-${++nextId}`,
    getCurrentTimestamp: () => '2026-06-12T00:00:00.000Z',
  });
}

test('initializeAsync seeds default NPC owner state alongside default markets', async () => {
  const context = createContext();

  const result = await context.initializeAsync({ seedDefaults: true });

  assert.equal(result.success, true);
  assert.equal(result.seededDefaults, true);
  assert.ok(context.marketsByKey.size > 0);
  assert.ok(context.npcBustsById.has('sol-belt-02-market-owner-elias-fujimoto'));
  assert.ok(context.seededNpcOwnersById.has('sol-belt-02-market-owner-elias-fujimoto'));
});

test('initializeAsync seeds default NPC owner state when markets already exist', async () => {
  const context = createContext();
  context.marketsByKey.set('sol:preseeded-market', {
    marketId: 'preseeded-market',
    solarSystemId: 'sol',
    marketName: 'Preseeded Market',
  });

  const result = await context.initializeAsync({ seedDefaults: true });

  assert.equal(result.success, true);
  assert.equal(result.seededDefaults, true);
  assert.ok(context.npcBustsById.has('sol-belt-02-market-owner-elias-fujimoto'));
  assert.ok(context.seededNpcOwnersById.has('sol-belt-02-market-owner-elias-fujimoto'));
});