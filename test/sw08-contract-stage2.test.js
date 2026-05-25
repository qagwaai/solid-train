'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function fixturePath(name) {
  return path.join(__dirname, 'fixtures', 'sw08', name);
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

test('SW-08 soft fail rejects breaking drift without approved exception', () => {
  const reportPath = path.join(
    __dirname,
    '..',
    'artifacts',
    'contracts',
    'stage2-soft-fail-report.json'
  );
  const result = runChecker([
    '--baseline',
    fixturePath('drift-old.json'),
    '--current',
    fixturePath('drift-new.json'),
    '--report',
    reportPath,
    '--mode',
    'soft-fail',
  ]);

  assert.notEqual(result.status, 0);
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  assert.equal(report.summary.softFailEnforced, true);
  assert.equal(report.summary.bypassApproved, false);
  assert.ok(Array.isArray(report.issues));
  assert.ok(report.issues.length > 0);
});

test('SW-08 approved exception allows soft-fail bypass', () => {
  const reportPath = path.join(
    __dirname,
    '..',
    'artifacts',
    'contracts',
    'stage2-approved-report.json'
  );
  const result = runChecker([
    '--baseline',
    fixturePath('drift-old.json'),
    '--current',
    fixturePath('drift-new.json'),
    '--report',
    reportPath,
    '--mode',
    'soft-fail',
    '--exception',
    fixturePath('approved-exception.json'),
  ]);

  assert.equal(result.status, 0);
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  assert.equal(report.summary.bypassApproved, true);
  assert.equal(report.summary.softFailEnforced, false);
  assert.equal(report.exception.owner, 'backend-lead');
  assert.equal(report.exception.approvals.backendLead, true);
  assert.equal(report.exception.approvals.frontendLead, true);
});

test('SW-08 compatibility-window fixture passes without issues', () => {
  const reportPath = path.join(
    __dirname,
    '..',
    'artifacts',
    'contracts',
    'stage2-compat-report.json'
  );
  const result = runChecker([
    '--baseline',
    fixturePath('compat-old.json'),
    '--current',
    fixturePath('compat-new.json'),
    '--report',
    reportPath,
    '--mode',
    'soft-fail',
  ]);

  assert.equal(result.status, 0);
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  assert.equal(report.summary.totalIssues, 0);
  assert.equal(report.summary.softFailEnforced, false);
  assert.equal(report.summary.bypassApproved, false);
});
