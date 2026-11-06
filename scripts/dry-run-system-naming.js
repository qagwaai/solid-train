'use strict';

const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { getSolarSystemRegistry } = require('../src/model/solar-system-registry');
const {
  getSystemNamingManifest,
  comparisonKeys,
  getSourceEvidence,
  isProtected,
  validateNamingManifest,
} = require('../src/model/system-naming');
const {
  addReservedLabels,
  selectCandidate,
  uniqueAliases,
} = require('../src/model/system-naming-proposal');

const ROOT = path.join(__dirname, '..');
const CANDIDATES = require('../data/system-naming-candidates.json');
const OUTPUT = path.join(ROOT, 'data', 'system-naming-dry-run-proposal.json');
const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function validateCandidateBank() {
  const candidateIds = new Set();
  const candidateNameKeys = new Map();
  const allCandidates = [
    ...CANDIDATES.fictionalOriginalNames.map((candidate) => ({
      ...candidate,
      lane: 'original-fictional',
    })),
    ...CANDIDATES.authorHonoringProposals.map((candidate) => ({
      ...candidate,
      lane: 'author-honoring',
    })),
  ];
  for (const candidate of allCandidates) {
    if (!candidate.candidateId || candidateIds.has(candidate.candidateId)) {
      throw new Error(`Missing or duplicate naming candidate id: ${candidate.candidateId}`);
    }
    candidateIds.add(candidate.candidateId);
    if (
      typeof candidate.name !== 'string' ||
      !candidate.name.trim() ||
      candidate.name !== candidate.name.normalize('NFC') ||
      /[\p{Cc}\u200b-\u200f\u202a-\u202e\u2060-\u206f]/u.test(candidate.name)
    ) {
      throw new Error(`Invalid or non-NFC candidate name: ${candidate.candidateId}`);
    }
    for (const key of comparisonKeys(candidate.name)) {
      if (candidateNameKeys.has(key)) {
        throw new Error(
          `Candidate name collision: ${candidateNameKeys.get(key)} and ${candidate.candidateId}`
        );
      }
      candidateNameKeys.set(key, candidate.candidateId);
    }
  }
  return allCandidates;
}

function buildReport({ manifest = getSystemNamingManifest() } = {}) {
  const registry = getSolarSystemRegistry({ namingManifest: manifest });
  validateNamingManifest(registry, manifest);
  const allCandidates = validateCandidateBank();

  for (const [id, decision] of Object.entries(manifest.eligibility || {})) {
    if (decision.decision !== 'eligible') continue;
    const evidence = getSourceEvidence(registry.find((entry) => entry.id === id) || { id });
    if (
      !evidence ||
      evidence.digest !== decision.sourceEvidenceSha256 ||
      evidence.snapshot !== decision.sourceSnapshot
    ) {
      throw new Error(`Reviewed source evidence is missing or stale for ${id}`);
    }
  }

  const eligibleIds = Object.keys(manifest.eligibility || {}).sort();
  const reservedNames = new Set();
  for (const system of registry) addReservedLabels(reservedNames, system);
  for (const assignment of Object.values(manifest.approvedAssignments || {})) {
    for (const key of comparisonKeys(assignment.settlementName)) reservedNames.add(key);
  }
  const proposals = [];
  const exhaustedIds = [];
  for (const id of eligibleIds) {
    const system = registry.find((entry) => entry.id === id);
    const review = manifest.eligibility[id];
    if (!system || review.decision !== 'eligible' || isProtected(system, manifest)) {
      throw new Error(`Eligible proposal ${id} failed its protection/source gate`);
    }
    if (manifest.approvedAssignments?.[id] || manifest.overrides?.[id]) continue;
    const selected = selectCandidate(CANDIDATES.fictionalOriginalNames, reservedNames, {
      algorithmVersion: manifest.algorithmVersion,
      seed: manifest.seed,
      systemId: id,
    });
    if (!selected) {
      exhaustedIds.push(id);
      continue;
    }
    const { candidate } = selected;
    for (const key of comparisonKeys(candidate.name)) reservedNames.add(key);
    proposals.push({
      systemId: id,
      source: system.source,
      originalDesignation: system.catalogName || system.displayName,
      currentDisplayName: system.displayName,
      candidateId: candidate.candidateId,
      proposedSettlementName: candidate.name,
      proposedDisplayName: `${candidate.name} (${system.catalogName || system.displayName})`,
      candidateLane: 'original-fictional',
      styles: candidate.style,
      collisionRetries: selected.rejectedCandidateIds.length,
      aliasesIfApproved: uniqueAliases([system.catalogName, system.displayName]),
      eligibilityReview: review.reviewStatus,
      candidateReview: candidate.editorialStatus,
      rightsReview: candidate.rightsStatus,
      allAgesReview: candidate.allAgesStatus,
      assignmentStatus: 'pending-human-approval',
      runtimeEnabled: false,
    });
  }

  const sourceRows = registry
    .map(({ id, displayName, catalogName, source, primaryStar }) => ({
      id,
      displayName,
      catalogName: catalogName || null,
      source,
      properName: primaryStar?.properName || null,
    }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const protectedCount = sourceRows.filter((row) =>
    isProtected(
      registry.find((entry) => entry.id === row.id),
      manifest
    )
  ).length;
  const explicitlyEligible = new Set(eligibleIds);
  const reviewCount = registry.length - protectedCount - explicitlyEligible.size;

  const report = {
    reportVersion: 1,
    status: 'proposal-only-human-review-required',
    runtimeEnabled: false,
    writesPerformed: false,
    scope: 'full checked-in system registry; no row limit',
    registryCount: registry.length,
    eligibilityCounts: {
      explicitlyEligible: explicitlyEligible.size,
      protected: protectedCount,
      needsReview: reviewCount,
    },
    sourceCounts: sourceRows.reduce((counts, row) => {
      counts[row.source] = (counts[row.source] || 0) + 1;
      return counts;
    }, {}),
    candidateCounts: {
      originalFictional: CANDIDATES.fictionalOriginalNames.length,
      authorHonoring: CANDIDATES.authorHonoringProposals.length,
      culturallySourced: 0,
      proposalsByStyle: allCandidates.reduce((counts, candidate) => {
        for (const style of candidate.style || []) counts[style] = (counts[style] || 0) + 1;
        return counts;
      }, {}),
    },
    collisionRetries: proposals.reduce((count, proposal) => count + proposal.collisionRetries, 0),
    inputs: {
      manifestVersion: manifest.manifestVersion,
      algorithmVersion: manifest.algorithmVersion,
      seed: manifest.seed,
      policyVersion: manifest.policyVersion,
      candidateBankVersion: CANDIDATES.candidateBankVersion,
      registrySha256: hash(sourceRows),
      eligibilitySha256: hash(manifest.eligibility),
      candidateBankSha256: hash(CANDIDATES),
    },
    proposals,
    exhaustedIds,
    approvedAssignmentCount: Object.keys(manifest.approvedAssignments || {}).length,
    changedExistingAssignments: 0,
    protectedOrUnreviewedLabelsChanged: 0,
    nonNameFieldsChanged: 0,
    identitiesChanged: 0,
    physicalSeedOrBodyChanges: 0,
  };
  return report;
}

async function writeReport() {
  const report = buildReport();
  fs.writeFileSync(OUTPUT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(
    `Dry-run proposal written: ${path.relative(ROOT, OUTPUT)} (${report.registryCount} systems, ${report.proposals.length} pending proposal, ${report.approvedAssignmentCount} approved)`
  );
}

if (require.main === module) {
  writeReport().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { buildReport };
