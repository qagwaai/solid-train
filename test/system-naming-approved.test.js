'use strict';

const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const test = require('node:test');
const { getSolarSystemRegistry } = require('../src/model/solar-system-registry');
const { getExoplanetSystemProperNames } = require('../src/model/exoplanet-catalog');
const {
  comparisonKeys,
  getSourceEvidence,
  isProtected,
  validateNamingManifest,
} = require('../src/model/system-naming');
const historical = require('./fixtures/system-naming-proposal-manifest-v1.json');
const batch = require('../data/system-naming-weighted-batch-v1.json');
const fullCatalog = require('../data/system-naming-full-catalog-review-v1.json');
const eligibilityReview = require('../data/system-naming-eligibility-review-2026-11-06.json');
const finalizationBaseline = require('../data/system-naming-finalization-baseline-v1.json');
const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

test('pinned pre-finalization milestone publishes 119 assignments and records 144 eligible systems', () => {
  const manifest = finalizationBaseline;
  const runtime = getSolarSystemRegistry();
  const baseline = getSolarSystemRegistry({ namingManifest: historical });
  const disabled = getSolarSystemRegistry({
    namingManifest: { ...manifest, runtimeEnabled: false },
  });
  const active = getSolarSystemRegistry({ namingManifest: manifest });
  assert.equal(manifest.runtimeEnabled, true);
  assert.equal(manifest.approval.livePublicationAuthorized, true);
  assert.equal(manifest.approval.date, '2026-11-06');
  assert.equal(
    manifest.approval.activationStatus,
    'manifest-enabled; coordinated-backend-startup-and-live-verification-pending'
  );
  assert.equal(manifest.approval.independentLinguisticOrCulturalVerification, 'not-performed');
  assert.equal(Object.keys(manifest.eligibility).length, 144);
  assert.equal(Object.keys(manifest.approvedAssignments).length, 119);
  assert.equal(validateNamingManifest(baseline, manifest), true);
  assert.equal(hash(historical), batch.inputs.manifestSha256);
  assert.deepEqual(manifest.protections, historical.protections);
  assert.deepEqual(manifest.overrides, {});
  const expected = new Set([
    ...batch.rows.map((row) => row.systemId),
    ...fullCatalog.reviewProposals.map((row) => row.systemId),
  ]);
  const expectedEligible = new Set([
    ...expected,
    ...eligibilityReview.rows.map((row) => row.systemId),
  ]);
  assert.deepEqual(new Set(Object.keys(manifest.eligibility)), expectedEligible);
  assert.deepEqual(new Set(Object.keys(manifest.approvedAssignments)), expected);
  assert.equal(batch.rows.length, 25);
  assert.equal(fullCatalog.reviewProposals.length, 94);
  assert.equal(expected.size, 119);
  assert.equal(eligibilityReview.rows.length, 25);
  assert.equal(eligibilityReview.assignmentCount, 0);
  assert.equal(eligibilityReview.runtimeEnabled, false);
  assert.deepEqual(
    eligibilityReview.rows.map((row) => row.systemId),
    fullCatalog.pendingNominations
      .filter((row) => !expected.has(row.systemId))
      .sort((a, b) => a.rank.localeCompare(b.rank) || a.systemId.localeCompare(b.systemId))
      .slice(0, 25)
      .map((row) => row.systemId)
  );
  assert.equal(expectedEligible.size, 144);
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
  for (const row of fullCatalog.reviewProposals) {
    const system = baseline.find((entry) => entry.id === row.systemId);
    const activeSystem = active.find((entry) => entry.id === row.systemId);
    const decision = manifest.eligibility[row.systemId];
    const assignment = manifest.approvedAssignments[row.systemId];
    const evidence = getSourceEvidence(system);
    assert.ok(system);
    assert.ok(activeSystem);
    assert.equal(isProtected(system, manifest), false);
    assert.equal(system.catalogName, row.designation);
    assert.equal(evidence.snapshot, row.sourceSnapshot);
    assert.equal(evidence.digest, row.sourceEvidenceSha256);
    assert.equal(decision.decision, 'eligible');
    assert.equal(decision.sourceSnapshot, row.sourceSnapshot);
    assert.equal(decision.sourceEvidenceSha256, row.sourceEvidenceSha256);
    assert.equal(assignment.status, 'approved');
    assert.equal(assignment.candidateId, row.candidateId);
    assert.equal(assignment.settlementName, row.proposedSettlementName);
    assert.ok(assignment.provenance);
    assert.equal(manifest.aliases[row.systemId], undefined);
    for (const key of comparisonKeys(assignment.settlementName)) {
      assert.equal(nameKeys.has(key), false);
      nameKeys.add(key);
    }
    assert.equal(activeSystem.catalogName, row.designation);
    assert.equal(activeSystem.settlementName, row.proposedSettlementName);
    assert.equal(activeSystem.displayName, `${row.proposedSettlementName} (${row.designation})`);
  }
  for (const row of eligibilityReview.rows) {
    const system = baseline.find((entry) => entry.id === row.systemId);
    const activeSystem = active.find((entry) => entry.id === row.systemId);
    const disabledSystem = disabled.find((entry) => entry.id === row.systemId);
    const decision = manifest.eligibility[row.systemId];
    const evidence = getSourceEvidence(system);
    assert.ok(system);
    assert.equal(isProtected(system, manifest), false);
    assert.equal(evidence.digest, row.sourceEvidenceSha256);
    assert.equal(evidence.snapshot, eligibilityReview.sourceSnapshot);
    assert.deepEqual(getExoplanetSystemProperNames(row.systemId), []);
    assert.equal(decision.decision, 'eligible');
    assert.equal(decision.sourceEvidenceSha256, evidence.digest);
    assert.match(decision.reason, /source eligibility only .* no name or assignment approved/u);
    assert.equal(manifest.approvedAssignments[row.systemId], undefined);
    assert.equal(activeSystem.displayName, disabledSystem.displayName);
    assert.equal(activeSystem.settlementName, null);
  }
  assert.equal(active.filter((system) => system.settlementName).length, 119);
  assert.equal(
    active.filter((system, i) => system.displayName !== disabled[i].displayName).length,
    119
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
    runtime,
    'injected disabled projection must not replace runtime cache'
  );
});
