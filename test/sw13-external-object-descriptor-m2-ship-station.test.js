'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  EXTERNAL_OBJECT_DOMAIN,
  EXTERNAL_OBJECT_SCHEMA_VERSION,
} = require('../src/model/external-object-descriptor');
const {
  createShipDescriptorPayloads,
  createStationDescriptorPayloads,
  createShipAndStationDescriptorPayload,
} = require('../src/model/external-object-descriptor-payloads');

const FIXTURE_PATH = path.join(
  __dirname,
  'fixtures',
  'sw13',
  'external-object-descriptor-m2-ships-stations.json'
);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

test('SW-13 M2 ship and station payload is deterministic and fixture-aligned', () => {
  const payload = createShipAndStationDescriptorPayload();
  const fixture = readJson(FIXTURE_PATH);

  assert.equal(payload.schemaVersion, EXTERNAL_OBJECT_SCHEMA_VERSION);
  assert.deepEqual(payload, fixture);
  assert.equal(payload.descriptors.length, 9, 'expected full-9 canonical M2 descriptor coverage');

  const domains = new Set(payload.descriptors.map((entry) => entry.domain));
  assert.deepEqual(
    [...domains].sort(),
    [EXTERNAL_OBJECT_DOMAIN.SHIPS, EXTERNAL_OBJECT_DOMAIN.STATIONS].sort(),
    'M2 fixture must stay scoped to ships and stations only'
  );

  const tiers = new Set(payload.descriptors.map((entry) => entry.fallbackTier));
  assert.deepEqual(
    [...tiers].sort(),
    ['hero', 'minimal', 'standard'],
    'M2 evidence must include tier-behavior coverage for hero/standard/minimal'
  );

  const byTier = {
    hero: payload.descriptors.filter((entry) => entry.fallbackTier === 'hero'),
    standard: payload.descriptors.filter((entry) => entry.fallbackTier === 'standard'),
    minimal: payload.descriptors.filter((entry) => entry.fallbackTier === 'minimal'),
  };

  assert.ok(byTier.hero.length > 0, 'expected at least one hero-tier descriptor');
  assert.ok(byTier.standard.length > 0, 'expected at least one standard-tier descriptor');
  assert.ok(byTier.minimal.length > 0, 'expected at least one minimal-tier descriptor');

  assert.ok(
    byTier.hero.every((entry) => ['medium', 'high', 'navigation'].includes(entry.emissiveProfile)),
    'hero-tier descriptors must preserve high-signal emissive behavior'
  );
  assert.ok(
    byTier.minimal.every((entry) => ['none', 'low'].includes(entry.emissiveProfile)),
    'minimal-tier descriptors must preserve restrained emissive behavior'
  );
});

test('SW-13 M2 ship descriptors are canonical and stable', () => {
  const descriptors = createShipDescriptorPayloads();

  assert.equal(descriptors.length, 5);
  assert.ok(
    descriptors.every((entry) => entry.domain === EXTERNAL_OBJECT_DOMAIN.SHIPS),
    'expected all ship descriptors to use ships domain'
  );
  assert.ok(
    descriptors.every((entry) => entry.roleCue && entry.factionCue),
    'expected stable role/faction identity cues on all ship descriptors'
  );

  const descriptorIds = descriptors.map((entry) => entry.descriptorId);
  assert.deepEqual(descriptorIds, [...descriptorIds].sort());
});

test('SW-13 M2 station descriptors are canonical and stable', () => {
  const descriptors = createStationDescriptorPayloads();

  assert.equal(descriptors.length, 4);
  assert.ok(
    descriptors.every((entry) => entry.domain === EXTERNAL_OBJECT_DOMAIN.STATIONS),
    'expected all station descriptors to use stations domain'
  );
  assert.ok(
    descriptors.every((entry) => entry.roleCue && entry.factionCue),
    'expected stable role/faction identity cues on all station descriptors'
  );

  const descriptorIds = descriptors.map((entry) => entry.descriptorId);
  assert.deepEqual(descriptorIds, [...descriptorIds].sort());
});
