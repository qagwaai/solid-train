'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { MongoClient } = require('mongodb');
const { parseArguments: parseLocalTarget, assertForgeStopped } = require('./copper-vale-persistent-seed');
const { prepare, verifyArtifacts, readyPlans, atomicWrite, acquireLock, sourceGuard } = require('./lib/non-sol-bulk-artifacts');
const { fullPreflight, applySystem, readbackSystem, protectedFingerprint, ensureIndexes } = require('./lib/non-sol-bulk-lifecycle');
const { sha256 } = require('../src/model/copper-vale-catalog-reconciliation');
const { runContractSafetyPreflight } = require('./sw08/startup-preflight');

function parseArguments(args) {
  const allowed = new Set(['--action', '--out', '--target', '--approve', '--batch-size', '--approve-source']);
  const values = {};
  for (const arg of args) {
    const [key, ...rest] = arg.split('=');
    if (!allowed.has(key) || Object.hasOwn(values, key) || !rest.join('=')) throw new Error(`Invalid argument: ${arg}`);
    values[key] = rest.join('=');
  }

  const action = values['--action'] || 'dry-run';
  if (!['prepare', 'dry-run', 'readback', 'apply', 'resume'].includes(action)) throw new Error('Unsupported action');
  const target = values['--target'];
  if (target) parseLocalTarget([`--target=${target}`, '--action=dry-run']);
  if (['readback', 'apply', 'resume'].includes(action) && !target) throw new Error('Persistent action requires explicit local target');
  if (action === 'prepare' && target) throw new Error('Prepare is offline only');
  const writes = ['apply', 'resume'].includes(action);
  if (writes && !/^[a-f0-9]{64}$/.test(values['--approve'] || '')) throw new Error('Writes require --approve=<full-target-dry-run receipt hash>');
  if (!writes && values['--approve']) throw new Error('Read-only actions must not include approval');
  const batchSize = Number(values['--batch-size'] || 50);
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 100) throw new Error('Batch size must be 1..100');
  return { action, target, writes, approve: values['--approve'],
    approveSource: values['--approve-source'],
    out: path.resolve(values['--out'] || 'artifacts/non-sol-bulk-v1'), batchSize };
}

function assertFinalApproval(approved, receipt, provided) {
  assert.equal(approved.approvalSha256, provided, 'Explicit final approval mismatch');
  assert.deepEqual(approved, receipt, 'Target/source changed since full dry-run; rerun full target dry-run');
}

async function run(args) {
  const options = parseArguments(args);
  if (!options.target) {
    const report = await prepare(options.out);
    console.log(`NON_SOL_BULK_RESULT ${JSON.stringify({ artifact: path.join(options.out, 'dry-run.json'), ...report })}`);
    return report;
  }
  const report = verifyArtifacts(options.out, options.approveSource);
  const deploymentGuard = sourceGuard();
  runContractSafetyPreflight();
  if (options.writes) await assertForgeStopped();
  const lock = options.writes ? acquireLock(path.join(options.out, '.deployment.lock')) : null;
  const client = new MongoClient(options.target, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    const db = client.db();
    const preflight = await fullPreflight(db, readyPlans(options.out), report.sourceGuard);
    const fingerprint = await protectedFingerprint(db);
    const receiptPayload = { target: options.target, reportSha256: report.reportSha256,
      sourceGuard: report.sourceGuard, results: preflight, fingerprint };
    const receipt = { ...receiptPayload, approvalSha256: sha256(receiptPayload) };
    if (options.action === 'dry-run') {
      atomicWrite(path.join(options.out, 'target-dry-run.json'), receipt);
      console.log(`NON_SOL_TARGET_DRY_RUN ${JSON.stringify({ artifact: path.join(options.out, 'target-dry-run.json'),
        ready: preflight.filter((s) => s.status !== 'blocked').length,
        blocked: preflight.filter((s) => s.status === 'blocked'), approvalSha256: receipt.approvalSha256, databaseWrites: 0 })}`);
      return receipt;
    }
    assert.ok(!preflight.some((s) => s.status === 'blocked'), 'Full-cohort target preflight blocked; no writes');
    if (options.writes) {
      const approved = JSON.parse(fs.readFileSync(path.join(options.out, 'target-dry-run.json'), 'utf8'));
      assertFinalApproval(approved, receipt, options.approve);
      await assertForgeStopped();
      await ensureIndexes(db);
    }
    const missing = { bodies: preflight.flatMap((s) => s.missingBodies || []),
      markets: preflight.filter((s) => s.missingMarket).map((s) => `${s.systemId}-bulk-initial-exchange`),
      states: preflight.map((s) => `non-sol-bulk-seed:${s.systemId}`) };
    const before = await protectedFingerprint(db, missing);
    let count = 0;
    try {
      for (const plan of readyPlans(options.out)) {
        if (options.writes) await applySystem(db, plan, report.sourceGuard);
        else await readbackSystem(db, plan, report.sourceGuard);
        count++;
        if (count % options.batchSize === 0) {
          if (options.writes) {
            assert.equal(sourceGuard(), deploymentGuard, 'Sources changed during deployment; paused');
            await assertForgeStopped();
          }
          console.log(`NON_SOL_DURABLE_BATCH ${count}/${report.ready}`);
        }
      }
    } finally {
      assert.deepEqual(await protectedFingerprint(db, missing), before, 'Protected catalog/gameplay/economy/other collection changed');
    }
    const result = { action: options.action, verified: count, protectedDataUnchanged: true, reportSha256: report.reportSha256 };
    atomicWrite(path.join(options.out, `${options.action}-result.json`), result);
    console.log(`NON_SOL_PERSISTENT_RESULT ${JSON.stringify(result)}`);
    return result;
  } finally {
    await client.close();
    if (lock !== null) { fs.closeSync(lock); fs.unlinkSync(path.join(options.out, '.deployment.lock')); }
  }
}

if (require.main === module) run(process.argv.slice(2)).catch((error) => {
  console.error(`[non-sol-bulk] ${error.stack}`); process.exitCode = 1;
});

module.exports = { parseArguments, assertFinalApproval, run };
