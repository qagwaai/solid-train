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
  createGateDescriptorPayloads,
  createGateLandmarkDescriptorPayload,
} = require('../src/model/external-object-descriptor-payloads');

const FIXTURE_PATH = path.join(__dirname, 'fixtures', 'sw13', 'external-object-gate-landmark-m3.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

test('SW-13 M3 gate landmark payload is deterministic and fixture-aligned', () => {
  const payload = createGateLandmarkDescriptorPayload();
  const fixture = readJson(FIXTURE_PATH);

  assert.equal(payload.schemaVersion, EXTERNAL_OBJECT_SCHEMA_VERSION);
  assert.deepEqual(payload, fixture);
  assert.equal(payload.gates.length, 3);

  const descriptorIds = payload.gates.map((entry) => entry.descriptor.descriptorId);
  assert.deepEqual(descriptorIds, [...descriptorIds].sort());

  const families = payload.gates.map((entry) => entry.descriptor.objectFamily).sort();
  assert.deepEqual(
    families,
    ['relay-spindle', 'ring-gate', 'segmented-arch'],
    'each M3 route-smoke run must include all gate families'
  );
});

test('SW-13 M3 gate descriptors remain in canonical gate scope', () => {
  const descriptors = createGateDescriptorPayloads();

  assert.equal(descriptors.length, 3);
  assert.ok(
    descriptors.every((entry) => entry.domain === EXTERNAL_OBJECT_DOMAIN.GATES),
    'expected all M3 descriptors to remain in gates domain'
  );

  const families = descriptors.map((entry) => entry.objectFamily).sort();
  assert.deepEqual(families, ['relay-spindle', 'ring-gate', 'segmented-arch']);

  const fallbackTiers = new Set(descriptors.map((entry) => entry.fallbackTier));
  assert.deepEqual([...fallbackTiers].sort(), ['hero', 'minimal', 'standard']);
});

test('SW-13 M3 approach metadata is complete and bounded', () => {
  const payload = createGateLandmarkDescriptorPayload();

  for (const entry of payload.gates) {
    const metadata = entry.approachMetadata;
    assert.ok(metadata.approachCue);
    assert.ok(metadata.landmarkFraming);
    assert.ok(metadata.navBeaconCue);
    assert.ok(metadata.hazardCue);
    assert.ok(metadata.warningEscalation);
    assert.ok(metadata.recommendedStandOffKm > 0);
    assert.ok(metadata.approachWindowKm.min > 0);
    assert.ok(metadata.approachWindowKm.max > metadata.approachWindowKm.min);
    assert.ok(metadata.recommendedStandOffKm >= metadata.approachWindowKm.min);
    assert.ok(metadata.recommendedStandOffKm <= metadata.approachWindowKm.max);
  }

  const mediumHazard = payload.gates.filter((entry) => entry.approachMetadata.hazardCue === 'medium');
  assert.ok(mediumHazard.length > 0, 'expected medium hazard coverage in M3 baseline');
  assert.ok(
    mediumHazard.every((entry) => entry.approachMetadata.warningEscalation === 'required'),
    'medium hazard must enforce mandatory warning escalation'
  );

  const lowHazard = payload.gates.filter((entry) => entry.approachMetadata.hazardCue === 'low');
  assert.ok(
    lowHazard.every((entry) => entry.approachMetadata.warningEscalation === 'none'),
    'low hazard should not enforce mandatory warning escalation'
  );
});
