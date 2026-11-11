'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const os = require('node:os');
const manifest = require('../../data/non-sol-celestial-generation-manifest-v1.json');
const { generateBulkSystem, policy } = require('./non-sol-bulk-generator');
const { sha256 } = require('../../src/model/copper-vale-catalog-reconciliation');
const { buildCopperValeSeedPlan } = require('../../src/model/copper-vale-seed-lifecycle');
const { previewCopperValeP3 } = require('../../src/model/non-sol-p3-preview');

const ROOT = path.resolve(__dirname, '../..');
function sourceGuard() {
  const files = new Set(manifest.sourceFiles.map((s) => s.path.replaceAll('\\', '/'))
    .filter((p) => !p.startsWith('docs/')));
  for (const directory of ['src/model', 'src/db', 'scripts/lib', 'api/schemas']) {
    function walk(dir) {
      for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
        const file = `${dir}/${entry.name}`;
        if (entry.isDirectory()) walk(file);
        else if (/\.(js|json)$/.test(file)) files.add(file);
      }
    }
    walk(directory);
  }
  for (const file of ['data/non-sol-bulk-policy-v1.json', 'data/non-sol-scientific-policy-v1.json',
    'data/non-sol-scientific-policy-v2.json', 'data/copper-vale-body-naming-manifest-v1.json',
    'data/system-naming-review-bank-v1.json', 'data/non-sol-celestial-generation-manifest-v1.json',
    'scripts/non-sol-bulk-seed.js', 'scripts/copper-vale-persistent-seed.js',
    'scripts/sw08/startup-preflight.js', 'api/openapi.yaml', 'api/openapi/solarsystem/openapi.yaml']) files.add(file);
  for (const file of ['scripts/non-sol-market-density.js', 'scripts/non-sol-market-density-replay.js',
    'data/non-sol-market-density-policy-v1.json', 'data/non-sol-market-density-policy-v2.json',
    'data/non-sol-market-density-baseline-v2.json']) files.add(file);
  return sha256([...files].sort().map((file) => [file, sha256(fs.readFileSync(path.join(ROOT, file)).toString('base64'))]));
}

function atomicWrite(file, value) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  const fd = fs.openSync(temporary, 'wx');
  try { fs.writeFileSync(fd, JSON.stringify(value)); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
  fs.renameSync(temporary, file);
}

function readJournal(out) {
  const file = path.join(out, 'progress.jsonl');
  if (!fs.existsSync(file)) return [];
  const content = fs.readFileSync(file, 'utf8');
  // A torn final append is ignored and truncated on the next exclusive resume.
  const lines = content.slice(0, content.lastIndexOf('\n') + 1).split('\n').filter(Boolean);
  let previous = null;
  const seen = new Set();
  const rows = lines.map((line) => {
    const record = JSON.parse(line);
    const { recordSha256, ...payload } = record;
    assert.equal(payload.previous, previous, 'Journal chain mismatch');
    assert.equal(sha256(payload), recordSha256, 'Journal checksum mismatch');
    assert.ok(!seen.has(payload.systemId), 'Duplicate journal system');
    seen.add(payload.systemId);
    previous = recordSha256;
    return record;
  });
  return rows;
}

function acquireLock(file) {
  if (fs.existsSync(file)) {
    const owner = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(owner.host, os.hostname(), 'Cannot recover another host lock');
    let alive = true;
    try { process.kill(owner.pid, 0); }
    catch (error) { if (error.code === 'ESRCH') alive = false; else throw error; }
    assert.ok(!alive, `Live bulk worker owns lock (PID ${owner.pid})`);
    fs.unlinkSync(file);
  }
  const fd = fs.openSync(file, 'wx');
  fs.writeFileSync(fd, JSON.stringify({ host: os.hostname(), pid: process.pid }));
  fs.fsyncSync(fd);
  return fd;
}

async function prepare(out, options = {}) {
  fs.mkdirSync(out, { recursive: true });
  const lock = path.join(out, '.prepare.lock');
  const fd = acquireLock(lock);
  try {
    const guard = sourceGuard();
    const headerFile = path.join(out, 'header.json');
    const pilot = buildCopperValeSeedPlan();
    const header = { schemaVersion: policy.version, sourceGuard: guard,
      manifestSha256: manifest.manifestSha256, targetCount: manifest.systems.length,
      preservation: { copperValeBodies: 57, copperValeMarkets: 'existing 6 unchanged; no bulk additions',
        p3: previewCopperValeP3().outputSha256, p4: pilot.p4OutputSha256, p6: pilot.planSha256 },
      assumptions: policy.assumptions };
    if (fs.existsSync(headerFile)) assert.deepEqual(JSON.parse(fs.readFileSync(headerFile, 'utf8')), header, 'Source/invariant drift; refuse resume');
    else atomicWrite(headerFile, header);
    const records = readJournal(out);
    const journal = path.join(out, 'progress.jsonl');
    if (fs.existsSync(journal)) {
      const content = fs.readFileSync(journal);
      fs.truncateSync(journal, content.lastIndexOf(10) + 1);
    }
    const done = new Set(records.map((r) => r.systemId));
    const scope = manifest.systems;
    let namingOffset = 0;
    let narrativeOffset = 0;
    for (const row of scope) {
      if (done.has(row.id)) {
        const record = records.find((r) => r.systemId === row.id);
        const saved = JSON.parse(fs.readFileSync(path.join(out, `${row.id}.json`), 'utf8'));
        assert.equal(sha256(saved),
          record.artifactSha256, `Artifact drift: ${row.id}`);
        namingOffset += (saved.naming?.inherited || 0) + (saved.naming?.narrative || 0);
        narrativeOffset += saved.naming?.narrative || 0;
        continue;
      }
      const plan = row.id === 'exo-gj-9066' ? { systemId: row.id, status: 'protected', ...header.preservation } :
        await generateBulkSystem(row, { namingOffset, narrativeOffset });
      namingOffset += (plan.naming?.inherited || 0) + (plan.naming?.narrative || 0);
      narrativeOffset += plan.naming?.narrative || 0;
      atomicWrite(path.join(out, `${row.id}.json`), plan);
      if (options.afterArtifact) options.afterArtifact(row.id);
      const payload = { systemId: row.id, status: plan.status, artifactSha256: sha256(plan),
        previous: records.at(-1)?.recordSha256 || null };
      const record = { ...payload, recordSha256: sha256(payload) };
      const journalFd = fs.openSync(journal, 'a');
      try { fs.writeSync(journalFd, `${JSON.stringify(record)}\n`); fs.fsyncSync(journalFd); }
      finally { fs.closeSync(journalFd); }
      records.push(record);
      // Drain Mongoose validation callbacks and warning queues in bounded batches.
      if (records.length % 25 === 0) await new Promise((resolve) => setImmediate(resolve));
      if (records.length % 250 === 0) console.log(`BULK_PROGRESS ${records.length}/${scope.length}`);
    }
    assert.equal(sourceGuard(), guard, 'Sources changed during generation');
    const report = verifyArtifacts(out);
    atomicWrite(path.join(out, 'dry-run.json'), report);
    return report;
  } finally { fs.closeSync(fd); fs.unlinkSync(lock); }
}

function verifyArtifacts(out, migrationApproval) {
  const header = JSON.parse(fs.readFileSync(path.join(out, 'header.json'), 'utf8'));
  const records = readJournal(out);
  const current = sourceGuard();
  if (header.sourceGuard !== current) {
    const migration = { oldSourceGuard: header.sourceGuard, currentSourceGuard: current,
      acceptedJournalSha256: records.at(-1).recordSha256 };
    assert.equal(migrationApproval, sha256(migration),
      'Source guard drift; explicit owner-reviewed --approve-source=<migration hash> required; never regenerate accepted plans');
  }
  assert.deepEqual(records.map((r) => r.systemId), manifest.systems.map((s) => s.id), 'Full cohort required');
  const report = { schemaVersion: policy.version, action: 'offline-full-dry-run', databaseWrites: 0,
    attempted: 0, ready: 0, protected: 0, blocked: [], bodyCounts: {}, naming: { inherited: 0, narrative: 0, languages: {} },
    initialMarketCount: 0, minimumGeneratedPerSystem: null,
    namingLanguagesByLane: { inherited: {}, narrative: {} },
    coverageGaps: { planet: [], moon: [], asteroid: [], station: [] },
    runtimeCompatible: true, preservation: header.preservation, sourceGuard: header.sourceGuard,
    assumptions: header.assumptions, journalSha256: records.at(-1).recordSha256 };
  const ids = new Set();
  for (const record of records) {
    const plan = JSON.parse(fs.readFileSync(path.join(out, `${record.systemId}.json`), 'utf8'));
    assert.equal(sha256(plan), record.artifactSha256, 'Artifact checksum mismatch');
    if (plan.status === 'protected') { report.protected++; continue; }
    report.attempted++;
    if (plan.status === 'blocked') { report.blocked.push({ systemId: plan.systemId, kind: plan.kind, reason: plan.reason }); continue; }
    const { planSha256, ...payload } = plan;
    assert.equal(sha256(payload), planSha256, 'Plan hash mismatch');
    report.ready++;
    report.initialMarketCount++;
    report.minimumGeneratedPerSystem = report.minimumGeneratedPerSystem === null ? plan.generatedBodies.length :
      Math.min(report.minimumGeneratedPerSystem, plan.generatedBodies.length);
    for (const family of ['planet', 'moon', 'asteroid'])
      if (!plan.generatedBodies.some((b) => b.bodyType === family)) report.coverageGaps[family].push(plan.systemId);
    if (!plan.station || !plan.market) report.coverageGaps.station.push(plan.systemId);
    for (const body of [...plan.baseBodies, ...plan.generatedBodies]) {
      assert.ok(!ids.has(body.id), `Global body ID collision: ${body.id}`);
      ids.add(body.id);
    }
    assert.ok(!ids.has(plan.market.marketId), 'Global market ID collision');
    ids.add(plan.market.marketId);
    for (const body of plan.generatedBodies) {
      report.bodyCounts[body.bodyType] = (report.bodyCounts[body.bodyType] || 0) + 1;
      const naming = body.universeMetadata.naming;
      if (['inherited', 'narrative'].includes(naming.lane)) {
        const counts = report.namingLanguagesByLane[naming.lane];
        counts[naming.language] = (counts[naming.language] || 0) + 1;
      }
    }
    for (const lane of ['inherited', 'narrative']) report.naming[lane] += plan.naming[lane];
    for (const [language, count] of Object.entries(plan.naming.languages)) report.naming.languages[language] = (report.naming.languages[language] || 0) + Number(count);
  }
  assert.ok(Object.values(report.coverageGaps).every((ids) => ids.length === 0), 'Incomplete success coverage');
  return { ...report, reportSha256: sha256(report) };
}

function* readyPlans(out) {
  for (const record of readJournal(out)) if (record.status === 'ready')
    yield JSON.parse(fs.readFileSync(path.join(out, `${record.systemId}.json`), 'utf8'));
}

module.exports = { prepare, verifyArtifacts, readyPlans, sourceGuard, atomicWrite, readJournal, acquireLock };
