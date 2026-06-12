'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  SOLAR_SYSTEM_NPC_SEED_VERSION,
  buildSeededNpcsForSolarSystem,
} = require('../src/model/solar-system-npc-seed');

test('buildSeededNpcsForSolarSystem returns Elias Fujimoto for sol', () => {
  const seeded = buildSeededNpcsForSolarSystem('sol', '2026-06-12T00:00:00.000Z');

  assert.equal(SOLAR_SYSTEM_NPC_SEED_VERSION, '2026-06-sol-v1');
  assert.equal(seeded.length, 1);
  assert.deepEqual(seeded[0], {
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
    seededAt: '2026-06-12T00:00:00.000Z',
  });
});

test('buildSeededNpcsForSolarSystem returns empty for unsupported systems', () => {
  assert.deepEqual(buildSeededNpcsForSolarSystem('alpha-centauri', '2026-06-12T00:00:00.000Z'), []);
  assert.deepEqual(buildSeededNpcsForSolarSystem('', '2026-06-12T00:00:00.000Z'), []);
});