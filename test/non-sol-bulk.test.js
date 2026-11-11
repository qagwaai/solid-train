'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const manifest = require('../data/non-sol-celestial-generation-manifest-v1.json');
const { generateBulkSystem, policy, buildStation } = require('../scripts/lib/non-sol-bulk-generator');
const { prepare, readJournal, verifyArtifacts, acquireLock } = require('../scripts/lib/non-sol-bulk-artifacts');
const { parseArguments, assertFinalApproval } = require('../scripts/non-sol-bulk-seed');
const { checkpoint } = require('../scripts/lib/non-sol-bulk-lifecycle');
const { reconcileBulkSeed } = require('../src/model/non-sol-bulk-reconciliation');
const { sha256 } = require('../src/model/copper-vale-catalog-reconciliation');
const { buildSeededCelestialBodiesForSolarSystem } = require('../src/model/solar-system-celestial-seed');
const { previewCopperValeP4 } = require('../src/model/non-sol-p4-preview');
const { seedSolarSystemCelestialBodiesAsync } = require('../src/handlers/context/celestial-operations-service');
const { CelestialBody, Market } = require('../src/db/models');

const row = (id) => manifest.systems.find((s) => s.id === id);
const plan = () => generateBulkSystem(row('exo-kepler-11'));

test('deterministic complete hypothetical families preserve catalog and supported runtime shape', async () => {
  const first = await plan();
  assert.deepEqual(await plan(), first);
  assert.equal(first.status, 'ready');
  assert.equal(first.runtimeCompatible, true);
  assert.deepEqual(first.baseBodies, buildSeededCelestialBodiesForSolarSystem(first.systemId, policy.epoch));
  for (const family of ['planet', 'moon', 'asteroid', 'comet', 'tno'])
    assert.ok(first.generatedBodies.some((b) => b.bodyType === family), family);
  assert.equal(first.station.marketId, `${first.systemId}-bulk-initial-exchange`);
  assert.ok(first.generatedBodies.filter((b) => b.bodyType === 'asteroid').every((b) =>
    b.universeMetadata.resourceProfile.accessibility === 'accessible'));
});

test('bulk generation awaits model validation and propagates failures', async (t) => {
  for (const model of [CelestialBody, Market]) {
    const validation = t.mock.method(model.prototype, 'validate', async () => {
      throw new Error('validation failed');
    });
    await assert.rejects(plan(), /validation failed/);
    assert.ok(validation.mock.callCount() > 0);
    validation.mock.restore();
  }
});

test('close binary, evolved and compact domains are attempted without literature/occurrence gates', async () => {
  for (const id of ['cygnus-x1', 'exo-kepler-16', 'exo-11-com', 'exo-2mass-j01225093-2439505', 'exo-hd-4113', 'exo-cd-35-2722']) {
    const result = await generateBulkSystem(row(id));
    assert.equal(result.status, 'ready', `${id}: ${result.reason}`);
    assert.equal(result.scientificStatus, 'hypothetical-uncertain');
    assert.ok(result.generatedBodies.some((b) => b.bodyType === 'moon'), `${id}: no moon`);
  }
});

test('Sol and accepted Copper Vale cannot enter the bulk generator; accepted P4 remains fixed', async () => {
  await assert.rejects(generateBulkSystem(row('exo-gj-9066')));
  await assert.rejects(generateBulkSystem({ id: 'sol' }));
  const frozen = require('../data/copper-vale-body-naming-manifest-v1.json');
  assert.equal(previewCopperValeP4().p3InputSha256, frozen.p3InputSha256);
});

test('cumulative naming allocation honors rounded global 60/40 and all weighted languages', async () => {
  let offset = 0;
  let narrative = 0;
  const languages = new Set();
  for (let i = 0; i < 20; i++) {
    const p = await generateBulkSystem(row('exo-kepler-11'), { namingOffset: offset, narrativeOffset: narrative });
    offset += p.naming.inherited + p.naming.narrative;
    narrative += p.naming.narrative;
    Object.keys(p.naming.languages).forEach((l) => languages.add(l));
  }
  assert.equal(offset - narrative, Math.round(offset * 0.6));
  for (const language of require('../data/system-naming-weight-policy-v2.json').languages)
    assert.ok(languages.has(language.language), language.language);
});

test('station screen rejects absent usable host instead of pretending activation creates an orbit', () => {
  assert.equal(buildStation('x', { displayName: 'X' }, [], {}), null);
});

test('local persistent CLI rejects remote targets, unsafe URIs, unapproved writes and invalid batches', () => {
  for (const target of ['mongodb://remote:27017/game', 'mongodb://localhost/game',
    'mongodb://user:secret@localhost:27017/game', 'mongodb://localhost:27017/game?x=1',
    'mongodb+srv://localhost:27017/game'])
    assert.throws(() => parseArguments([`--target=${target}`]));
  assert.throws(() => parseArguments(['--action=apply', '--target=mongodb://localhost:27017/game']));
  assert.throws(() => parseArguments(['--batch-size=0']));
  assert.throws(() => parseArguments(['--action=dry-run', '--approve=' + 'a'.repeat(64)]));
  assert.equal(parseArguments([]).writes, false);
  assert.equal(parseArguments(['--action=apply', '--target=mongodb://127.0.0.1:27017/game',
    '--approve=' + 'a'.repeat(64)]).writes, true);
});

test('explicit final approval is bound to the entire target/source/full-cohort dry-run receipt', () => {
  const receipt = { approvalSha256: 'a'.repeat(64), target: 'mongodb://localhost:27017/game',
    sourceGuard: 'source', results: [{ systemId: 'x', status: 'absent' }], fingerprint: {} };
  assert.doesNotThrow(() => assertFinalApproval(structuredClone(receipt), receipt, receipt.approvalSha256));
  assert.throws(() => assertFinalApproval(receipt, receipt, 'b'.repeat(64)), /approval mismatch/);
  for (const field of ['target', 'sourceGuard', 'results', 'fingerprint'])
    assert.throws(() => assertFinalApproval(receipt, { ...receipt, [field]: 'changed' }, receipt.approvalSha256), /changed since full dry-run/);
});

test('offline interruption resumes verified artifacts, repairs a torn append and refuses source/invariant drift', async () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'stellar-bulk-'));
  try {
    let calls = 0;
    await assert.rejects(prepare(out, { afterArtifact: () => { if (++calls === 2) throw new Error('interrupt'); } }), /interrupt/);
    const before = readJournal(out);
    assert.equal(before.length, 1);
    fs.appendFileSync(path.join(out, 'progress.jsonl'), '{"torn":');
    await assert.rejects(prepare(out, { afterArtifact: () => { throw new Error('interrupt again'); } }), /interrupt again/);
    assert.deepEqual(readJournal(out), before);
    assert.throws(() => verifyArtifacts(out), /Full cohort/);
    const headerFile = path.join(out, 'header.json');
    const header = JSON.parse(fs.readFileSync(headerFile, 'utf8'));
    header.sourceGuard = 'a'.repeat(64);
    fs.writeFileSync(headerFile, JSON.stringify(header));
    await assert.rejects(prepare(out), /Source\/invariant drift/);
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
});

test('journal and artifact corruption fail closed, and live-worker locks are not stolen', async () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'stellar-bulk-'));
  try {
    let calls = 0;
    await assert.rejects(prepare(out, { afterArtifact: () => { if (++calls === 2) throw new Error('interrupt'); } }));
    const first = readJournal(out)[0];
    fs.writeFileSync(path.join(out, `${first.systemId}.json`), '{}');
    await assert.rejects(prepare(out), /Artifact drift/);
    const file = path.join(out, '.lock');
    const fd = acquireLock(file);
    assert.throws(() => acquireLock(file), /Live bulk worker/);
    fs.closeSync(fd);
    const journal = path.join(out, 'progress.jsonl');
    fs.writeFileSync(journal, fs.readFileSync(journal, 'utf8').replace(first.artifactSha256, 'a'.repeat(64)));
    assert.throws(() => readJournal(out), /checksum/);
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
});

test('bulk lazy seed precedence verifies complete checkpoint on cache miss and refuses force/incomplete/drift', async () => {
  const p = await plan();
  const bodies = [...p.baseBodies, ...p.generatedBodies];
  const complete = checkpoint(p, 'guard', 'complete');
  let writes = 0;
  const ctx = { toNonEmptyString: (v) => typeof v === 'string' ? v.trim() : '',
    getCurrentTimestamp: () => '2026-11-08T00:00:00.000Z', log: () => {},
    celestialBodiesById: new Map(), normalizeCelestialBody: (b) => b,
    databaseService: { getSolarSystemCelestialSeedState: async () => null,
      getNonSolBulkSeedState: async () => complete, getCelestialBodies: async () => bodies,
      addOrUpdateCelestialBody: async () => { writes++; }, setSolarSystemCelestialSeedState: async () => { writes++; } } };
  const result = await seedSolarSystemCelestialBodiesAsync(ctx, { solarSystemId: p.systemId });
  assert.equal(result.success, true);
  assert.equal(result.bodyCount, bodies.length);
  assert.equal(writes, 0);
  const force = await seedSolarSystemCelestialBodiesAsync(ctx, { solarSystemId: p.systemId, force: true });
  assert.equal(force.success, false);
  assert.equal(writes, 0);
  ctx.databaseService.getNonSolBulkSeedState = async () => checkpoint(p, 'guard', 'applying');
  assert.equal((await seedSolarSystemCelestialBodiesAsync(ctx, { solarSystemId: p.systemId })).success, false);
  const changed = structuredClone(bodies);
  changed.at(-1).displayName = 'Unapproved';
  assert.throws(() => reconcileBulkSeed(complete, changed), /mismatch/);
  const forged = { ...complete, baseSha256: 'bad' };
  const { checkpointSha256, ...payload } = forged;
  forged.checkpointSha256 = sha256(payload);
  assert.throws(() => reconcileBulkSeed(forged, bodies), /source drift/);
});
