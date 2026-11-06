'use strict';

const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { getSolarSystemRegistry } = require('../src/model/solar-system-registry');
const {
  getSystemNamingManifest,
  getSourceEvidence,
  isProtected,
  comparisonKeys,
} = require('../src/model/system-naming');
const { getCandidates, getPattern, compareText } = require('./dry-run-system-naming-100-review');
const {
  getHamiltonScopeQuotas,
  allocateWeightedScopeCandidates,
  validateCatalogScopeSize,
} = require('../src/model/system-naming-weighted-allocation');
const { addReservedLabels } = require('../src/model/system-naming-proposal');

const ROOT = path.join(__dirname, '..');
const POLICY_PATH = path.join(ROOT, 'data', 'system-naming-weight-policy-v2.json');
const BANK_PATH = path.join(ROOT, 'data', 'system-naming-review-bank-v1.json');
const SUPPLEMENT_PATH = path.join(
  ROOT,
  'data',
  'system-naming-weighted-landmark-supplement-v1.json'
);
const REVIEW_CANDIDATES_PATH = path.join(
  ROOT,
  'data',
  'system-naming-full-catalog-review-candidates-v1.json'
);
const HISTORICAL_PREVIEW_PATH = path.join(ROOT, 'data', 'system-naming-100-review-preview.json');
const JSON_OUTPUT = path.join(ROOT, 'data', 'system-naming-full-catalog-review-v1.json');
const MARKDOWN_OUTPUT = path.join(ROOT, 'docs', 'system-naming-full-catalog-review-2026-11-05.md');
const REPORT_VERSION = 1;
const ALGORITHM_VERSION = 'system-naming-full-catalog-review-v1';
const SEED = 'stellar-full-catalog-review-2026-11-05-v1';
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const digestJson = (value) => sha256(JSON.stringify(value));

function hashRank(system, evidence) {
  return sha256(JSON.stringify([ALGORITHM_VERSION, SEED, system.id, evidence.digest]));
}

function getCatalogNominations(registry, manifest) {
  return registry
    .filter((system) => system.source === 'exoplanet-catalog' && !isProtected(system, manifest))
    .map((system) => ({
      system,
      evidence: getSourceEvidence(system),
      pattern: getPattern(system.catalogName || system.displayName),
    }))
    .filter(({ evidence, pattern }) => evidence && pattern)
    .map(({ system, evidence, pattern }) => ({
      systemId: system.id,
      designation: system.catalogName || system.displayName,
      source: system.source,
      matchedDesignationPattern: pattern,
      sourceSnapshot: evidence.snapshot,
      sourceEvidenceSha256: evidence.digest,
      rank: hashRank(system, evidence),
    }))
    .sort(
      (left, right) =>
        compareText(left.rank, right.rank) || compareText(left.systemId, right.systemId)
    );
}

function getContentReviewInventory(
  bank,
  supplement,
  reviewCandidates,
  manifest,
  historicalPreview
) {
  const activeByCandidateId = new Map(
    Object.entries(manifest.approvedAssignments || {}).map(([systemId, assignment]) => [
      assignment.candidateId,
      {
        systemId,
        settlementName: assignment.settlementName,
      },
    ])
  );
  const previouslyProposedIds = new Set(
    (historicalPreview.rows || []).map((row) => row.candidateId).filter(Boolean)
  );
  const baseCandidates = getCandidates(bank).map((candidate) => ({
    ...candidate,
    sourceBankFile: 'data/system-naming-review-bank-v1.json',
    sourceBankVersion: bank.bankVersion,
    contentApprovalScope: candidate.approved
      ? 'existing-editorial-content-approval-only'
      : 'not-approved',
    earthReference: null,
  }));
  const landmarkCandidates = supplement.candidates.map((candidate) => ({
    candidateId: candidate.candidateId,
    name: candidate.name,
    language: candidate.language,
    script: candidate.script,
    transliteration: candidate.transliteration || null,
    gloss: candidate.provisionalGloss || null,
    lane: candidate.lane,
    editorialStatus: candidate.editorialStatus,
    allAgesStatus: candidate.allAgesStatus,
    rightsStatus: candidate.rightsStatus,
    linguisticStatus: candidate.linguisticStatus,
    approved: candidate.approved === true,
    contentApprovalScope: supplement.approval.approvalScope,
    earthReference: candidate.earthReference,
    sourceBankFile: 'data/system-naming-weighted-landmark-supplement-v1.json',
    sourceBankVersion: supplement.supplementVersion,
  }));
  if (
    reviewCandidates?.candidateBankVersion !== 1 ||
    reviewCandidates?.status !== 'unapproved-offline-review-sketches' ||
    reviewCandidates.runtimeConsumed !== false ||
    reviewCandidates.approval?.contentApproved !== false ||
    reviewCandidates.approval?.assignmentOrPublicationAuthorization !== 'not-granted' ||
    !Array.isArray(reviewCandidates.candidates)
  ) {
    throw new Error('Full-catalog review candidate bank must remain unapproved and offline-only.');
  }
  const newReviewCandidates = reviewCandidates.candidates.map((candidate) => ({
    ...candidate,
    lane: 'earth-landmark-provisional',
    editorialStatus: 'new-review-sketch-not-approved',
    allAgesStatus: reviewCandidates.approval.allAgesReview,
    rightsStatus: reviewCandidates.approval.legalClearance,
    linguisticStatus: reviewCandidates.approval.independentLinguisticOrCulturalVerification,
    approved: false,
    contentApprovalScope: 'none-review-only',
    sourceBankFile: 'data/system-naming-full-catalog-review-candidates-v1.json',
    sourceBankVersion: reviewCandidates.candidateBankVersion,
  }));
  const combinedCandidates = [...baseCandidates, ...landmarkCandidates, ...newReviewCandidates];
  const ids = new Set();
  const nameKeys = new Map();
  return combinedCandidates
    .map((candidate) => {
      if (ids.has(candidate.candidateId)) {
        throw new Error(
          `Duplicate candidate ID across naming review banks: ${candidate.candidateId}`
        );
      }
      ids.add(candidate.candidateId);
      if (
        typeof candidate.name !== 'string' ||
        candidate.name !== candidate.name.normalize('NFC') ||
        /[\p{Cc}\u200b-\u200f\u202a-\u202e\u2060-\u206f]/u.test(candidate.name)
      ) {
        throw new Error(`Invalid full-catalog review candidate name: ${candidate.name}`);
      }
      for (const key of comparisonKeys(candidate.name)) {
        if (nameKeys.has(key)) {
          throw new Error(
            `Full-catalog review candidate names collide: ${nameKeys.get(key)} and ${candidate.candidateId}`
          );
        }
        nameKeys.set(key, candidate.candidateId);
      }
      const activeAssignment = activeByCandidateId.get(candidate.candidateId) || null;
      const status = activeAssignment
        ? 'already-active-do-not-reassign'
        : previouslyProposedIds.has(candidate.candidateId)
          ? 'historical-review-proposal-not-an-assignment'
          : candidate.lane === 'earth-landmark-provisional'
            ? 'new-provisional-review-sketch-not-approved'
            : 'review-bank-item-not-approved-for-assignment';
      return {
        candidateId: candidate.candidateId,
        name: candidate.name,
        language: candidate.language,
        script: candidate.script,
        transliteration: candidate.transliteration || null,
        provisionalGloss: candidate.gloss || null,
        lane: candidate.lane,
        editorialStatus: candidate.editorialStatus,
        allAgesStatus: candidate.allAgesStatus,
        rightsStatus: candidate.rightsStatus,
        linguisticStatus: candidate.linguisticStatus,
        contentApproved: candidate.approved === true,
        contentApprovalScope: candidate.contentApprovalScope,
        earthReference: candidate.earthReference,
        sourceBankFile: candidate.sourceBankFile,
        sourceBankVersion: candidate.sourceBankVersion,
        reviewStatus: status,
        activeSystemId: activeAssignment?.systemId || null,
        activeSettlementName: activeAssignment?.settlementName || null,
        assignedToNewSystem: false,
        runtimeEnabled: false,
      };
    })
    .sort(
      (left, right) =>
        compareText(left.language, right.language) ||
        compareText(left.lane, right.lane) ||
        compareText(left.candidateId, right.candidateId)
    );
}

function buildFullCatalogReport({
  registry = getSolarSystemRegistry(),
  manifest = getSystemNamingManifest(),
  policy = require(POLICY_PATH),
  bank = require(BANK_PATH),
  supplement = require(SUPPLEMENT_PATH),
  reviewCandidates = require(REVIEW_CANDIDATES_PATH),
  historicalPreview = JSON.parse(fs.readFileSync(HISTORICAL_PREVIEW_PATH, 'utf8')),
} = {}) {
  validateCatalogScopeSize(registry.length);
  const registryById = new Map(registry.map((system) => [system.id, system]));
  if (registryById.size !== registry.length)
    throw new Error('Registry contains duplicate system IDs.');

  const activeAssignments = manifest.approvedAssignments || {};
  const activeSystemIds = new Set(Object.keys(activeAssignments));
  const allNominations = getCatalogNominations(registry, manifest);
  const nominationById = new Map(allNominations.map((row) => [row.systemId, row]));
  const existingAssignmentRows = [...activeSystemIds].sort(compareText).map((systemId) => {
    const nomination = nominationById.get(systemId);
    const eligibility = manifest.eligibility?.[systemId];
    const assignment = activeAssignments[systemId];
    if (!nomination || !eligibility || eligibility.decision !== 'eligible') {
      throw new Error(
        `Existing approved assignment is outside current source eligibility: ${systemId}`
      );
    }
    if (
      eligibility.sourceEvidenceSha256 !== nomination.sourceEvidenceSha256 ||
      eligibility.sourceSnapshot !== nomination.sourceSnapshot
    ) {
      throw new Error(`Existing source evidence no longer matches approved manifest: ${systemId}`);
    }
    return {
      systemId,
      designation: nomination.designation,
      sourceEvidenceSha256: nomination.sourceEvidenceSha256,
      settlementName: assignment.settlementName,
      candidateId: assignment.candidateId,
      eligibilityDecision: eligibility.decision,
      assignmentStatus: assignment.status,
      unchanged: true,
      runtimeEnabled: manifest.runtimeEnabled === true,
    };
  });

  const pendingNominations = allNominations.filter(
    ({ systemId }) => !activeSystemIds.has(systemId)
  );
  const scopeQuotas = getHamiltonScopeQuotas(pendingNominations.length, policy);
  const pendingByLanguage = [];
  let nominationIndex = 0;
  for (const quota of scopeQuotas) {
    for (let languageSlot = 1; languageSlot <= quota.quota; languageSlot += 1) {
      const nomination = pendingNominations[nominationIndex];
      nominationIndex += 1;
      if (!nomination)
        throw new Error('Full-catalog language allocation exceeded pending nominations.');
      pendingByLanguage.push({
        ...nomination,
        languageSlot,
        policyLanguageId: quota.id,
        policyLanguage: quota.language,
        policyWeight: quota.weight,
        policyQuota: quota.quota,
        sourceEligibilityDecision: 'not-decided',
        assignmentStatus: 'pending-human-source-and-proper-name-review',
        proposedSettlementName: null,
        proposedDisplayName: null,
        runtimeEnabled: false,
      });
    }
  }
  if (nominationIndex !== pendingNominations.length) {
    throw new Error(
      'Full-catalog language allocation did not account for every pending nomination.'
    );
  }

  const protectedSystemIds = registry
    .filter((system) => isProtected(system, manifest))
    .map((system) => system.id)
    .sort(compareText);
  const nonNominatedSystemIds = registry
    .filter(
      (system) =>
        !activeSystemIds.has(system.id) &&
        !protectedSystemIds.includes(system.id) &&
        !nominationById.has(system.id)
    )
    .map((system) => system.id)
    .sort(compareText);
  const classificationCount =
    existingAssignmentRows.length +
    pendingByLanguage.length +
    protectedSystemIds.length +
    nonNominatedSystemIds.length;
  if (classificationCount !== registry.length) {
    throw new Error(
      `Full-catalog inventory accounted for ${classificationCount} of ${registry.length} systems.`
    );
  }

  const contentReviewInventory = getContentReviewInventory(
    bank,
    supplement,
    reviewCandidates,
    manifest,
    historicalPreview
  );
  const eligibleUnassignedIds = Object.entries(manifest.eligibility || {})
    .filter(
      ([systemId, eligibility]) =>
        !activeSystemIds.has(systemId) &&
        eligibility.decision === 'eligible' &&
        eligibility.reviewStatus === 'owner-approved-source-eligibility' &&
        nominationById.has(systemId) &&
        eligibility.sourceEvidenceSha256 === nominationById.get(systemId).sourceEvidenceSha256
    )
    .map(([systemId]) => systemId);
  const availableApprovedContent = contentReviewInventory.filter(
    (candidate) =>
      candidate.contentApproved && candidate.reviewStatus !== 'already-active-do-not-reassign'
  );
  const additionalActivations = [];
  if (eligibleUnassignedIds.length && availableApprovedContent.length) {
    throw new Error(
      'Additional owner-approved eligibility and approved content exist; activation needs a reviewed pairing before this report can proceed.'
    );
  }

  const reservedKeys = new Set();
  for (const system of registry) addReservedLabels(reservedKeys, system);
  for (const assignment of Object.values(activeAssignments)) {
    for (const key of comparisonKeys(assignment.settlementName)) reservedKeys.add(key);
  }
  const reviewAllocation = allocateWeightedScopeCandidates({
    count: pendingNominations.length,
    policy,
    candidates: contentReviewInventory.filter((candidate) => !candidate.activeSystemId),
    reservedKeys,
    algorithmVersion: ALGORITHM_VERSION,
    seed: SEED,
  });
  const reviewQuotaById = new Map(reviewAllocation.quotas.map((quota) => [quota.id, quota]));
  for (const row of pendingByLanguage) {
    const candidate = reviewQuotaById.get(row.policyLanguageId).allocatedCandidates[
      row.languageSlot - 1
    ];
    if (!candidate) continue;
    row.candidateId = candidate.candidateId;
    row.candidateLanguage = candidate.language;
    row.candidateLane = candidate.lane;
    row.proposedSettlementName = candidate.name;
    row.proposedDisplayName = `${candidate.name} (${row.designation})`;
    row.candidateReview = candidate.editorialStatus;
    row.assignmentStatus = 'provisional-pairing-pending-content-and-source-review';
  }
  const reviewProposals = pendingByLanguage.filter((row) => row.candidateId);
  const quotaRows = scopeQuotas.map((quota) => {
    const provisionalCount = reviewQuotaById.get(quota.id).filledCount;
    return {
      languageId: quota.id,
      language: quota.language,
      weight: quota.weight,
      scopeQuota: quota.quota,
      filledWithApprovedUnusedContent: 0,
      provisionalProposalCount: provisionalCount,
      unfilledForLanguage: quota.quota - provisionalCount,
      noCrossLanguageRedistribution: true,
    };
  });
  const sourceRows = registry
    .map((system) => {
      const evidence = getSourceEvidence(system);
      return {
        id: system.id,
        displayName: system.displayName,
        catalogName: system.catalogName || null,
        source: system.source,
        evidence: evidence ? { snapshot: evidence.snapshot, sha256: evidence.digest } : null,
        protected: isProtected(system, manifest),
      };
    })
    .sort((left, right) => compareText(left.id, right.id));
  const report = {
    reportVersion: REPORT_VERSION,
    algorithmVersion: ALGORITHM_VERSION,
    seed: SEED,
    status: 'full-catalog-offline-review-no-new-activation',
    runtimeEnabled: manifest.runtimeEnabled === true,
    published: false,
    liveDatabaseWrites: 0,
    writesPerformedOutsideNewReportArtifacts: false,
    sourcePatternNominationsAreEligibilityApproval: false,
    registryCount: registry.length,
    existingActiveAssignmentCount: existingAssignmentRows.length,
    existingAssignmentsUnchanged: true,
    supportedCatalogPatternNominationCount: allNominations.length,
    remainingCatalogPatternNominationCount: pendingByLanguage.length,
    protectedSystemCount: protectedSystemIds.length,
    nonNominatedSystemCount: nonNominatedSystemIds.length,
    newEligibilityApprovals: 0,
    explicitlyEligibleUnassignedSystemCount: eligibleUnassignedIds.length,
    approvedUnusedContentCount: availableApprovedContent.length,
    additionalActivationCount: additionalActivations.length,
    contractChanges: 0,
    catalogRefreshes: 0,
    bodyOrStarOrPlanetChanges: 0,
    allocation: {
      method: 'hamilton-largest-remainder-per-full-catalog-scope',
      policyVersion: policy.policyVersion,
      scopeCount: pendingByLanguage.length,
      weightTotal: 100,
      tieBreak: 'higher integer remainder first; exact ties use policy order',
      noCrossLanguageRedistribution: true,
      cumulativeFairnessPromised: false,
      quotas: quotaRows,
      filledProposalCount: reviewAllocation.filledCount,
      unfilledScopeCount: reviewAllocation.unfilledCount,
    },
    inputs: {
      manifestVersion: manifest.manifestVersion,
      manifestSha256: digestJson(manifest),
      existingAssignmentsSha256: digestJson(existingAssignmentRows),
      registrySha256: digestJson(sourceRows),
      policySha256: digestJson(policy),
      candidateBankSha256: digestJson(bank),
      landmarkSupplementSha256: digestJson(supplement),
      provisionalReviewCandidatesSha256: digestJson(reviewCandidates),
      historicalPreviewSha256: digestJson(historicalPreview),
    },
    existingAssignments: existingAssignmentRows,
    pendingNominations: pendingByLanguage,
    reviewProposals,
    protectedSystemIds,
    nonNominatedSystemIds,
    contentReviewInventory,
    additionalActivations,
    reviewCaveats: [
      'All 25 existing approved assignments and eligibility decisions are preserved byte-for-byte; this report proposes no change to them.',
      'A catalog-style pattern and source snapshot only nominate a record for review. Every remaining nomination has no explicit approved eligibility decision.',
      'No eligible, unassigned system and unused approved candidate-content pair exists in the checked-in manifest and banks. Therefore no additional activation is permitted by the stated gate.',
      'Available unused candidates receive provisional review-only pairings within each language quota. No approved unused content is available for activation. Remaining shortages stay in their language; there is no cross-language reassignment.',
      'Original English names and provisional multilingual sketches are review-only. Eighteen additional English-draft Earth-landmark phrases were added for human review; none are approved for assignment. The five previously approved Earth-landmark items are already in the unchanged active 25 and cannot be reused.',
      'The historical 100-system preview is only identified as prior review material; its old system-to-candidate pairings are not imported into this full-catalog plan.',
      'Eighteen new provisional candidate phrases were added to the isolated review-only bank. No content approvals, eligibility decisions, assignments, runtime state, OpenAPI/API contract, catalog, system/body IDs, star/planet data, or physical seeds were changed.',
      'The content approvals already recorded in the repository do not constitute independent linguistic/cultural certification or legal clearance.',
    ],
  };
  return report;
}

function renderMarkdown(report) {
  const quotaRows = report.allocation.quotas.map(
    (quota) =>
      `| ${quota.language} | ${quota.weight}% | ${quota.scopeQuota} | ${quota.filledWithApprovedUnusedContent} | ${quota.provisionalProposalCount} | ${quota.unfilledForLanguage} |`
  );
  const candidateRows = report.contentReviewInventory.map(
    (candidate) =>
      `| ${candidate.name.replace(/\|/gu, '\\|')} | ${candidate.language} | ${candidate.lane} | ${candidate.reviewStatus} | ${candidate.activeSystemId ? `\`${candidate.activeSystemId}\`` : '—'} |`
  );
  return [
    '# Full-catalog system-naming review',
    '',
    `Status: **${report.status}**. This offline inventory covers all ${report.registryCount} checked-in registry systems and all ${report.remainingCatalogPatternNominationCount} remaining unprotected catalog-pattern nominations. It does not publish names or infer eligibility from a catalog pattern.`,
    '',
    '## Scope and activation gate',
    '',
    `- Existing active assignments preserved: **${report.existingActiveAssignmentCount}/${report.existingActiveAssignmentCount}**; SHA-256 \`${report.inputs.existingAssignmentsSha256}\`. No changes were made to the 25 existing assignments.`,
    `- Catalog-style nominations (including those 25): ${report.supportedCatalogPatternNominationCount}; remaining nominations for human review: ${report.remainingCatalogPatternNominationCount}.`,
    `- Protected systems excluded: ${report.protectedSystemCount}; systems without a current nomination: ${report.nonNominatedSystemCount}. All ${report.registryCount} registry records are accounted for exactly once.`,
    `- Newly approved eligibility decisions: ${report.newEligibilityApprovals}; explicitly eligible but unassigned systems: ${report.explicitlyEligibleUnassignedSystemCount}; approved unused content: ${report.approvedUnusedContentCount}.`,
    `- Additional activations: **${report.additionalActivationCount}**. No eligible-unassigned system plus approved-unused-content pair exists. The existing 25 remain the only assigned systems.`,
    '',
    '## Full-catalog language quotas',
    '',
    `Policy: \`${report.allocation.policyVersion}\`; Hamilton largest-remainder allocation over the ${report.allocation.scopeCount} remaining nominations. These are review quotas, not eligibility approvals or name assignments.`,
    '',
    '| Language | Weight | Scope quota | Approved unused content | Provisional pairings | Unfilled in this language |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
    ...quotaRows,
    '',
    `There are ${report.allocation.filledProposalCount} provisional review-only pairings and ${report.allocation.unfilledScopeCount} slots without candidates. No approved unused content is available for activation. Shortages are not redistributed across languages. No cumulative fairness ledger is maintained.`,
    '',
    '## Provisional pairings for review',
    '',
    '| Canonical system ID | Proposed label | Language bucket | Status |',
    '| --- | --- | --- | --- |',
    ...report.reviewProposals.map(
      (row) =>
        `| \`${row.systemId}\` | ${row.proposedDisplayName} | ${row.policyLanguage} | Content and source eligibility pending; not activated |`
    ),
    '',
    '## Candidate content inventory (review only)',
    '',
    'The table is the checked-in review-bank inventory, including 18 new English-draft Earth-landmark phrases labeled unapproved. Provisional pairings above are suggestions, not approved assignments. Original English names and provisional multilingual sketches remain unapproved; the five earlier Earth-landmark references are already assigned within the frozen 25 and are not reused. Historical preview pairings are not carried forward.',
    '',
    '| Candidate name | Language tag | Lane | Current review/assignment state | Existing system, if active |',
    '| --- | --- | --- | --- | --- |',
    ...candidateRows,
    '',
    '## Safeguards and provenance',
    '',
    ...report.reviewCaveats.map((caveat) => `- ${caveat}`),
    `- Input hashes: registry \`${report.inputs.registrySha256}\`; manifest \`${report.inputs.manifestSha256}\`; policy \`${report.inputs.policySha256}\`; review bank \`${report.inputs.candidateBankSha256}\`; landmark supplement \`${report.inputs.landmarkSupplementSha256}\`; new provisional review sketches \`${report.inputs.provisionalReviewCandidatesSha256}\`; historical 100-preview \`${report.inputs.historicalPreviewSha256}\`.`,
    '- The JSON artifact contains every remaining nomination with exact system ID, original designation, matched pattern, source snapshot and evidence hash, plus separate exhaustive protected and non-nominated ID lists.',
    '',
    '## Follow-up needed',
    '',
    '1. Humans must review source/proper-name evidence and explicitly approve eligibility decisions for any additional system before it can enter the activation gate.',
    '2. Provide new, reviewed, unused candidate content for each language whose quota is to be filled. Existing provisional names must not be treated as approved merely because they appear in a bank or a prior proposal.',
    '3. Only after both gates are recorded can a later versioned assignment change be prepared; do not alter the current 25 in that process.',
    '',
  ].join('\n');
}

function writeArtifacts(report = buildFullCatalogReport()) {
  fs.writeFileSync(JSON_OUTPUT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(MARKDOWN_OUTPUT, renderMarkdown(report), 'utf8');
  return {
    jsonPath: path.relative(ROOT, JSON_OUTPUT),
    markdownPath: path.relative(ROOT, MARKDOWN_OUTPUT),
    registryCount: report.registryCount,
    remainingNominations: report.remainingCatalogPatternNominationCount,
    additionalActivations: report.additionalActivationCount,
  };
}

if (require.main === module) {
  try {
    const result = writeArtifacts();
    console.log(
      `Full-catalog review written: ${result.jsonPath} and ${result.markdownPath} (${result.remainingNominations} pending nominations; ${result.additionalActivations} additional activations)`
    );
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}

module.exports = {
  ALGORITHM_VERSION,
  JSON_OUTPUT,
  MARKDOWN_OUTPUT,
  buildFullCatalogReport,
  getCatalogNominations,
  getContentReviewInventory,
  renderMarkdown,
  writeArtifacts,
};
