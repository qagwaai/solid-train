'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  buildReport,
  LOCKED_SCHEMA_VERSION,
  LOCKED_FALLBACK_TIERS,
} = require('../scripts/sw13/review-descriptor-size-consistency');
const {
  createDebrisAndAsteroidDescriptorPayload,
  createShipAndStationDescriptorPayload,
  createGateLandmarkDescriptorPayload,
} = require('../src/model/external-object-descriptor-payloads');

const AUTHORITATIVE_MAX_DESCRIPTOR_BYTES_BY_DOMAIN = Object.freeze({
  asteroids: 330,
  debris: 310,
  gates: 328,
  ships: 314,
  stations: 332,
});
const AUTHORITATIVE_PAYLOAD_BYTES_BY_BUNDLE = Object.freeze({
  m1DebrisAsteroids: 3320,
  m2ShipsStations: 3694,
  m3GateLandmarks: 2517,
});
const AUTHORITATIVE_MAX_GATE_METADATA_BYTES = 214;

const EXPECTED_REPORT_PATH = path.join(
  __dirname,
  'fixtures',
  'sw13',
  'sw13-m4-size-consistency-report.json'
);
const DESCRIPTOR_PAYLOAD_SCHEMA_PATH = path.join(
  __dirname,
  '..',
  'api',
  'schemas',
  'external-object-descriptor-payload.schema.json'
);
const GATE_PAYLOAD_SCHEMA_PATH = path.join(
  __dirname,
  '..',
  'api',
  'schemas',
  'external-object-gate-landmark-payload.schema.json'
);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

test('SW-13 M4 size and consistency review is deterministic and fixture-aligned', () => {
  const expected = readJson(EXPECTED_REPORT_PATH);
  const actual = buildReport(path.resolve(__dirname, '..'));

  assert.deepEqual(actual, expected);
});

test('SW-13 M4 lock checks remain enforced for descriptor payload consistency', () => {
  const report = buildReport(path.resolve(__dirname, '..'));
  const checks = report.summary.consistencyChecks;

  assert.equal(report.summary.lockedSchemaVersion, LOCKED_SCHEMA_VERSION);
  assert.deepEqual(report.summary.lockedFallbackTiers, LOCKED_FALLBACK_TIERS);

  assert.equal(checks.schemaVersionLocked, true);
  assert.equal(checks.fallbackTierLocked, true);
  assert.equal(checks.descriptorShapeConsistent, true);
  assert.equal(checks.approachMetadataShapeConsistent, true);
  assert.equal(checks.noLegacyFallbackFields, true);
  assert.equal(checks.deterministicOrdering, true);

  assert.equal(report.summary.payloadByteSizeByBundle.m1DebrisAsteroids > 0, true);
  assert.equal(report.summary.payloadByteSizeByBundle.m2ShipsStations > 0, true);
  assert.equal(report.summary.payloadByteSizeByBundle.m3GateLandmarks > 0, true);

  assert.equal(report.summary.descriptorCountByDomain.debris, 4);
  assert.equal(report.summary.descriptorCountByDomain.asteroids, 4);
  assert.equal(report.summary.descriptorCountByDomain.ships, 5);
  assert.equal(report.summary.descriptorCountByDomain.stations, 4);
  assert.equal(report.summary.descriptorCountByDomain.gates, 3);

  assert.equal(
    report.summary.descriptorSizeByDomain.asteroids.max,
    AUTHORITATIVE_MAX_DESCRIPTOR_BYTES_BY_DOMAIN.asteroids
  );
  assert.equal(
    report.summary.descriptorSizeByDomain.debris.max,
    AUTHORITATIVE_MAX_DESCRIPTOR_BYTES_BY_DOMAIN.debris
  );
  assert.equal(
    report.summary.descriptorSizeByDomain.ships.max,
    AUTHORITATIVE_MAX_DESCRIPTOR_BYTES_BY_DOMAIN.ships
  );
  assert.equal(
    report.summary.descriptorSizeByDomain.stations.max,
    AUTHORITATIVE_MAX_DESCRIPTOR_BYTES_BY_DOMAIN.stations
  );
  assert.equal(
    report.summary.descriptorSizeByDomain.gates.max,
    AUTHORITATIVE_MAX_DESCRIPTOR_BYTES_BY_DOMAIN.gates
  );

  assert.equal(
    report.summary.payloadByteSizeByBundle.m1DebrisAsteroids,
    AUTHORITATIVE_PAYLOAD_BYTES_BY_BUNDLE.m1DebrisAsteroids
  );
  assert.equal(
    report.summary.payloadByteSizeByBundle.m2ShipsStations,
    AUTHORITATIVE_PAYLOAD_BYTES_BY_BUNDLE.m2ShipsStations
  );
  assert.equal(
    report.summary.payloadByteSizeByBundle.m3GateLandmarks,
    AUTHORITATIVE_PAYLOAD_BYTES_BY_BUNDLE.m3GateLandmarks
  );
  assert.equal(
    report.summary.approachMetadataSize.gateApproachMetadata.max,
    AUTHORITATIVE_MAX_GATE_METADATA_BYTES
  );
});

test('SW-13 M4 schema envelopes keep bounded payload item counts', () => {
  const descriptorPayloadSchema = readJson(DESCRIPTOR_PAYLOAD_SCHEMA_PATH);
  const gatePayloadSchema = readJson(GATE_PAYLOAD_SCHEMA_PATH);

  assert.equal(descriptorPayloadSchema.properties.descriptors.maxItems, 16);
  assert.equal(gatePayloadSchema.properties.gates.maxItems, 3);
});

test('SW-13 M4 runtime payloads enforce authoritative envelope guardrails', () => {
  const m1Payload = createDebrisAndAsteroidDescriptorPayload();
  const m2Payload = createShipAndStationDescriptorPayload();
  const m3Payload = createGateLandmarkDescriptorPayload();

  assert.equal(m1Payload.descriptors.length <= 16, true);
  assert.equal(m2Payload.descriptors.length <= 16, true);
  assert.equal(m3Payload.gates.length <= 3, true);
});
