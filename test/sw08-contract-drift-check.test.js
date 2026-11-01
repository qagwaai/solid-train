'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { analyzeDrift, CATEGORY } = require('../scripts/sw08/check-contract-drift');
const { buildArtifact } = require('../scripts/sw08/generate-contract-artifact');

function loadFixture(name) {
  const filePath = path.join(__dirname, 'fixtures', 'sw08', name);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

test('SW-08 drift checker classifies all required Stage 1 drift categories', () => {
  const baseline = loadFixture('drift-old.json');
  const current = loadFixture('drift-new.json');

  const report = analyzeDrift(baseline, current);
  const categories = new Set(report.issues.map((issue) => issue.category));

  assert.equal(categories.has(CATEGORY.REMOVED_REQUIRED), true);
  assert.equal(categories.has(CATEGORY.TYPE_MISMATCH), true);
  assert.equal(categories.has(CATEGORY.ENUM_MISMATCH), true);
  assert.equal(categories.has(CATEGORY.ENDPOINT_EVENT_REMOVAL), true);
  assert.ok(report.summary.totalIssues >= 4);
});

test('SW-08 drift checker resolves local references and retains nullable type detection', () => {
  const rootDir = path.join(__dirname, '..');
  const current = buildArtifact(rootDir);
  const baseline = { components: { resolvedSchemas: current.components.resolvedSchemas } };
  const unresolvedCurrent = {
    ...current,
    components: { ...current.components, resolvedSchemas: undefined },
  };
  const unresolvedReport = analyzeDrift(baseline, unresolvedCurrent);
  const spatialVariance = unresolvedReport.issues.filter(
    (issue) =>
      issue.producerLocation.startsWith('schema:') &&
      /\.spatial\.(properties|required)\./.test(issue.producerLocation)
  );
  assert.ok(spatialVariance.length > 0);

  const resolvedReport = analyzeDrift(baseline, current);
  assert.equal(resolvedReport.summary.totalIssues, 0);

  const legacyBaseline = JSON.parse(JSON.stringify(current));
  legacyBaseline.components.resolvedSchemas.CelestialBodyUpsertRequest.properties.celestialBody.properties.motion.properties.angularVelocityRadPerSec.type =
    'object';
  const nullableReport = analyzeDrift(legacyBaseline, current);
  const typeMismatchLocations = nullableReport.issues
    .filter((issue) => issue.category === CATEGORY.TYPE_MISMATCH)
    .map((issue) => issue.producerLocation);

  assert.equal(nullableReport.summary.totalIssues, 1);
  assert.equal(typeMismatchLocations.length, 1);
  assert.ok(
    typeMismatchLocations.includes(
      'schema:CelestialBodyUpsertRequest.properties.celestialBody.properties.motion.properties.angularVelocityRadPerSec'
    )
  );
});
