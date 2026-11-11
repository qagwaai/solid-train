'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { acceptedInputs, readAccepted } = require('./lib/non-sol-market-density-plan');
const { generateBulkSystem } = require('./lib/non-sol-bulk-generator');
const { sourceGuard, atomicWrite, acquireLock } = require('./lib/non-sol-bulk-artifacts');
const { buildCopperValeSeedPlan } = require('../src/model/copper-vale-seed-lifecycle');
const { previewCopperValeP3 } = require('../src/model/non-sol-p3-preview');
const { sha256 } = require('../src/model/copper-vale-catalog-reconciliation');
const manifest = require('../data/non-sol-celestial-generation-manifest-v1.json');

async function replay(input, out) {
  assert.ok(path.resolve(input) !== path.resolve(out) && !path.resolve(out).startsWith(path.resolve(input) + path.sep),
    'Never overwrite accepted generation artifacts');
  fs.mkdirSync(out, { recursive: true });
  const lockFile = path.join(out, '.semantic-replay.lock');
  const lock = acquireLock(lockFile);
  try {
    const guard = sourceGuard();
    const { header, records } = acceptedInputs(input);
    const pilot = buildCopperValeSeedPlan();
    const preservation = { copperValeBodies: 57, copperValeMarkets: 'existing 6 unchanged; no bulk additions',
      p3: previewCopperValeP3().outputSha256, p4: pilot.p4OutputSha256, p6: pilot.planSha256 };
    assert.deepEqual(preservation, header.preservation, 'Accepted pilot outputs changed');
    let namingOffset = 0; let narrativeOffset = 0;
    const rows = [];
    for (const record of records) {
      const accepted = readAccepted(input, record);
      if (accepted.status !== 'ready') continue;
      const row = manifest.systems.find((s) => s.id === accepted.systemId);
      const actual = await generateBulkSystem(row, { namingOffset, narrativeOffset });
      assert.equal(actual.planSha256, accepted.planSha256, `Semantic generation replay mismatch: ${row.id}`);
      assert.deepEqual(actual, accepted, `Exact semantic payload changed: ${row.id}`);
      rows.push({ systemId: row.id, planSha256: actual.planSha256,
        bodiesSha256: sha256([...actual.baseBodies, ...actual.generatedBodies]),
        namingSha256: sha256(actual.naming), marketSha256: sha256(actual.market) });
      namingOffset += actual.naming.inherited + actual.naming.narrative;
      narrativeOffset += actual.naming.narrative;
      if (rows.length % 25 === 0) await new Promise((resolve) => setImmediate(resolve));
      if (rows.length % 500 === 0) console.log(`SEMANTIC_REPLAY ${rows.length}/4843`);
    }
    assert.equal(rows.length, 4843);
    assert.equal(sourceGuard(), guard, 'Sources changed during semantic replay');
    const payload = { schemaVersion: 'non-sol-generation-semantic-replay-v1', databaseWrites: 0,
      oldSourceGuard: header.sourceGuard, sourceGuard: guard,
      acceptedJournalSha256: records.at(-1).recordSha256, verifiedSystems: rows.length, mismatches: [],
      preservation, exactPlanPayloadEquality: true, rows };
    const result = { ...payload, reportSha256: sha256(payload) };
    atomicWrite(path.join(out, 'semantic-replay.json'), result);
    console.log(`SEMANTIC_REPLAY_RESULT ${JSON.stringify({ verifiedSystems: rows.length, reportSha256: result.reportSha256, databaseWrites: 0 })}`);
    return result;
  } finally { fs.closeSync(lock); fs.unlinkSync(lockFile); }
}

if (require.main === module) {
  const values = {};
  for (const arg of process.argv.slice(2)) {
    const [key, ...rest] = arg.split('=');
    assert.ok(['--input', '--out'].includes(key) && !Object.hasOwn(values, key) && rest.join('='), 'Invalid replay argument');
    values[key] = rest.join('=');
  }
  replay(values['--input'] || 'artifacts/non-sol-bulk-v1-delivery', values['--out'] || 'artifacts/non-sol-market-density-v2')
    .catch((error) => { console.error(error.stack); process.exitCode = 1; });
}

module.exports = { replay };
