'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { MongoClient } = require('mongodb');
const { parseArguments: parseTarget, assertForgeStopped } = require('./copper-vale-persistent-seed');
const { runContractSafetyPreflight } = require('./sw08/startup-preflight');
const { sha256 } = require('../src/model/copper-vale-catalog-reconciliation');
const { prepareDensity, acceptedInputs, readAccepted, allocations } = require('./lib/non-sol-market-density-plan');
const { preflightDensity, applyDensity, stateKey } = require('./lib/non-sol-market-density-lifecycle');
const { sourceGuard, atomicWrite, acquireLock, verifyArtifacts } = require('./lib/non-sol-bulk-artifacts');
const { protectedFingerprint } = require('./lib/non-sol-bulk-lifecycle');

function parseArguments(args) {
  const allowed = new Set(['--action', '--input', '--out', '--target', '--approve', '--approve-source', '--batch-size', '--version']);
  const values = {};
  for (const arg of args) {
    const [key, ...rest] = arg.split('=');
    if (!allowed.has(key) || Object.hasOwn(values, key) || !rest.join('=')) throw new Error(`Invalid argument: ${arg}`);
    values[key] = rest.join('=');
  }
  const action = values['--action'] || 'prepare';
  assert.ok(['prepare', 'dry-run', 'readback', 'apply', 'resume'].includes(action), 'Unsupported action');
  const target = values['--target'];
  if (target) parseTarget([`--target=${target}`, '--action=dry-run']);
  assert.equal(action === 'prepare', !target, 'Prepare is offline; all other actions require explicit local target');
  const writes = ['apply', 'resume'].includes(action);
  if (writes) assert.match(values['--approve'] || '', /^[a-f0-9]{64}$/, 'Writes require full target receipt approval');
  else assert.ok(!values['--approve'], 'Read-only action cannot include write approval');
  const batchSize = Number(values['--batch-size'] || 25);
  const version = values['--version'] || 'v2';
  assert.ok(['v1', 'v2'].includes(version), 'Unsupported density version');
  assert.ok(Number.isInteger(batchSize) && batchSize >= 1 && batchSize <= 100, 'Batch size must be 1..100');
  const input = path.resolve(values['--input'] || 'artifacts/non-sol-bulk-v1-delivery');
  const out = path.resolve(values['--out'] || `artifacts/non-sol-market-density-${version}`);
  assert.ok(out !== input && !out.startsWith(input + path.sep), 'Density output must not touch accepted input directory');
  return { action, target, writes, batchSize, input, out, version,
    approve: values['--approve'], approveSource: values['--approve-source'] };
}

function loadPlans(options) {
  const report = JSON.parse(fs.readFileSync(path.join(options.out, 'offline-report.json'), 'utf8'));
  const { reportSha256, ...payload } = report;
  assert.equal(sha256(payload), reportSha256, 'Offline report checksum mismatch');
  assert.equal(sourceGuard(), report.sourceGuard, 'Density source guard drift; fresh reviewed offline run required');
  assert.equal(report.schemaVersion, `non-sol-market-density-${options.version}`, 'Explicit density version/report mismatch');
  // Artifact contents/journal, not the extraction directory, establish provenance.
  // This keeps the reviewed plans portable to another developer's checkout.
  assert.equal(report.holds.length, 0, 'Full cohort has placement holds');
  assert.equal(report.artifacts.length, 4843, 'Full density cohort required');
  const { header, records } = acceptedInputs(options.input);
  assert.equal(report.sourceMigration.oldSourceGuard, header.sourceGuard);
  assert.equal(report.sourceMigration.acceptedJournalSha256, records.at(-1).recordSha256);
  // This is an explicit human migration authorization, never an old-hash fallback.
  verifyArtifacts(options.input, options.approveSource);
  const ready = records.filter((r) => r.status === 'ready');
  assert.deepEqual(report.artifacts.map((e) => e.systemId), ready.map((r) => r.systemId), 'Exact full density cohort required');
  const allocation = (options.version === 'v2' ? require('./lib/non-sol-market-density-v2').allocationsV2 : allocations)(ready.map((r) => r.systemId));
  if (options.version === 'v2') {
    const replay = JSON.parse(fs.readFileSync(path.join(options.out, 'semantic-replay.json'), 'utf8'));
    const { reportSha256, ...payload } = replay;
    assert.equal(sha256(payload), reportSha256);
    assert.equal(report.semanticReplaySha256, reportSha256);
    assert.equal(replay.sourceGuard, report.sourceGuard);
    assert.equal(replay.verifiedSystems, 4843);
    assert.equal(replay.mismatches.length, 0);
  }
  // Stream immutable bodies rather than retaining the 500+ MB accepted cohort in memory.
  function* plans() {
    for (const [index, entry] of report.artifacts.entries()) {
      const base = readAccepted(options.input, ready[index]);
      const plan = JSON.parse(fs.readFileSync(path.join(options.out, `${entry.systemId}.json`), 'utf8'));
      assert.equal(plan.planSha256, entry.planSha256);
      assert.deepEqual({ profile: plan.profile, target: plan.target }, allocation.get(entry.systemId));
      yield { base, plan };
    }
  }
  return { report, header, plans };
}

async function run(args) {
  const options = parseArguments(args);
  if (options.action === 'prepare') {
    const result = await prepareDensity(options.input, options.out, { version: options.version });
    console.log(`DENSITY_OFFLINE_RESULT ${JSON.stringify({ report: path.join(options.out, 'offline-report.json'),
      systems: result.scope, added: result.addedMarkets, targets: result.targetMarkets, holds: result.holds.length,
      baselineReconciliationHolds: result.baselineReconciliationHolds.length, deploymentStatus: result.deploymentStatus,
      sourceMigrationApprovalSha256: result.sourceMigrationApprovalSha256, databaseWrites: 0 })}`);
    return result;
  }
  const { report, header, plans } = loadPlans(options);
  runContractSafetyPreflight();
  if (options.writes) await assertForgeStopped();
  const lockFile = path.join(options.out, '.deployment.lock');
  const lock = options.writes ? acquireLock(lockFile) : null;
  const client = new MongoClient(options.target, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    const db = client.db();
    const results = [];
    for (const { base, plan } of plans()) {
      try { results.push(await preflightDensity(db, base, plan, header.sourceGuard, report.sourceGuard)); }
      catch (error) { results.push({ systemId: plan.systemId, status: 'blocked', reason: error.message }); }
    }
    const fingerprint = await protectedFingerprint(db);
    const payload = { target: options.target, reportSha256: report.reportSha256,
      sourceGuard: report.sourceGuard, sourceMigrationApprovalSha256: options.approveSource, results, fingerprint };
    const receipt = { ...payload, approvalSha256: sha256(payload) };
    if (options.action === 'dry-run') {
      atomicWrite(path.join(options.out, 'target-dry-run.json'), receipt);
      console.log(`DENSITY_TARGET_DRY_RUN ${JSON.stringify({ receipt: path.join(options.out, 'target-dry-run.json'),
        blocked: results.filter((r) => r.status === 'blocked'), approvalSha256: receipt.approvalSha256, databaseWrites: 0 })}`);
      return receipt;
    }
    assert.ok(!results.some((r) => r.status === 'blocked'), 'Full-cohort target preflight blocked; no writes');
    if (options.writes) {
      const approved = JSON.parse(fs.readFileSync(path.join(options.out, 'target-dry-run.json'), 'utf8'));
      assert.equal(options.approve, receipt.approvalSha256, 'Explicit owner receipt approval mismatch');
      assert.deepEqual(approved, receipt, 'Target/source drift; rerun target dry-run and obtain new approval');
      await assertForgeStopped();
    }
    const exclusions = { bodies: [], markets: results.flatMap((r) => r.missing),
      states: report.artifacts.map((entry) => stateKey(entry.systemId)) };
    const before = await protectedFingerprint(db, exclusions);
    let count = 0;
    try {
      for (const { base, plan } of plans()) {
        if (count % options.batchSize === 0) assert.equal(sourceGuard(), report.sourceGuard, 'Source changed during deployment');
        if (options.writes) await applyDensity(db, base, plan, header.sourceGuard, report.sourceGuard);
        else assert.equal((await preflightDensity(db, base, plan, header.sourceGuard, report.sourceGuard)).status, 'complete');
        count++;
        if (count % options.batchSize === 0) {
          if (options.writes) await assertForgeStopped();
          console.log(`DENSITY_DURABLE_BATCH ${count}/4843`);
        }
      }
    } finally {
      assert.deepEqual(await protectedFingerprint(db, exclusions), before, 'Existing gameplay/stock/catalog data changed');
    }
    const result = { action: options.action, verified: count, existingDataUnchanged: true };
    atomicWrite(path.join(options.out, `${options.action}-result.json`), result);
    return result;
  } finally {
    await client.close();
    if (lock !== null) { fs.closeSync(lock); fs.unlinkSync(lockFile); }
  }
}

if (require.main === module) run(process.argv.slice(2)).catch((error) => {
  console.error(`[non-sol-market-density] ${error.stack}`); process.exitCode = 1;
});

module.exports = { parseArguments, loadPlans, run };
