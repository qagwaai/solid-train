'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function fixturePath(name) {
  return path.join(__dirname, 'fixtures', 'sw08', name);
}

function reportPath(name) {
  return path.join(__dirname, '..', 'artifacts', 'contracts', name);
}

function runChecker(args) {
  const result = spawnSync(
    'node',
    [path.join('scripts', 'sw08', 'check-contract-drift.js'), ...args],
    {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
    }
  );

  if (result.error) {
    throw result.error;
  }

  return result;
}

test('SW-08 hard fail rejects breaking drift without exception', () => {
  const result = runChecker([
    '--baseline',
    fixturePath('drift-old.json'),
    '--current',
    fixturePath('drift-new.json'),
    '--report',
    reportPath('stage3-hard-fail-report.json'),
    '--mode',
    'hard-fail',
  ]);

  assert.notEqual(result.status, 0);
  const report = JSON.parse(fs.readFileSync(reportPath('stage3-hard-fail-report.json'), 'utf8'));
  assert.equal(report.summary.hardFailEnforced, true);
  assert.equal(report.summary.bypassApproved, false);
  assert.ok(report.issues.length > 0);
  assert.ok(report.issues.every((issue) => issue.producerLocation && issue.consumerSurfaces));
});

test('SW-08 approved exception allows hard-fail bypass within policy', () => {
  const result = runChecker([
    '--baseline',
    fixturePath('drift-old.json'),
    '--current',
    fixturePath('drift-new.json'),
    '--report',
    reportPath('stage3-approved-report.json'),
    '--mode',
    'hard-fail',
    '--exception',
    fixturePath('approved-exception.json'),
  ]);

  assert.equal(result.status, 0);
  const report = JSON.parse(fs.readFileSync(reportPath('stage3-approved-report.json'), 'utf8'));
  assert.equal(report.summary.bypassApproved, true);
  assert.equal(report.summary.hardFailEnforced, false);
  assert.equal(report.exception.owner, 'backend-lead');
  assert.equal(report.exception.approvals.backendLead, true);
  assert.equal(report.exception.approvals.frontendLead, true);
});

test('SW-08 expired exception fails hard', () => {
  const result = runChecker([
    '--baseline',
    fixturePath('drift-old.json'),
    '--current',
    fixturePath('drift-new.json'),
    '--report',
    reportPath('stage3-expired-report.json'),
    '--mode',
    'hard-fail',
    '--exception',
    fixturePath('expired-exception.json'),
  ]);

  assert.notEqual(result.status, 0);
  const report = JSON.parse(fs.readFileSync(reportPath('stage3-expired-report.json'), 'utf8'));
  assert.equal(report.summary.hardFailEnforced, true);
  assert.equal(report.summary.bypassApproved, false);
  assert.ok(
    report.exception.errors.some((message) =>
      message.includes('expiryDate must not be in the past')
    )
  );
});

test('SW-08 missing approval exception fails hard', () => {
  const result = runChecker([
    '--baseline',
    fixturePath('drift-old.json'),
    '--current',
    fixturePath('drift-new.json'),
    '--report',
    reportPath('stage3-missing-approval-report.json'),
    '--mode',
    'hard-fail',
    '--exception',
    fixturePath('missing-approval-exception.json'),
  ]);

  assert.notEqual(result.status, 0);
  const report = JSON.parse(
    fs.readFileSync(reportPath('stage3-missing-approval-report.json'), 'utf8')
  );
  assert.equal(report.summary.hardFailEnforced, true);
  assert.equal(report.summary.bypassApproved, false);
  assert.ok(
    report.exception.errors.some((message) =>
      message.includes('approvals.backendLead=true and approvals.frontendLead=true')
    )
  );
});

test('SW-08 compatibility-window fixture passes without issues in hard fail', () => {
  const result = runChecker([
    '--baseline',
    fixturePath('compat-old.json'),
    '--current',
    fixturePath('compat-new.json'),
    '--report',
    reportPath('stage3-compat-report.json'),
    '--mode',
    'hard-fail',
  ]);

  assert.equal(result.status, 0);
  const report = JSON.parse(fs.readFileSync(reportPath('stage3-compat-report.json'), 'utf8'));
  assert.equal(report.summary.totalIssues, 0);
  assert.equal(report.summary.hardFailEnforced, false);
  assert.equal(report.summary.bypassApproved, false);
});
