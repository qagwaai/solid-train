'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { MISSION_STATUS_VALUES } = require('../src/model/mission');

const ROOT = path.resolve(__dirname, '..');
const OPENAPI_PATH = path.join(ROOT, 'api', 'openapi', 'mission', 'openapi.yaml');
const SCHEMAS_DIR = path.join(ROOT, 'api', 'schemas');
const NEGATIVE_FIXTURE_PATH = path.join(
  ROOT,
  'test',
  'fixtures',
  'sw01',
  'mission-status-invalid-request.json'
);

const CANONICAL_MISSION_STATUSES = Object.freeze(['available', 'active', 'completed']);

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(readText(filePath));
}

function extractSocketSection(openApiText, route) {
  const startToken = `  ${route}:`;
  const start = openApiText.indexOf(startToken);
  if (start < 0) {
    return '';
  }

  const afterStart = openApiText.slice(start);
  const nextPathMatch = afterStart.match(/\n  \/socket\/[a-z0-9-]+:/i);
  if (!nextPathMatch || typeof nextPathMatch.index !== 'number') {
    return afterStart;
  }

  return afterStart.slice(0, nextPathMatch.index);
}

function sortValues(values) {
  return [...values].sort();
}

test('runtime mission status registry is canonical-only', () => {
  assert.deepEqual(sortValues(MISSION_STATUS_VALUES), sortValues(CANONICAL_MISSION_STATUSES));
});

test('mission schemas constrain status enums to canonical-only values', () => {
  const missionListRequest = readJson(path.join(SCHEMAS_DIR, 'mission-list-request.schema.json'));
  const missionListResponse = readJson(path.join(SCHEMAS_DIR, 'mission-list-response.schema.json'));
  const missionUpsertRequest = readJson(path.join(SCHEMAS_DIR, 'mission-upsert-request.schema.json'));
  const missionUpsertResponse = readJson(path.join(SCHEMAS_DIR, 'mission-upsert-response.schema.json'));

  assert.deepEqual(
    sortValues(missionListRequest.properties.statuses.items.enum),
    sortValues(CANONICAL_MISSION_STATUSES)
  );
  assert.deepEqual(
    sortValues(missionListResponse.properties.missions.items.properties.status.enum),
    sortValues(CANONICAL_MISSION_STATUSES)
  );
  assert.deepEqual(
    sortValues(missionUpsertRequest.properties.status.enum),
    sortValues(CANONICAL_MISSION_STATUSES)
  );
  assert.deepEqual(
    sortValues(missionUpsertResponse.properties.mission.properties.status.enum),
    sortValues(CANONICAL_MISSION_STATUSES)
  );
});

test('mission schemas remove legacy lifecycle/status detail fields from SW-01 contract', () => {
  const missionUpsertRequest = readJson(path.join(SCHEMAS_DIR, 'mission-upsert-request.schema.json'));
  const missionUpsertResponse = readJson(path.join(SCHEMAS_DIR, 'mission-upsert-response.schema.json'));

  const legacyRequestFields = ['statusDetail'];
  const legacyResponseFields = [
    'startedAt',
    'inProgressAt',
    'failedAt',
    'completedAt',
    'failureReason',
    'statusDetail',
  ];

  for (const field of legacyRequestFields) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(missionUpsertRequest.properties, field),
      false,
      `mission-upsert-request schema must not expose legacy field: ${field}`
    );
  }

  for (const field of legacyResponseFields) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(missionUpsertResponse.properties.mission.properties, field),
      false,
      `mission-upsert-response mission schema must not expose legacy field: ${field}`
    );
  }
});

test('openapi mission sections avoid legacy statuses and show canonical status examples', () => {
  const openApiText = readText(OPENAPI_PATH);
  const missionListSection = extractSocketSection(openApiText, '/socket/mission-list');
  const missionUpsertSection = extractSocketSection(openApiText, '/socket/mission-upsert');

  assert.ok(missionListSection.length > 0, 'mission-list section must exist in openapi.yaml');
  assert.ok(missionUpsertSection.length > 0, 'mission-upsert section must exist in openapi.yaml');

  assert.equal(/status:\s*(started|in-progress|failed|locked|abandoned|paused|turned-in)/i.test(missionListSection), false);
  assert.equal(/status:\s*(started|in-progress|failed|locked|abandoned|paused|turned-in)/i.test(missionUpsertSection), false);

  assert.ok(/status:\s*active/i.test(missionListSection) || /status:\s*completed/i.test(missionListSection));
  assert.ok(/status:\s*active/i.test(missionUpsertSection));
  assert.ok(/status must be one of: available, active, completed/i.test(missionUpsertSection));
});

test('negative invalid-status fixture is non-canonical by design', () => {
  const invalidFixture = readJson(NEGATIVE_FIXTURE_PATH);
  assert.equal(Array.isArray(invalidFixture.statuses), true);
  assert.ok(invalidFixture.statuses.length > 0);
  assert.equal(CANONICAL_MISSION_STATUSES.includes(invalidFixture.statuses[0]), false);
});
