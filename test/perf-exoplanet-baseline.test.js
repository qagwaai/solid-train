'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { SCENARIOS, formatTable, percentile } = require('../scripts/perf-exoplanet-baseline');

test('percentile picks the nearest-rank sample', () => {
  const sorted = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  assert.equal(percentile(sorted, 0.5), 5);
  assert.equal(percentile(sorted, 0.95), 10);
  assert.equal(percentile([7], 0.95), 7);
});

test('scenarios cover the Phase 7 selection with unique ids', () => {
  const ids = SCENARIOS.map((scenario) => scenario.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.includes('solar-system-list-all'));
  assert.ok(ids.includes('solar-system-list-nova'));
  assert.ok(ids.includes('star-list-all'));
});

test('formatTable renders one markdown row per result', () => {
  const table = formatTable([
    {
      label: 'a',
      items: 4845,
      bytes: 3_017_054,
      bytesPerItem: 623,
      p50Ms: 37.5,
      p95Ms: 52.9,
      maxMs: 60,
    },
    { label: 'b', items: 0, bytes: 100, bytesPerItem: null, p50Ms: 1, p95Ms: 2, maxMs: 3 },
  ]);
  const lines = table.split('\n');
  assert.equal(lines.length, 4);
  assert.equal(lines[2], '| a | 4,845 | 3.02 MB | 623 | 37.5 | 52.9 | 60 |');
  assert.match(lines[3], /\| — \|/);
});
