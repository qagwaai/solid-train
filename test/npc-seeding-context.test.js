'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { MessageHandlerContext } = require('../src/handlers/message-handler-context');
const { SOLAR_SYSTEM_NPC_SEED_VERSION } = require('../src/model/solar-system-npc-seed');

function createContextWithDb(db, logs) {
  let nextId = 0;
  return new MessageHandlerContext({
    databaseService: db,
    log: (line) => logs.push(line),
    createId: () => `id-${++nextId}`,
    getCurrentTimestamp: () => '2026-06-12T00:00:00.000Z',
  });
}

test('seedSolarSystemNpcsAsync upserts seeded NPCs, owner state, and logs each seeded NPC', async () => {
  const logs = [];
  const ownerUpserts = [];
  const bustUpserts = [];
  let stateWrite = null;
  const db = {
    async getSolarSystemNpcSeedState() {
      return null;
    },
    async upsertNpcBust(npcId, deterministicSeed, descriptor, appliedOverrides) {
      bustUpserts.push({ npcId, deterministicSeed, descriptor, appliedOverrides });
      return bustUpserts[bustUpserts.length - 1];
    },
    async upsertSeededNpcOwner(ownerRecord) {
      ownerUpserts.push(ownerRecord);
      return ownerRecord;
    },
    async setSolarSystemNpcSeedState(solarSystemId, seedVersion, seededAt) {
      stateWrite = { solarSystemId, seedVersion, seededAt };
      return stateWrite;
    },
  };

  const context = createContextWithDb(db, logs);

  const result = await context.seedSolarSystemNpcsAsync({ solarSystemId: 'sol' });

  assert.equal(result.success, true);
  assert.equal(result.source, 'database-upsert');
  assert.equal(result.npcCount, 1);
  assert.deepEqual(result.seededNpcIds, ['sol-belt-02-market-owner-elias-fujimoto']);
  assert.equal(result.seededOwners.length, 1);
  assert.equal(result.seededOwners[0].marketId, 'sol-belt-02');
  assert.equal(result.seededOwners[0].name, 'Elias Fujimoto');
  assert.equal(bustUpserts.length, 1);
  assert.equal(ownerUpserts.length, 1);
  assert.equal(stateWrite.solarSystemId, 'sol');
  assert.equal(stateWrite.seedVersion, SOLAR_SYSTEM_NPC_SEED_VERSION);
  assert.equal(stateWrite.seededAt, '2026-06-12T00:00:00.000Z');
  assert.ok(
    logs.some((line) =>
      line.includes('Seeded NPC sol-belt-02-market-owner-elias-fujimoto (Elias Fujimoto)')
    )
  );
});

test('seedSolarSystemNpcsAsync uses cached database owners when seed version is current', async () => {
  let ownerUpsertCalls = 0;
  let stateWriteCalls = 0;
  const db = {
    async getSolarSystemNpcSeedState() {
      return {
        solarSystemId: 'sol',
        seedVersion: SOLAR_SYSTEM_NPC_SEED_VERSION,
        seededAt: '2026-06-12T00:00:00.000Z',
      };
    },
    async getSeededNpcOwners() {
      return [
        {
          npcId: 'sol-belt-02-market-owner-elias-fujimoto',
          solarSystemId: 'sol',
          marketId: 'sol-belt-02',
          marketName: 'Belt Prospectors Exchange',
          locationName: 'Inner Belt Relay 02',
          name: 'Elias Fujimoto',
          credits: {
            current: 4200,
            seeded: 4200,
            variableRange: {
              min: 3200,
              max: 5400,
            },
          },
          seededAt: '2026-06-12T00:00:00.000Z',
          updatedAt: '2026-06-12T00:00:00.000Z',
        },
      ];
    },
    async getNpcBust() {
      return {
        npcId: 'sol-belt-02-market-owner-elias-fujimoto',
        deterministicSeed: 'sol-belt-02-market-owner-elias-fujimoto-v1',
        descriptor: {
          schemaVersion: 'sw-15-m1-v1',
          presetVersion: 'v1',
          faceShape: 'square',
          skinTone: 'light',
          hairStyle: 'mid-fade',
          hairColor: 'silver',
          eyeStyle: 'narrow',
          eyeColor: 'amber',
          expressionPreset: 'neutral',
          apparelAccent: 'hood',
          facialHair: 'goatee',
          scar: 'brow-right',
          tattoo: 'neck-left',
        },
        appliedOverrides: [],
      };
    },
    async upsertNpcBust() {
      throw new Error('should not upsert NPC bust when cached version is current');
    },
    async upsertSeededNpcOwner() {
      ownerUpsertCalls += 1;
      return null;
    },
    async setSolarSystemNpcSeedState() {
      stateWriteCalls += 1;
      return null;
    },
  };

  const context = createContextWithDb(db, []);

  const result = await context.seedSolarSystemNpcsAsync({ solarSystemId: 'sol' });

  assert.equal(result.success, true);
  assert.equal(result.source, 'database-cache');
  assert.equal(result.npcCount, 1);
  assert.equal(result.seededOwners.length, 1);
  assert.equal(result.seededOwners[0].npcId, 'sol-belt-02-market-owner-elias-fujimoto');
  assert.equal(ownerUpsertCalls, 0);
  assert.equal(stateWriteCalls, 0);
  assert.ok(context.npcBustsById.has('sol-belt-02-market-owner-elias-fujimoto'));
});

test('seedSolarSystemNpcsAsync caches seeded owner records for runtime queries', async () => {
  const context = createContextWithDb(null, []);

  const result = await context.seedSolarSystemNpcsAsync({ solarSystemId: 'sol' });

  assert.equal(result.success, true);
  assert.equal(result.seededOwners.length, 1);
  assert.equal(result.seededOwners[0].locationName, 'Inner Belt Relay 02');
  const byNpcId = context.getSeededNpcOwner('sol-belt-02-market-owner-elias-fujimoto');
  assert.equal(byNpcId.name, 'Elias Fujimoto');
  assert.equal(byNpcId.marketId, 'sol-belt-02');

  const byMarket = await context.getMarketOwnerAsync('sol-belt-02', 'sol');
  assert.equal(byMarket.npcId, 'sol-belt-02-market-owner-elias-fujimoto');

  const allSolOwners = await context.getSeededNpcOwnersAsync({ solarSystemId: 'sol' });
  assert.equal(allSolOwners.length, 1);
});

test('getSolarSystemNpcSeedSummaryAsync returns seeded owner summary for a system', async () => {
  const context = createContextWithDb(null, []);

  await context.seedSolarSystemNpcsAsync({ solarSystemId: 'sol' });

  const summary = await context.getSolarSystemNpcSeedSummaryAsync('sol');

  assert.equal(summary.solarSystemId, 'sol');
  assert.equal(summary.npcCount, 1);
  assert.deepEqual(summary.seededNpcIds, ['sol-belt-02-market-owner-elias-fujimoto']);
  assert.equal(summary.seededOwners.length, 1);
  assert.equal(summary.seededOwners[0].marketId, 'sol-belt-02');
  assert.equal(summary.seededOwners[0].name, 'Elias Fujimoto');
});

test('getSolarSystemNpcSeedSummaryAsync returns empty summary for unsupported system cache', async () => {
  const context = createContextWithDb(null, []);

  const summary = await context.getSolarSystemNpcSeedSummaryAsync('alpha-centauri');

  assert.equal(summary.solarSystemId, 'alpha-centauri');
  assert.equal(summary.npcCount, 0);
  assert.deepEqual(summary.seededNpcIds, []);
  assert.deepEqual(summary.seededOwners, []);
});

test('getSeededNpcOwnersAsync hydrates owner cache from database queries', async () => {
  const db = {
    async getSeededNpcOwners() {
      return [
        {
          npcId: 'sol-belt-03-market-owner-zoe-vasquez',
          solarSystemId: 'sol',
          marketId: 'sol-belt-03',
          marketName: 'Belt Drift Market',
          locationName: 'Outer Belt Relay 03',
          name: 'Zoe Vasquez',
          credits: {
            current: 3900,
            seeded: 3900,
            variableRange: {
              min: 3000,
              max: 5000,
            },
          },
          seededAt: '2026-06-12T00:00:00.000Z',
          updatedAt: '2026-06-12T00:00:00.000Z',
        },
        {
          npcId: 'sol-belt-02-market-owner-elias-fujimoto',
          solarSystemId: 'sol',
          marketId: 'sol-belt-02',
          marketName: 'Belt Prospectors Exchange',
          locationName: 'Inner Belt Relay 02',
          name: 'Elias Fujimoto',
          credits: {
            current: 4200,
            seeded: 4200,
            variableRange: {
              min: 3200,
              max: 5400,
            },
          },
          seededAt: '2026-06-12T00:00:00.000Z',
          updatedAt: '2026-06-12T00:00:00.000Z',
        },
      ];
    },
  };

  const context = createContextWithDb(db, []);
  const owners = await context.getSeededNpcOwnersAsync({ solarSystemId: 'sol' });

  assert.equal(owners.length, 2);
  assert.equal(owners[0].marketId, 'sol-belt-02');
  assert.equal(owners[0].name, 'Elias Fujimoto');
  assert.equal(owners[1].marketId, 'sol-belt-03');
  assert.ok(context.seededNpcOwnersById.has('sol-belt-02-market-owner-elias-fujimoto'));
});

test('getMarketOwnerProfileAsync returns owner state joined with NPC bust', async () => {
  const context = createContextWithDb(null, []);

  await context.seedSolarSystemNpcsAsync({ solarSystemId: 'sol' });

  const profile = await context.getMarketOwnerProfileAsync('sol-belt-02', 'sol');

  assert.equal(profile.npcId, 'sol-belt-02-market-owner-elias-fujimoto');
  assert.equal(profile.name, 'Elias Fujimoto');
  assert.equal(profile.marketId, 'sol-belt-02');
  assert.equal(profile.bust.descriptor.faceShape, 'square');
  assert.equal(profile.bust.descriptor.hairColor, 'silver');
});

test('getSeededNpcProfilesAsync returns seeded NPC profiles in bulk', async () => {
  const context = createContextWithDb(null, []);

  await context.seedSolarSystemNpcsAsync({ solarSystemId: 'sol' });

  const profiles = await context.getSeededNpcProfilesAsync({ solarSystemId: 'sol' });

  assert.equal(profiles.length, 1);
  assert.equal(profiles[0].npcId, 'sol-belt-02-market-owner-elias-fujimoto');
  assert.equal(profiles[0].marketId, 'sol-belt-02');
  assert.equal(profiles[0].bust.descriptor.expressionPreset, 'neutral');
});

test('getSeededNpcProfilesAsync filters by marketId', async () => {
  const context = createContextWithDb(null, []);

  await context.seedSolarSystemNpcsAsync({ solarSystemId: 'sol' });

  const matching = await context.getSeededNpcProfilesAsync({ marketId: 'sol-belt-02' });
  const missing = await context.getSeededNpcProfilesAsync({ marketId: 'missing-market' });

  assert.equal(matching.length, 1);
  assert.equal(matching[0].name, 'Elias Fujimoto');
  assert.equal(missing.length, 0);
});

test('getSeededNpcProfilesWithOwnedMarketsAsync returns profiles joined with owned markets', async () => {
  const context = createContextWithDb(null, []);

  await context.initializeAsync({ seedDefaults: true });

  const profiles = await context.getSeededNpcProfilesWithOwnedMarketsAsync({
    solarSystemId: 'sol',
  });

  assert.equal(profiles.length, 1);
  assert.equal(profiles[0].npcId, 'sol-belt-02-market-owner-elias-fujimoto');
  assert.equal(profiles[0].ownedMarkets.length, 1);
  assert.equal(profiles[0].ownedMarkets[0].marketId, 'sol-belt-02');
  assert.equal(
    profiles[0].ownedMarkets[0].owner.npcId,
    'sol-belt-02-market-owner-elias-fujimoto'
  );
});

test('getSeededNpcProfilesWithOwnedMarketsAsync returns empty for unmatched filters', async () => {
  const context = createContextWithDb(null, []);

  await context.initializeAsync({ seedDefaults: true });

  const profiles = await context.getSeededNpcProfilesWithOwnedMarketsAsync({
    solarSystemId: 'alpha-centauri',
  });

  assert.deepEqual(profiles, []);
});

test('getNpcOwnedMarketsAsync returns markets owned by seeded NPC', async () => {
  const context = createContextWithDb(null, []);

  await context.initializeAsync({ seedDefaults: true });

  const markets = await context.getNpcOwnedMarketsAsync(
    'sol-belt-02-market-owner-elias-fujimoto'
  );

  assert.equal(markets.length, 1);
  assert.equal(markets[0].marketId, 'sol-belt-02');
  assert.equal(markets[0].owner.npcId, 'sol-belt-02-market-owner-elias-fujimoto');
  assert.equal(markets[0].owner.name, 'Elias Fujimoto');
});

test('getNpcOwnedMarketsAsync returns empty for unknown NPC ids', async () => {
  const context = createContextWithDb(null, []);

  const markets = await context.getNpcOwnedMarketsAsync('missing-npc-id');

  assert.deepEqual(markets, []);
});

test('credit read helpers return seeded NPC credits by npc and by market', async () => {
  const context = createContextWithDb(null, []);

  await context.seedSolarSystemNpcsAsync({ solarSystemId: 'sol' });

  const byNpc = await context.getSeededNpcCreditsAsync(
    'sol-belt-02-market-owner-elias-fujimoto'
  );
  const byMarket = await context.getMarketOwnerCreditsAsync('sol-belt-02', 'sol');

  assert.equal(byNpc.current, 4200);
  assert.equal(byNpc.seeded, 4200);
  assert.equal(byMarket.current, 4200);
  assert.equal(byMarket.variableRange.min, 3200);
  assert.equal(byMarket.variableRange.max, 5400);
});

test('credit read helpers return null for unknown npc or market', async () => {
  const context = createContextWithDb(null, []);

  assert.equal(await context.getSeededNpcCreditsAsync('missing-npc'), null);
  assert.equal(await context.getMarketOwnerCreditsAsync('missing-market', 'sol'), null);
});

test('getSeededNpcProfileAsync returns null for unknown NPC ids', async () => {
  const context = createContextWithDb(null, []);

  const profile = await context.getSeededNpcProfileAsync('unknown-npc-id');

  assert.equal(profile, null);
});

test('updateSeededNpcCreditsAsync updates in-memory owner credits and clamps to range', async () => {
  const context = createContextWithDb(null, []);

  await context.seedSolarSystemNpcsAsync({ solarSystemId: 'sol' });

  const updated = await context.updateSeededNpcCreditsAsync(
    'sol-belt-02-market-owner-elias-fujimoto',
    2500,
    '2026-06-12T02:00:00.000Z'
  );

  assert.equal(updated.credits.current, 3200);
  assert.equal(updated.updatedAt, '2026-06-12T02:00:00.000Z');
  assert.equal(
    context.getSeededNpcOwner('sol-belt-02-market-owner-elias-fujimoto').credits.current,
    3200
  );
});

test('updateSeededNpcCreditsAsync persists credit updates when database service is available', async () => {
  const updates = [];
  const db = {
    async getSeededNpcOwners(query = {}) {
      if (query?.npcId === 'sol-belt-02-market-owner-elias-fujimoto') {
        return [
          {
            npcId: 'sol-belt-02-market-owner-elias-fujimoto',
            solarSystemId: 'sol',
            marketId: 'sol-belt-02',
            marketName: 'Belt Prospectors Exchange',
            locationName: 'Inner Belt Relay 02',
            name: 'Elias Fujimoto',
            credits: {
              current: 4200,
              seeded: 4200,
              variableRange: {
                min: 3200,
                max: 5400,
              },
            },
            seededAt: '2026-06-12T00:00:00.000Z',
            updatedAt: '2026-06-12T00:00:00.000Z',
          },
        ];
      }

      return [];
    },
    async getNpcBust() {
      return {
        npcId: 'sol-belt-02-market-owner-elias-fujimoto',
        deterministicSeed: 'sol-belt-02-market-owner-elias-fujimoto-v1',
        descriptor: {
          schemaVersion: 'sw-15-m1-v1',
          presetVersion: 'v1',
          faceShape: 'square',
          skinTone: 'light',
          hairStyle: 'mid-fade',
          hairColor: 'silver',
          eyeStyle: 'narrow',
          eyeColor: 'amber',
          expressionPreset: 'neutral',
          apparelAccent: 'hood',
          facialHair: 'goatee',
          scar: 'brow-right',
          tattoo: 'neck-left',
        },
        appliedOverrides: [],
      };
    },
    async updateSeededNpcOwnerCredits(npcId, currentCredits, updatedAt) {
      updates.push({ npcId, currentCredits, updatedAt });
      return {
        npcId,
        solarSystemId: 'sol',
        marketId: 'sol-belt-02',
        marketName: 'Belt Prospectors Exchange',
        locationName: 'Inner Belt Relay 02',
        name: 'Elias Fujimoto',
        credits: {
          current: currentCredits,
          seeded: 4200,
          variableRange: {
            min: 3200,
            max: 5400,
          },
        },
        seededAt: '2026-06-12T00:00:00.000Z',
        updatedAt,
      };
    },
  };

  const context = createContextWithDb(db, []);
  const updated = await context.updateSeededNpcCreditsAsync(
    'sol-belt-02-market-owner-elias-fujimoto',
    5100,
    '2026-06-12T03:00:00.000Z'
  );

  assert.equal(updates.length, 1);
  assert.equal(updates[0].currentCredits, 5100);
  assert.equal(updated.credits.current, 5100);
  assert.equal(updated.updatedAt, '2026-06-12T03:00:00.000Z');
});

test('adjustSeededNpcCreditsAsync applies delta and clamps to allowed range', async () => {
  const context = createContextWithDb(null, []);

  await context.seedSolarSystemNpcsAsync({ solarSystemId: 'sol' });

  const increased = await context.adjustSeededNpcCreditsAsync(
    'sol-belt-02-market-owner-elias-fujimoto',
    500,
    '2026-06-12T04:00:00.000Z'
  );
  assert.equal(increased.credits.current, 4700);

  const clamped = await context.adjustSeededNpcCreditsAsync(
    'sol-belt-02-market-owner-elias-fujimoto',
    -5000,
    '2026-06-12T05:00:00.000Z'
  );
  assert.equal(clamped.credits.current, 3200);
  assert.equal(clamped.updatedAt, '2026-06-12T05:00:00.000Z');
});

test('adjustSeededNpcCreditsAsync persists delta-based updates when database service is available', async () => {
  const updates = [];
  const db = {
    async getSeededNpcOwners(query = {}) {
      if (query?.npcId === 'sol-belt-02-market-owner-elias-fujimoto') {
        return [
          {
            npcId: 'sol-belt-02-market-owner-elias-fujimoto',
            solarSystemId: 'sol',
            marketId: 'sol-belt-02',
            marketName: 'Belt Prospectors Exchange',
            locationName: 'Inner Belt Relay 02',
            name: 'Elias Fujimoto',
            credits: {
              current: 4200,
              seeded: 4200,
              variableRange: {
                min: 3200,
                max: 5400,
              },
            },
            seededAt: '2026-06-12T00:00:00.000Z',
            updatedAt: '2026-06-12T00:00:00.000Z',
          },
        ];
      }

      return [];
    },
    async getNpcBust() {
      return {
        npcId: 'sol-belt-02-market-owner-elias-fujimoto',
        deterministicSeed: 'sol-belt-02-market-owner-elias-fujimoto-v1',
        descriptor: {
          schemaVersion: 'sw-15-m1-v1',
          presetVersion: 'v1',
          faceShape: 'square',
          skinTone: 'light',
          hairStyle: 'mid-fade',
          hairColor: 'silver',
          eyeStyle: 'narrow',
          eyeColor: 'amber',
          expressionPreset: 'neutral',
          apparelAccent: 'hood',
          facialHair: 'goatee',
          scar: 'brow-right',
          tattoo: 'neck-left',
        },
        appliedOverrides: [],
      };
    },
    async updateSeededNpcOwnerCredits(npcId, currentCredits, updatedAt) {
      updates.push({ npcId, currentCredits, updatedAt });
      return {
        npcId,
        solarSystemId: 'sol',
        marketId: 'sol-belt-02',
        marketName: 'Belt Prospectors Exchange',
        locationName: 'Inner Belt Relay 02',
        name: 'Elias Fujimoto',
        credits: {
          current: currentCredits,
          seeded: 4200,
          variableRange: {
            min: 3200,
            max: 5400,
          },
        },
        seededAt: '2026-06-12T00:00:00.000Z',
        updatedAt,
      };
    },
  };

  const context = createContextWithDb(db, []);
  const updated = await context.adjustSeededNpcCreditsAsync(
    'sol-belt-02-market-owner-elias-fujimoto',
    300,
    '2026-06-12T06:00:00.000Z'
  );

  assert.equal(updates.length, 1);
  assert.equal(updates[0].currentCredits, 4500);
  assert.equal(updated.credits.current, 4500);
  assert.equal(updated.updatedAt, '2026-06-12T06:00:00.000Z');
});

test('updateMarketOwnerCreditsAsync updates owner credits via market lookup', async () => {
  const context = createContextWithDb(null, []);

  await context.seedSolarSystemNpcsAsync({ solarSystemId: 'sol' });

  const updated = await context.updateMarketOwnerCreditsAsync(
    'sol-belt-02',
    'sol',
    5000,
    '2026-06-12T07:00:00.000Z'
  );

  assert.equal(updated.npcId, 'sol-belt-02-market-owner-elias-fujimoto');
  assert.equal(updated.credits.current, 5000);
  assert.equal(updated.updatedAt, '2026-06-12T07:00:00.000Z');
});

test('adjustMarketOwnerCreditsAsync applies delta through market lookup', async () => {
  const context = createContextWithDb(null, []);

  await context.seedSolarSystemNpcsAsync({ solarSystemId: 'sol' });

  const updated = await context.adjustMarketOwnerCreditsAsync(
    'sol-belt-02',
    'sol',
    -800,
    '2026-06-12T08:00:00.000Z'
  );

  assert.equal(updated.npcId, 'sol-belt-02-market-owner-elias-fujimoto');
  assert.equal(updated.credits.current, 3400);
  assert.equal(updated.updatedAt, '2026-06-12T08:00:00.000Z');
});

test('market-based credit helpers return null when market owner is missing', async () => {
  const context = createContextWithDb(null, []);

  assert.equal(
    await context.updateMarketOwnerCreditsAsync('missing-market', 'sol', 4000),
    null
  );
  assert.equal(
    await context.adjustMarketOwnerCreditsAsync('missing-market', 'sol', 200),
    null
  );
});