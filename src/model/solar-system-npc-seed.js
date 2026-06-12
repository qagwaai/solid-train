'use strict';

const SOLAR_SYSTEM_NPC_SEED_VERSION = '2026-06-sol-v1';
const SOLAR_SYSTEM_NPC_SEED_STATE_KEY = 'solar-system-npc-seed-state';
const MARKET_OWNER_STATE_KEY = 'market-owner-state-v1';

const SOL_MARKET_OWNER_NPCS = [
  {
    npcId: 'sol-belt-02-market-owner-elias-fujimoto',
    solarSystemId: 'sol',
    marketId: 'sol-belt-02',
    marketName: 'Belt Prospectors Exchange',
    locationName: 'Inner Belt Relay 02',
    name: 'Elias Fujimoto',
    deterministicSeed: 'sol-belt-02-market-owner-elias-fujimoto-v1',
    appliedOverrides: [
      'faceShape',
      'skinTone',
      'hairStyle',
      'hairColor',
      'eyeStyle',
      'eyeColor',
      'expressionPreset',
      'apparelAccent',
      'facialHair',
      'scar',
      'tattoo',
    ],
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
    credits: {
      current: 4200,
      seeded: 4200,
      variableRange: {
        min: 3200,
        max: 5400,
      },
    },
  },
];

function buildSeededNpc(entry, asOfTimestamp) {
  return {
    npcId: entry.npcId,
    solarSystemId: entry.solarSystemId,
    marketId: entry.marketId,
    marketName: entry.marketName,
    locationName: entry.locationName,
    name: entry.name,
    deterministicSeed: entry.deterministicSeed,
    appliedOverrides: Array.isArray(entry.appliedOverrides) ? [...entry.appliedOverrides] : [],
    descriptor: {
      ...entry.descriptor,
    },
    credits: {
      current: entry.credits.current,
      seeded: entry.credits.seeded,
      variableRange: {
        min: entry.credits.variableRange.min,
        max: entry.credits.variableRange.max,
      },
    },
    seededAt: asOfTimestamp,
  };
}

function buildSeededNpcsForSolarSystem(solarSystemId, asOfTimestamp) {
  const normalizedSolarSystemId =
    typeof solarSystemId === 'string' ? solarSystemId.trim().toLowerCase() : '';
  const seededAt =
    typeof asOfTimestamp === 'string' && asOfTimestamp.trim()
      ? asOfTimestamp.trim()
      : new Date().toISOString();

  if (!normalizedSolarSystemId) {
    return [];
  }

  return SOL_MARKET_OWNER_NPCS.filter((entry) => entry.solarSystemId === normalizedSolarSystemId).map(
    (entry) => buildSeededNpc(entry, seededAt)
  );
}

module.exports = {
  SOLAR_SYSTEM_NPC_SEED_VERSION,
  SOLAR_SYSTEM_NPC_SEED_STATE_KEY,
  MARKET_OWNER_STATE_KEY,
  buildSeededNpcsForSolarSystem,
};