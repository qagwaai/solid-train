'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { MongoClient } = require('mongodb');
const { parseArguments: parseTarget, assertForgeStopped } = require('./copper-vale-persistent-seed');
const { parseArguments: parseDensity, loadPlans } = require('./non-sol-market-density');
const { atomicWrite, acquireLock } = require('./lib/non-sol-bulk-artifacts');
const { COLLECTIONS, preflightSystem, protectedFingerprint } = require('./lib/non-sol-bulk-lifecycle');
const { MessageHandlerContext } = require('../src/handlers/message-handler-context');
const { createSeedMarketPayload } = require('../src/handlers/context/context-bootstrap-service');
const { densityMarketIdentity, assertBaselineSnapshot } = require('../src/model/non-sol-market-density-reconciliation');
const { sha256 } = require('../src/model/copper-vale-catalog-reconciliation');
const evidence = require('../data/non-sol-market-density-baseline-v2.json');
const { runContractSafetyPreflight } = require('./sw08/startup-preflight');

async function baselinePreflight(db) {
  const results = [];
  for (const expected of evidence.markets) {
    const matches = await db.collection(COLLECTIONS.markets).find({ marketId: expected.marketId }).toArray();
    assert.ok(matches.length <= 1, `Duplicate baseline market: ${expected.marketId}`);
    if (matches.length) {
      assertBaselineSnapshot(densityMarketIdentity(matches[0]), expected);
    }
    results.push({ marketId: expected.marketId, status: matches.length ? 'existing' : 'missing' });
  }
  return results;
}

async function seedBaseline(db) {
  const results = await baselinePreflight(db);
  const missing = results.filter((row) => row.status === 'missing').map((row) => row.marketId);
  const exclusions = { bodies: [], states: [], markets: missing };
  const before = await protectedFingerprint(db, exclusions);
  const context = new MessageHandlerContext({ databaseService: {}, log: () => {} });
  const timestamp = evidence.inspectionAt;
  try {
    for (const expected of evidence.markets.filter((market) => missing.includes(market.marketId))) {
      const payload = createSeedMarketPayload(context, expected, timestamp);
      await db.collection(COLLECTIONS.markets).updateOne({ marketId: expected.marketId },
        { $setOnInsert: payload }, { upsert: true });
      const actual = await db.collection(COLLECTIONS.markets).findOne({ marketId: expected.marketId });
      const { _id, ...persisted } = actual;
      assert.deepEqual(persisted, payload, `Inserted baseline readback mismatch: ${expected.marketId}`);
    }
    assert.ok((await baselinePreflight(db)).every((row) => row.status === 'existing'));
  } finally {
    assert.deepEqual(await protectedFingerprint(db, exclusions), before, 'Existing data changed during baseline seed');
  }
  return { inserted: missing, existingDataUnchanged: true };
}

async function run(args) {
  const options = parseDensity(args);
  assert.ok(['dry-run', 'apply', 'readback'].includes(options.action), 'Baseline supports dry-run, apply and readback only');
  parseTarget([`--target=${options.target}`, '--action=dry-run']);
  const { report, header, plans } = loadPlans(options);
  runContractSafetyPreflight();
  if (options.writes) await assertForgeStopped();
  const lockFile = path.join(options.out, '.deployment.lock');
  const lock = acquireLock(lockFile);
  const client = new MongoClient(options.target, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    const db = client.db();
    const systems = new Set(evidence.markets.map((market) => market.solarSystemId));
    for (const { base, plan } of plans()) {
      if (systems.has(plan.systemId)) {
        assert.equal((await preflightSystem(db, base, header.sourceGuard)).status, 'complete',
          'Bulk generation must be complete before baseline markets');
        systems.delete(plan.systemId);
      }
    }
    assert.equal(systems.size, 0, 'Baseline systems missing from density plans');
    const results = await baselinePreflight(db);
    const payload = { target: options.target, reportSha256: report.reportSha256,
      results, fingerprint: await protectedFingerprint(db) };
    const receipt = { ...payload, approvalSha256: sha256(payload) };
    const receiptPath = path.join(options.out, 'baseline-target-dry-run.json');
    if (options.action === 'dry-run') {
      atomicWrite(receiptPath, receipt);
      console.log(`BASELINE_TARGET_DRY_RUN ${JSON.stringify({ results, receipt: receiptPath,
        approvalSha256: receipt.approvalSha256, databaseWrites: 0 })}`);
      return receipt;
    }
    if (options.writes) {
      assert.equal(options.approve, receipt.approvalSha256, 'Baseline target changed; rerun dry-run');
      assert.deepEqual(JSON.parse(fs.readFileSync(receiptPath, 'utf8')), receipt, 'Baseline receipt drift');
      await assertForgeStopped();
      const result = await seedBaseline(db);
      console.log(`BASELINE_SEED_RESULT ${JSON.stringify(result)}`);
      return result;
    }
    assert.ok(results.every((row) => row.status === 'existing'), 'Baseline markets are still missing');
    console.log('BASELINE_READBACK verified');
    return results;
  } finally {
    await client.close();
    fs.closeSync(lock);
    fs.unlinkSync(lockFile);
  }
}

if (require.main === module) run(process.argv.slice(2)).catch((error) => {
  console.error(`[non-sol-density-baseline] ${error.stack}`);
  process.exitCode = 1;
});

module.exports = { baselinePreflight, seedBaseline, run };
