'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { MISSION_STATUS_VALUES } = require('../../src/model/mission');

const fixturePath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(__dirname, '..', '..', 'test', 'fixtures', 'sw01', 'mission-status-invalid-request.json');

function fail(message, code = 1) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

let fixture;
try {
  fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
} catch (error) {
  fail(`[sw01-negative-fixture] Unable to read fixture at ${fixturePath}: ${error.message}`, 3);
}

const statuses = Array.isArray(fixture?.statuses) ? fixture.statuses : [];
if (statuses.length === 0) {
  fail('[sw01-negative-fixture] Fixture must contain at least one status entry', 4);
}

const invalidStatuses = statuses.filter((status) => !MISSION_STATUS_VALUES.includes(status));
if (invalidStatuses.length === 0) {
  fail(
    `[sw01-negative-fixture] Fixture is unexpectedly canonical; expected at least one invalid status. Allowed values: ${MISSION_STATUS_VALUES.join(', ')}`,
    2
  );
}

fail(
  `[sw01-negative-fixture] Expected failure confirmed. Invalid status values: ${invalidStatuses.join(', ')}. Allowed values: ${MISSION_STATUS_VALUES.join(', ')}`,
  1
);
