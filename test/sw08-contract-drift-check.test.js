'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { analyzeDrift, CATEGORY } = require('../scripts/sw08/check-contract-drift');

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
