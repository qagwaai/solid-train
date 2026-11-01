'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {
  runContractSafetyPreflight,
  assertNoContractVariance,
} = require('../scripts/sw08/startup-preflight');

test('SW-08 startup preflight passes against the approved generated contract baseline', () => {
  const report = runContractSafetyPreflight(path.join(__dirname, '..'));

  assert.equal(report.summary.totalIssues, 0);
});

test('SW-08 startup preflight blocks contract variance with actionable findings', () => {
  const baseline = {
    components: {
      schemas: {
        Example: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
      },
    },
  };
  const current = {
    components: {
      schemas: {
        Example: {
          type: 'object',
          properties: {},
        },
      },
    },
  };

  assert.throws(
    () => assertNoContractVariance(baseline, current, 'test baseline'),
    /Startup blocked: 2 contract variance issue\(s\) against test baseline\..*Example\.properties\.id/s
  );
});

test('SW-08 startup preflight blocks when the approved baseline is missing', () => {
  const missingRoot = path.join(__dirname, 'missing-baseline-root');

  assert.throws(
    () => runContractSafetyPreflight(missingRoot),
    /Startup blocked: approved contract baseline not found/
  );
});

test('all supported npm startup commands route through the guarded server entry point', () => {
  const packageJson = require('../package.json');

  for (const scriptName of ['start', 'start:host', 'start:dev', 'dev']) {
    assert.match(packageJson.scripts[scriptName], /src\/server\.js/);
  }
});
