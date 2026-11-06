'use strict';

const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const test = require('node:test');
const { getSolarSystemRegistry } = require('../src/model/solar-system-registry');
const { getSystemNamingManifest } = require('../src/model/system-naming');
const batch = require('../data/system-naming-weighted-batch-v1.json');
const policy = require('../data/system-naming-weight-policy-v2.json');
const {
  getHamiltonScopeQuotas,
  getHamiltonQuotas,
  validateCatalogScopeSize,
} = require('../src/model/system-naming-weighted-allocation');
const {
  JSON_OUTPUT,
  MARKDOWN_OUTPUT,
  buildFullCatalogReport,
  renderMarkdown,
} = require('../scripts/dry-run-system-naming-full-catalog');

const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const expectedLanguageQuotas = [
  ['english', 1200],
  ['mandarin', 720],
  ['russian', 480],
  ['spanish', 240],
  ['arabic', 200],
  ['hindi', 200],
  ['portuguese', 160],
  ['japanese', 160],
  ['french', 160],
  ['swahili', 120],
  ['indonesian', 120],
  ['turkish', 80],
  ['korean', 40],
  ['german', 40],
  ['other-reviewed-traditions', 80],
];

test('full-catalog Hamilton scope is bounded, deterministic and separate from the 100-item batch cap', () => {
  assert.equal(validateCatalogScopeSize(4845), undefined);
  assert.throws(() => validateCatalogScopeSize(0), RangeError);
  assert.throws(() => validateCatalogScopeSize(5001), RangeError);
  assert.throws(() => getHamiltonQuotas(101, policy), RangeError);
  assert.deepEqual(
    getHamiltonScopeQuotas(4000, policy).map(({ id, quota }) => [id, quota]),
    expectedLanguageQuotas
  );
  assert.equal(
    getHamiltonScopeQuotas(4000, policy).reduce((total, item) => total + item.quota, 0),
    4000
  );
});

test('full-catalog report inventories every system while preserving the active 25 and gating all new names', () => {
  const registry = getSolarSystemRegistry();
  const manifest = getSystemNamingManifest();
  const report = buildFullCatalogReport({ registry, manifest });
  const reordered = buildFullCatalogReport({ registry: [...registry].reverse(), manifest });
  const stored = JSON.parse(fs.readFileSync(JSON_OUTPUT, 'utf8'));
  const markdown = fs.readFileSync(MARKDOWN_OUTPUT, 'utf8');

  assert.deepEqual(report, reordered);
  assert.deepEqual(stored, report);
  assert.equal(report.reportVersion, 1);
  assert.equal(report.status, 'full-catalog-offline-review-no-new-activation');
  assert.equal(report.registryCount, 4845);
  assert.equal(report.existingActiveAssignmentCount, 25);
  assert.equal(report.existingAssignments.length, 25);
  assert.equal(report.existingAssignmentsUnchanged, true);
  assert.equal(report.supportedCatalogPatternNominationCount, 4025);
  assert.equal(report.remainingCatalogPatternNominationCount, 4000);
  assert.equal(report.protectedSystemCount, 162);
  assert.equal(report.nonNominatedSystemCount, 658);
  assert.equal(
    report.existingActiveAssignmentCount +
      report.remainingCatalogPatternNominationCount +
      report.protectedSystemCount +
      report.nonNominatedSystemCount,
    report.registryCount
  );
  assert.equal(report.newEligibilityApprovals, 0);
  assert.equal(report.explicitlyEligibleUnassignedSystemCount, 0);
  assert.equal(report.approvedUnusedContentCount, 0);
  assert.equal(report.additionalActivationCount, 0);
  assert.equal(report.sourcePatternNominationsAreEligibilityApproval, false);
  assert.deepEqual(report.additionalActivations, []);
  assert.equal(report.runtimeEnabled, true);
  assert.equal(report.published, false);
  assert.equal(report.liveDatabaseWrites, 0);
  assert.equal(report.contractChanges, 0);

  assert.deepEqual(
    report.allocation.quotas.map(({ languageId, scopeQuota }) => [languageId, scopeQuota]),
    expectedLanguageQuotas
  );
  assert.ok(report.allocation.filledProposalCount > 0);
  assert.equal(report.allocation.filledProposalCount, report.reviewProposals.length);
  assert.equal(report.allocation.unfilledScopeCount + report.reviewProposals.length, 4000);
  assert.ok(
    report.allocation.quotas.every(
      (quota) => quota.unfilledForLanguage + quota.provisionalProposalCount === quota.scopeQuota
    )
  );
  assert.ok(report.allocation.quotas.every((quota) => quota.noCrossLanguageRedistribution));
  assert.equal(report.pendingNominations.length, 4000);
  assert.ok(
    report.pendingNominations.every(
      (row) => row.sourceEligibilityDecision === 'not-decided' && row.runtimeEnabled === false
    )
  );
  const inventoryById = new Map(
    report.contentReviewInventory.map((item) => [item.candidateId, item])
  );
  assert.equal(
    new Set(report.reviewProposals.map((row) => row.candidateId)).size,
    report.reviewProposals.length
  );
  for (const row of report.reviewProposals) {
    const candidate = inventoryById.get(row.candidateId);
    const quota = policy.languages.find((item) => item.id === row.policyLanguageId);
    assert.ok(candidate);
    assert.equal(candidate.activeSystemId, null);
    assert.equal(candidate.contentApproved, false);
    assert.ok(quota.candidateLanguageLabels.includes(candidate.language));
    assert.equal(row.proposedDisplayName, `${candidate.name} (${row.designation})`);
    assert.equal(row.assignmentStatus, 'provisional-pairing-pending-content-and-source-review');
  }
  assert.equal(
    report.pendingNominations.length,
    new Set(report.pendingNominations.map((row) => row.systemId)).size
  );
  assert.ok(
    report.pendingNominations.every((row) => /^[0-9a-f]{64}$/u.test(row.sourceEvidenceSha256))
  );

  const activeById = new Map(
    report.existingAssignments.map((assignment) => [assignment.systemId, assignment])
  );
  assert.deepEqual(
    report.existingAssignments.map(({ systemId, candidateId, settlementName }) => [
      systemId,
      candidateId,
      settlementName,
    ]),
    Object.entries(manifest.approvedAssignments)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([systemId, assignment]) => [
        systemId,
        assignment.candidateId,
        assignment.settlementName,
      ])
  );
  for (const row of batch.rows) {
    const active = activeById.get(row.systemId);
    assert.ok(active);
    assert.equal(active.candidateId, row.candidateId);
    assert.equal(active.settlementName, row.proposedSettlementName);
    assert.equal(active.unchanged, true);
  }
  assert.equal(report.inputs.existingAssignmentsSha256, digest(report.existingAssignments));

  const landmarkItems = report.contentReviewInventory.filter(
    (candidate) => candidate.lane === 'earth-remembrance'
  );
  assert.equal(landmarkItems.length, 5);
  assert.ok(
    landmarkItems.every(
      (candidate) =>
        candidate.reviewStatus === 'already-active-do-not-reassign' &&
        candidate.assignedToNewSystem === false &&
        candidate.activeSystemId
    )
  );
  assert.ok(
    report.contentReviewInventory.some((candidate) => candidate.lane === 'original-fictional')
  );
  assert.ok(
    report.contentReviewInventory.some((candidate) => candidate.lane === 'multilingual-provisional')
  );
  assert.ok(
    report.contentReviewInventory.every((candidate) => candidate.assignedToNewSystem === false)
  );
  const newLandmarkSketches = report.contentReviewInventory.filter(
    (candidate) => candidate.lane === 'earth-landmark-provisional'
  );
  assert.equal(newLandmarkSketches.length, 18);
  assert.ok(
    newLandmarkSketches.every(
      (candidate) =>
        candidate.reviewStatus === 'new-provisional-review-sketch-not-approved' &&
        candidate.contentApproved === false &&
        candidate.language === 'English' &&
        candidate.earthReference &&
        candidate.assignedToNewSystem === false
    )
  );
  assert.equal(report.contentReviewInventory.length, 123);

  const rendered = renderMarkdown(report);
  assert.match(rendered, /all 4845 checked-in registry systems/u);
  assert.match(rendered, /Additional activations: \*\*0\*\*/u);
  assert.match(rendered, /Shortages are not redistributed across languages/u);
  assert.match(rendered, /five earlier Earth-landmark references are already assigned/u);
  assert.match(markdown, /full-catalog-offline-review-no-new-activation/u);
  assert.equal(manifest.runtimeEnabled, true);
  assert.equal(Object.keys(manifest.approvedAssignments).length, 25);
});
