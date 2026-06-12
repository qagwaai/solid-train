'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const FIXTURE_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  'test',
  'fixtures',
  'sw13',
  'sw13-m4-size-consistency-report.json'
);
const ARTIFACT_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  'api',
  'artifacts',
  'contracts',
  'sw13-m4-size-consistency-report.json'
);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function main() {
  if (!fs.existsSync(ARTIFACT_PATH)) {
    throw new Error(
      'Missing api/artifacts/contracts/sw13-m4-size-consistency-report.json. Run npm run contract:review:sw13:size first.'
    );
  }

  const fixture = readJson(FIXTURE_PATH);
  const artifact = readJson(ARTIFACT_PATH);

  assert.deepEqual(
    artifact,
    fixture,
    'SW-13 M4 artifact-to-fixture parity failed. Regenerate and commit matching fixture/report evidence.'
  );

  console.log('[sw13-m4] artifact-to-fixture parity check passed.');
}

if (require.main === module) {
  main();
}
