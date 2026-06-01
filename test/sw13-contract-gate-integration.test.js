'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function fixturePath(name) {
  return path.join(__dirname, 'fixtures', 'sw13', 'm3', name);
}

function reportPath(name) {
  return path.join(__dirname, '..', 'artifacts', 'contracts', name);
}

function runGate(args) {
  const result = spawnSync('node', [path.join('scripts', 'sw13', 'run-cross-repo-gate.js'), ...args], {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8',
  });

  if (result.error) {
    throw result.error;
  }

  return result;
}

test('SW-13 cross-repo alignment gate passes with aligned descriptor inventory', () => {
  const result = runGate([
    '--baseline',
    fixturePath('nova-consumer-inventory-aligned.json'),
    '--current',
    fixturePath('nova-consumer-inventory-aligned.json'),
    '--report',
    reportPath('sw13-m3-alignment-report.json'),
    '--mode',
    'hard-fail',
  ]);

  assert.equal(result.status, 0);
  const report = JSON.parse(fs.readFileSync(reportPath('sw13-m3-alignment-report.json'), 'utf8'));
  assert.equal(report.summary.totalIssues, 0);
  assert.match(result.stderr, /No compatibility issues detected/i);
});

test('SW-13 cross-repo gate fails enum mismatch with actionable diagnostics', () => {
  const result = runGate([
    '--baseline',
    fixturePath('nova-consumer-inventory-aligned.json'),
    '--current',
    fixturePath('external-object-descriptor-drift-enum-mismatch.json'),
    '--report',
    reportPath('sw13-m3-drift-enum-report.json'),
    '--mode',
    'hard-fail',
  ]);

  assert.notEqual(result.status, 0);
  const report = JSON.parse(fs.readFileSync(reportPath('sw13-m3-drift-enum-report.json'), 'utf8'));
  assert.ok(report.summary.totalIssues > 0);
  assert.ok(
    report.issues.some((issue) => issue.category === 'enum narrowing/mismatch'),
    'expected enum drift category to be present'
  );
  assert.match(result.stderr, /severity=/);
  assert.match(result.stderr, /owner=/);
  assert.match(result.stderr, /producerLocation=/);
  assert.match(result.stderr, /impactedConsumerSurface=/);
  assert.match(result.stderr, /remediationHint=/);
});

test('SW-13 cross-repo gate fails unsupported legacy domain expectations', () => {
  const result = runGate([
    '--baseline',
    fixturePath('nova-consumer-inventory-legacy-domain.json'),
    '--current',
    fixturePath('nova-consumer-inventory-aligned.json'),
    '--report',
    reportPath('sw13-m3-drift-unsupported-domain-report.json'),
    '--mode',
    'hard-fail',
  ]);

  assert.notEqual(result.status, 0);
  const report = JSON.parse(
    fs.readFileSync(reportPath('sw13-m3-drift-unsupported-domain-report.json'), 'utf8')
  );
  assert.ok(report.summary.totalIssues > 0);
  assert.ok(
    report.issues.some((issue) =>
      issue.detail.includes('Enum narrowed; removed values: [asteroid, jump_gate, ship, station]')
    )
  );
});

test('SW-13 cross-repo gate fails shape mismatch drift', () => {
  const result = runGate([
    '--baseline',
    fixturePath('nova-consumer-inventory-aligned.json'),
    '--current',
    fixturePath('external-object-descriptor-drift-shape-mismatch.json'),
    '--report',
    reportPath('sw13-m3-drift-shape-report.json'),
    '--mode',
    'hard-fail',
  ]);

  assert.notEqual(result.status, 0);
  const report = JSON.parse(fs.readFileSync(reportPath('sw13-m3-drift-shape-report.json'), 'utf8'));
  assert.ok(report.summary.totalIssues > 0);
  assert.ok(
    report.issues.some((issue) => issue.category === 'type mismatches'),
    'expected type mismatch category to be present'
  );
});
