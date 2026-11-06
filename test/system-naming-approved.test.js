'use strict';

const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const test = require('node:test');
const { getSolarSystemRegistry } = require('../src/model/solar-system-registry');
const {
  getSystemNamingManifest,
  comparisonKeys,
  getSourceEvidence,
  isProtected,
  validateNamingManifest,
} = require('../src/model/system-naming');
const historical = require('./fixtures/system-naming-proposal-manifest-v1.json');
const batch = require('../data/system-naming-weighted-batch-v1.json');
const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

test('active manifest exactly publishes the frozen 25 and disabled clone restores baseline', () => {
  const manifest = getSystemNamingManifest();
  const baseline = getSolarSystemRegistry({ namingManifest: historical });
  const disabled = getSolarSystemRegistry({
    namingManifest: { ...manifest, runtimeEnabled: false },
  });
  const active = getSolarSystemRegistry();
  assert.equal(manifest.runtimeEnabled, true);
  // This is historical review metadata, not the later activation authorization.
  assert.equal(manifest.approval.livePublicationAuthorized, false);
  assert.equal(manifest.approval.independentLinguisticOrCulturalVerification, 'not-performed');
  assert.equal(Object.keys(manifest.eligibility).length, 25);
  assert.equal(Object.keys(manifest.approvedAssignments).length, 25);
  assert.equal(validateNamingManifest(baseline, manifest), true);
  assert.equal(hash(historical), batch.inputs.manifestSha256);
  assert.deepEqual(manifest.protections, historical.protections);
  assert.deepEqual(manifest.overrides, {});
  const expected = new Set(batch.rows.map((row) => row.systemId));
  assert.deepEqual(new Set(Object.keys(manifest.eligibility)), expected);
  assert.deepEqual(new Set(Object.keys(manifest.approvedAssignments)), expected);
  assert.equal(batch.rows.length, 25);
  assert.equal(expected.size, 25);
  assert.equal(baseline.length, 4845);
  assert.equal(active.length, baseline.length);
  assert.equal(disabled.length, baseline.length);
  assert.equal(Object.keys(manifest.aliases).length, 11);
  const nameKeys = new Set();
  for (const row of batch.rows) {
    const system = baseline.find((entry) => entry.id === row.systemId);
    const activeSystem = active.find((entry) => entry.id === row.systemId);
    const evidence = getSourceEvidence(system);
    const decision = manifest.eligibility[row.systemId];
    const assignment = manifest.approvedAssignments[row.systemId];
    assert.equal(isProtected(system, manifest), false);
    assert.equal(decision.decision, 'eligible');
    assert.equal(evidence.digest, row.sourceEvidenceSha256);
    assert.equal(decision.sourceEvidenceSha256, evidence.digest);
    assert.equal(decision.sourceSnapshot, evidence.snapshot);
    assert.equal(assignment.status, 'approved');
    assert.equal(assignment.settlementName, row.proposedSettlementName);
    assert.equal(assignment.candidateId, row.candidateId);
    assert.equal(assignment.version, manifest.manifestVersion);
    assert.ok(assignment.provenance);
    assert.deepEqual(
      manifest.aliases[row.systemId] || [],
      row.transliteration ? [row.transliteration] : []
    );
    assert.equal(assignment.settlementName, assignment.settlementName.normalize('NFC'));
    for (const key of comparisonKeys(assignment.settlementName)) {
      assert.equal(nameKeys.has(key), false);
      nameKeys.add(key);
    }
    assert.equal(system.catalogName, row.originalDesignation);
    assert.equal(activeSystem.catalogName, row.originalDesignation);
    assert.equal(activeSystem.settlementName, row.proposedSettlementName);
    assert.equal(activeSystem.displayName, row.proposedDisplayName);
    assert.deepEqual(activeSystem.aliases, [
      row.originalDesignation,
      ...(row.transliteration ? [row.transliteration] : []),
    ]);
    assert.deepEqual(
      disabled.find((entry) => entry.id === row.systemId).aliases,
      row.transliteration ? [row.transliteration] : []
    );
  }
  assert.equal(active.filter((system) => system.settlementName).length, 25);
  assert.equal(
    active.filter((system, i) => system.displayName !== disabled[i].displayName).length,
    25
  );
  for (let i = 0; i < baseline.length; i++) {
    assert.equal(disabled[i].displayName, baseline[i].displayName);
    assert.equal(disabled[i].settlementName, null);
    if (!expected.has(baseline[i].id)) assert.deepEqual(active[i], disabled[i]);
    for (const projection of [disabled[i], active[i]]) {
      const { displayName, settlementName, aliases, ...identity } = projection;
      const {
        displayName: oldLabel,
        settlementName: oldSettlement,
        aliases: oldAliases,
        ...oldIdentity
      } = baseline[i];
      assert.deepEqual(identity, oldIdentity);
      for (const field of [
        'approval',
        'eligibility',
        'provenance',
        'version',
        'searchTerms',
        'approvedAssignments',
      ]) {
        assert.equal(Object.hasOwn(projection, field), false);
      }
    }
  }
  assert.strictEqual(
    getSolarSystemRegistry(),
    active,
    'injected disabled projection must not replace runtime cache'
  );
});
