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

test('in-memory defaults resolve station hosts in every default system', async () => {
  const context = createContext();
  await context.initializeAsync();

  for (const solarSystemId of ['sol', 'alpha-centauri', 'barnards-star']) {
    const markets = await context.getMarketsAsync({ solarSystemId });
    const stations = markets.filter((market) => market.siteType === 'station');
    assert.ok(stations.length > 0);
    for (const station of stations) {
      const host = context.celestialBodiesById.get(station.trajectory.orbit.anchorBodyId);
      assert.ok(host);
      assert.equal(station.spatial.epochMs, host.spatial.epochMs);
      assert.equal(station.spatial.solarSystemId, solarSystemId);
    }
  }
});

test('default host seeding preserves supplied celestial snapshots', async () => {
  const context = createContext();
  const host = {
    id: 'sol-earth',
    spatial: {
      solarSystemId: 'sol',
      frame: 'barycentric',
      positionKm: { x: 123, y: 456, z: 789 },
      epochMs: Date.parse('2026-01-01T00:00:00.000Z'),
    },
  };
  context.celestialBodiesById.set(host.id, host);

  await context.initializeAsync();

  assert.equal(context.celestialBodiesById.get(host.id), host);
  const markets = await context.getMarketsAsync({ solarSystemId: 'sol' });
  assert.equal(
    markets.find((market) => market.marketId === 'sol-earth-orbit').spatial.epochMs,
    host.spatial.epochMs
  );
});

test('database-backed defaults do not fabricate cached celestial hosts', async () => {
  const context = createContext();
  context.databaseService = {};

  await context.initializeAsync();

  assert.equal(context.celestialBodiesById.size, 0);
});

test('disabled default seeding leaves markets and celestial hosts untouched', async () => {
  const context = createContext();

  const result = await context.initializeAsync({ seedDefaults: false });

  assert.equal(result.seededDefaults, false);
  assert.equal(context.marketsByKey.size, 0);
  assert.equal(context.celestialBodiesById.size, 0);
});
