'use strict';

const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { getSolarSystemRegistry } = require('../src/model/solar-system-registry');
const {
  getSystemNamingManifest,
  comparisonKeys,
  isProtected,
} = require('../src/model/system-naming');
const {
  FIXED_PROPOSAL,
  buildReservedKeys,
  getCandidates,
  getEligibleSuggestions,
  getSourceRows,
} = require('./dry-run-system-naming-100-review');
const {
  allocateWeightedCandidates,
  getHamiltonQuotas,
  validateBatchSize,
} = require('../src/model/system-naming-weighted-allocation');

const ROOT = path.join(__dirname, '..');
const POLICY_PATH = path.join(ROOT, 'data', 'system-naming-weight-policy-v2.json');
const BANK_PATH = path.join(ROOT, 'data', 'system-naming-review-bank-v1.json');
const SUPPLEMENT_PATH = path.join(
  ROOT,
  'data',
  'system-naming-weighted-landmark-supplement-v1.json'
);
const BATCH_PLAN_PATH = path.join(ROOT, 'data', 'system-naming-weighted-batch-plan-v2.json');
const PRIOR_PROPOSAL_PATH = path.join(ROOT, 'data', 'system-naming-dry-run-proposal.json');
const JSON_OUTPUT = path.join(ROOT, 'data', 'system-naming-weighted-batch-v1.json');
const MARKDOWN_OUTPUT = path.join(ROOT, 'docs', 'system-naming-weighted-allocation-2026-11-05.md');
const ALGORITHM_VERSION = 'system-naming-weighted-batch-v2';
const SEED = 'stellar-weighted-review-batch-2026-11-05-v1';
const DEFAULT_COUNT = 25;
const SYSTEM_SELECTION_ALGORITHM_VERSION = 'system-naming-weighted-batch-v1';
const BATCH_PLAN_VERSION = 2;

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const digestJson = (value) => sha256(JSON.stringify(value));

function buildWeightedCandidateBank(baseBank, supplement) {
  if (
    supplement?.supplementVersion !== 1 ||
    supplement?.status !== 'weighted-review-content-supplement' ||
    supplement.runtimeConsumed !== false ||
    supplement.approval?.editorialStatus !== 'user-approved' ||
    supplement.approval?.approvalScope !==
      'weighted-proposal-and-candidate-content-selection-only' ||
    supplement.approval?.approvalDate !== '2026-11-05' ||
    supplement.approval?.independentLinguisticOrCulturalVerification !== 'not-performed' ||
    supplement.approval?.earthReferenceContextReview !== 'pending' ||
    supplement.approval?.allAgesReview !== 'pending' ||
    supplement.approval?.legalClearance !== 'not-asserted' ||
    supplement.approval?.assignmentOrPublicationAuthorization !== 'not-granted'
  ) {
    throw new Error('The landmark supplement approval scope or review status is invalid.');
  }
  if (!Array.isArray(supplement.candidates) || supplement.candidates.length !== 5) {
    throw new TypeError('The weighted candidate supplement must contain candidates.');
  }
  const supplementalIds = new Set();
  for (const candidate of supplement.candidates) {
    if (
      !candidate ||
      typeof candidate.candidateId !== 'string' ||
      !candidate.candidateId ||
      typeof candidate.name !== 'string' ||
      !candidate.name.trim() ||
      typeof candidate.language !== 'string' ||
      !candidate.language ||
      typeof candidate.lane !== 'string' ||
      !candidate.lane ||
      typeof candidate.editorialStatus !== 'string' ||
      typeof candidate.allAgesStatus !== 'string' ||
      typeof candidate.rightsStatus !== 'string' ||
      typeof candidate.linguisticStatus !== 'string' ||
      typeof candidate.earthReference !== 'string' ||
      candidate.approved !== true ||
      candidate.lane !== 'earth-remembrance' ||
      candidate.name !== candidate.name.normalize('NFC') ||
      /[\p{Cc}\u200b-\u200f\u202a-\u202e\u2060-\u206f]/u.test(candidate.name)
    ) {
      throw new TypeError(
        'Each supplemental candidate needs a stable ID, name, language and lane.'
      );
    }
    if (supplementalIds.has(candidate.candidateId)) {
      throw new Error(`Duplicate supplemental candidate id: ${candidate.candidateId}`);
    }
    supplementalIds.add(candidate.candidateId);
  }
  const combined = {
    bankVersion: 2,
    status: 'weighted-review-only',
    runtimeConsumed: false,
    originalEnglishNames: baseBank.originalEnglishNames,
    multilingualProposals: [...baseBank.multilingualProposals, ...supplement.candidates],
    authorHonoringProposals: baseBank.authorHonoringProposals,
    sourceFiles: [
      { file: 'data/system-naming-review-bank-v1.json', version: baseBank.bankVersion },
      {
        file: 'data/system-naming-weighted-landmark-supplement-v1.json',
        version: supplement.supplementVersion,
      },
    ],
  };
  const candidates = getCandidates(baseBank).map((candidate) => ({
    ...candidate,
    sourceBankFile: 'data/system-naming-review-bank-v1.json',
    sourceBankVersion: baseBank.bankVersion,
  }));
  const supplementalCandidates = supplement.candidates.map((candidate) => ({
    candidateId: candidate.candidateId,
    name: candidate.name,
    language: candidate.language,
    script: candidate.script,
    transliteration: candidate.transliteration || null,
    gloss: candidate.provisionalGloss || null,
    earthReference: candidate.earthReference,
    lane: candidate.lane,
    editorialStatus: candidate.editorialStatus,
    allAgesStatus: candidate.allAgesStatus,
    rightsStatus: candidate.rightsStatus,
    linguisticStatus: candidate.linguisticStatus,
    approved: candidate.approved === true,
    approvalScope: supplement.approval?.approvalScope,
    approvalProvenance: {
      status: supplement.approval?.editorialStatus,
      date: supplement.approval?.approvalDate,
      source: supplement.approval?.approvalSource,
      referenceContext: supplement.approval?.referenceContext,
      independentLinguisticOrCulturalVerification:
        supplement.approval?.independentLinguisticOrCulturalVerification,
      earthReferenceContextReview: supplement.approval?.earthReferenceContextReview,
      allAgesReview: supplement.approval?.allAgesReview,
      legalClearance: supplement.approval?.legalClearance,
      assignmentOrPublicationAuthorization:
        supplement.approval?.assignmentOrPublicationAuthorization,
    },
    sourceBankFile: 'data/system-naming-weighted-landmark-supplement-v1.json',
    sourceBankVersion: supplement.supplementVersion,
  }));
  const allCandidates = [...candidates, ...supplementalCandidates];
  const ids = new Set();
  for (const candidate of allCandidates) {
    if (ids.has(candidate.candidateId)) {
      throw new Error(`Candidate ID collides across weighted banks: ${candidate.candidateId}`);
    }
    ids.add(candidate.candidateId);
  }
  return { bank: combined, candidates: allCandidates };
}

function getBatchSystems(registry, manifest, count, sourceRows, batchPlan, policy) {
  if (
    !batchPlan ||
    batchPlan.planVersion !== BATCH_PLAN_VERSION ||
    batchPlan.status !== 'frozen-offline-review-continuity-plan'
  ) {
    throw new Error(`Weighted batch plan must be version ${BATCH_PLAN_VERSION} and review-only.`);
  }
  if (count !== batchPlan.batchSize || !Array.isArray(batchPlan.slots)) {
    throw new Error(
      `Weighted batch plan requires exactly ${batchPlan.batchSize} selected systems.`
    );
  }
  const registryDigest = digestJson(sourceRows);
  const suggestions = getEligibleSuggestions(registry, registryDigest, {
    count,
    algorithmVersion: batchPlan.systemSelection?.algorithmVersion,
    seed: SEED,
    rankIndependentOfRegistry: true,
    manifest,
  });
  if (count !== batchPlan.batchSize || suggestions.length !== count) {
    throw new Error(
      `Weighted batch plan requires exactly ${batchPlan.batchSize} selected systems.`
    );
  }
  if (batchPlan.policyVersion !== policy.policyVersion) {
    throw new Error(
      `Weighted batch plan policy mismatch: expected ${batchPlan.policyVersion}, found ${policy.policyVersion}.`
    );
  }
  if (
    batchPlan.systemSelection?.algorithmVersion !== SYSTEM_SELECTION_ALGORITHM_VERSION ||
    batchPlan.systemSelection?.seed !== SEED
  ) {
    throw new Error('Weighted batch plan system-selection version or seed is stale.');
  }
  if (!Array.isArray(batchPlan.slots) || batchPlan.slots.length !== count) {
    throw new Error(`Weighted batch plan must contain exactly ${count} slots.`);
  }

  const registryById = new Map(registry.map((system) => [system.id, system]));
  const suggestionById = new Map(
    suggestions.map((suggestion) => [suggestion.system.id, suggestion])
  );
  const quotas = getHamiltonQuotas(count, policy);
  const languageSlotById = new Map(quotas.map((quota) => [quota.id, 0]));
  const usedSystems = new Set();
  const usedCandidates = new Set();
  for (let index = 0; index < batchPlan.slots.length; index += 1) {
    const planned = batchPlan.slots[index];
    if (!planned || planned.slot !== index + 1) {
      throw new Error(`Invalid weighted batch plan slot index at position ${index + 1}.`);
    }
    const system = registryById.get(planned.systemId);
    if (!system)
      throw new Error(`Weighted batch plan has a stale system reference: ${planned.systemId}`);
    if (isProtected(system, manifest)) {
      throw new Error(
        `Protected system cannot be included in the weighted review plan: ${system.id}`
      );
    }
    const suggestion = suggestionById.get(planned.systemId);
    if (!suggestion) {
      throw new Error(
        `Weighted batch plan system is not a current eligible nomination: ${planned.systemId}`
      );
    }
    if (usedSystems.has(planned.systemId)) {
      throw new Error(`Weighted batch plan repeats system ID: ${planned.systemId}`);
    }
    usedSystems.add(planned.systemId);
    const policyLanguage = quotas.find((quota) => quota.id === planned.policyLanguageId);
    if (!policyLanguage) {
      throw new Error(
        `Weighted batch plan has an unknown policy language: ${planned.policyLanguageId}`
      );
    }
    const expectedLanguageSlot = (languageSlotById.get(policyLanguage.id) || 0) + 1;
    languageSlotById.set(policyLanguage.id, expectedLanguageSlot);
    if (
      planned.languageSlot !== expectedLanguageSlot ||
      expectedLanguageSlot > policyLanguage.quota
    ) {
      throw new Error(
        `Weighted batch plan language slot does not match policy at slot ${planned.slot}.`
      );
    }
    if (
      suggestion.designation !== planned.originalDesignation ||
      suggestion.evidence.digest !== planned.sourceEvidenceSha256
    ) {
      throw new Error(`Weighted batch plan has stale source evidence for ${planned.systemId}.`);
    }
    if ((planned.candidateId === null) !== (planned.candidateName === null)) {
      throw new Error(
        `Weighted batch plan candidate reference is incomplete at slot ${planned.slot}.`
      );
    }
    if (planned.candidateId !== null) {
      if (usedCandidates.has(planned.candidateId)) {
        throw new Error(`Weighted batch plan repeats candidate ID: ${planned.candidateId}`);
      }
      usedCandidates.add(planned.candidateId);
    }
  }
  const plannedSystemIds = batchPlan.slots.map((slot) => slot.systemId);
  const rankedSystemIds = suggestions.map((suggestion) => suggestion.system.id);
  if (JSON.stringify(plannedSystemIds) !== JSON.stringify(rankedSystemIds)) {
    throw new Error('Weighted batch plan no longer matches the frozen selected system ordering.');
  }
  for (const quota of quotas) {
    if ((languageSlotById.get(quota.id) || 0) !== quota.quota) {
      throw new Error(`Weighted batch plan does not fill the policy quota for ${quota.id}.`);
    }
  }
  return { suggestions, registryDigest, quotas };
}

function buildWeightedPreview({
  count = DEFAULT_COUNT,
  registry = getSolarSystemRegistry(),
  manifest = getSystemNamingManifest(),
  policy = require(POLICY_PATH),
  bank = require(BANK_PATH),
  supplement = require(SUPPLEMENT_PATH),
  batchPlan = require(BATCH_PLAN_PATH),
  previousProposal = JSON.parse(fs.readFileSync(PRIOR_PROPOSAL_PATH, 'utf8')),
} = {}) {
  validateBatchSize(count);
  const sourceRows = getSourceRows(registry);
  const registryDigest = digestJson(sourceRows);
  const sourceEvidenceDigest = digestJson(sourceRows.map(({ id, evidence }) => ({ id, evidence })));
  const { bank: weightedBank, candidates } = buildWeightedCandidateBank(bank, supplement);
  const candidateById = new Map(candidates.map((candidate) => [candidate.candidateId, candidate]));
  const reservedKeys = buildReservedKeys(registry, manifest);
  for (const proposal of previousProposal.proposals || []) {
    const isPreservedFixedProposal =
      proposal.systemId === FIXED_PROPOSAL.systemId &&
      proposal.candidateId === 'original-copper-vale' &&
      proposal.proposedSettlementName === FIXED_PROPOSAL.candidateName;
    if (isPreservedFixedProposal) continue;
    for (const value of [proposal.proposedSettlementName, ...(proposal.aliasesIfApproved || [])]) {
      for (const key of comparisonKeys(value)) reservedKeys.add(key);
    }
  }

  const systemSelection = getBatchSystems(registry, manifest, count, sourceRows, batchPlan, policy);
  const pinnedCandidates = [];
  for (const slot of batchPlan.slots) {
    if (slot.candidateId === null) continue;
    const candidate = candidateById.get(slot.candidateId);
    if (!candidate || candidate.name !== slot.candidateName) {
      throw new Error(`Weighted batch plan has a stale candidate reference: ${slot.candidateId}`);
    }
    pinnedCandidates.push({
      languageId: slot.policyLanguageId,
      languageSlot: slot.languageSlot,
      candidateId: candidate.candidateId,
    });
  }
  const allocation = allocateWeightedCandidates({
    count,
    policy,
    candidates,
    reservedKeys,
    algorithmVersion: ALGORITHM_VERSION,
    seed: SEED,
    pinnedCandidates,
    preferredCandidateLanes: ['author-honoring'],
  });

  const rows = [];
  const slots = [];
  let systemIndex = 0;
  let slotNumber = 0;
  for (const languageAllocation of allocation.quotas) {
    for (let languageSlot = 0; languageSlot < languageAllocation.quota; languageSlot += 1) {
      const suggestion = systemSelection.suggestions[systemIndex];
      const plannedSlot = batchPlan.slots[systemIndex];
      systemIndex += 1;
      slotNumber += 1;
      if (!suggestion) throw new Error('Weighted slot has no deterministic system nomination.');
      if (plannedSlot?.slot !== slotNumber || plannedSlot.systemId !== suggestion.system.id) {
        throw new Error(`Frozen weighted batch slot ${slotNumber} changed during assembly.`);
      }
      const candidate = languageAllocation.allocatedCandidates[languageSlot] || null;
      const eligibility = manifest.eligibility?.[suggestion.system.id] || null;
      const sourceEvidenceSha256 = suggestion.evidence.digest;
      const slot = {
        slot: slotNumber,
        languageSlot: languageSlot + 1,
        policyLanguageId: languageAllocation.id,
        policyLanguage: languageAllocation.language,
        policyWeight: languageAllocation.weight,
        policyQuota: languageAllocation.quota,
        systemId: suggestion.system.id,
        source: suggestion.system.source,
        originalDesignation: suggestion.system.catalogName || suggestion.system.displayName,
        currentDisplayName: suggestion.system.displayName,
        matchedDesignationPattern: suggestion.pattern,
        sourceSnapshot: suggestion.evidence.snapshot,
        sourceEvidenceSha256,
        status: candidate ? 'filled-review-proposal' : 'unfilled-candidate-shortage',
        runtimeEnabled: false,
      };

      if (candidate) {
        const row = {
          ...slot,
          proposedSettlementName: candidate.name,
          proposedDisplayName: `${candidate.name} (${slot.originalDesignation})`,
          candidateId: candidate.candidateId,
          candidateLanguageTag: candidate.language,
          script: candidate.script,
          transliteration: candidate.transliteration,
          provisionalGloss: candidate.gloss,
          namingLane: candidate.lane,
          honors: candidate.honors || null,
          candidateEditorialStatus: candidate.editorialStatus,
          candidateAllAgesStatus: candidate.allAgesStatus,
          rightsStatus: candidate.rightsStatus,
          linguisticStatus: candidate.linguisticStatus,
          candidateContentApproved: candidate.approved,
          candidateReviewProvenance: {
            bankFile: candidate.sourceBankFile,
            bankVersion: candidate.sourceBankVersion,
            bankStatus:
              candidate.sourceBankFile === 'data/system-naming-review-bank-v1.json'
                ? bank.status
                : supplement.status,
            languageTagSource: 'explicit candidate language field',
            reviewerSignoffsRecorded: 0,
            approvalScope: candidate.approvalScope || null,
            approvalProvenance: candidate.approvalProvenance || null,
            earthReference: candidate.earthReference || null,
          },
          candidateApprovalScope: candidate.approvalScope || null,
          independentLinguisticOrCulturalVerification:
            candidate.approvalProvenance?.independentLinguisticOrCulturalVerification ||
            (candidate.lane === 'earth-remembrance' ? 'not-performed' : null),
          earthReferenceContextReview:
            candidate.approvalProvenance?.earthReferenceContextReview ||
            (candidate.lane === 'earth-remembrance' ? 'pending' : null),
          allAgesReviewStatus:
            candidate.approvalProvenance?.allAgesReview ||
            (candidate.lane === 'earth-remembrance' ? 'pending' : candidate.allAgesStatus),
          legalClearanceStatus: candidate.approvalProvenance?.legalClearance || null,
          proposedEligibility: {
            decision: 'not-decided',
            status: 'catalog-style-suggestion-only',
            nominationReason:
              'A source catalog-style pattern was recognized; pattern matching is not eligibility approval.',
            matchedDesignationPattern: suggestion.pattern,
            reviewStatus: 'pending-human-source-and-proper-name-review',
            sourceSnapshot: suggestion.evidence.snapshot,
            sourceEvidenceSha256,
          },
          priorManifestEligibility: eligibility
            ? {
                decision: eligibility.decision,
                reviewStatus: eligibility.reviewStatus || null,
                reviewer: eligibility.reviewer || null,
                sourceSnapshot: eligibility.sourceSnapshot || null,
                sourceEvidenceSha256: eligibility.sourceEvidenceSha256 || null,
              }
            : null,
          assignmentStatus: 'pending-human-review-not-approved',
          runtimeEnabled: false,
        };
        rows.push(row);
        slots.push({ ...slot, candidateId: candidate.candidateId });
      } else {
        slots.push({
          ...slot,
          candidateId: null,
          unfilledReason:
            'No eligible, non-colliding candidate is available in this language bucket.',
          rejectedCandidateIds: languageAllocation.rejectedCandidateIds,
        });
      }
    }
  }

  const inputDigests = {
    registrySha256: registryDigest,
    manifestSha256: digestJson(manifest),
    candidateBankSha256: digestJson(weightedBank),
    baseCandidateBankSha256: digestJson(bank),
    candidateSupplementSha256: digestJson(supplement),
    batchPlanSha256: digestJson(batchPlan),
    policySha256: digestJson(policy),
    sourceEvidenceSha256: sourceEvidenceDigest,
    priorProposalSha256: digestJson(previousProposal),
  };
  const countsByCandidateLanguage = {};
  const countsByPolicyLanguage = {};
  const countsByLane = {};
  for (const row of rows) {
    countsByCandidateLanguage[row.candidateLanguageTag] =
      (countsByCandidateLanguage[row.candidateLanguageTag] || 0) + 1;
    countsByPolicyLanguage[row.policyLanguage] =
      (countsByPolicyLanguage[row.policyLanguage] || 0) + 1;
    countsByLane[row.namingLane] = (countsByLane[row.namingLane] || 0) + 1;
  }
  const fixedCandidate = candidateById.get(FIXED_PROPOSAL.candidateId);
  if (!fixedCandidate || fixedCandidate.name !== FIXED_PROPOSAL.candidateName) {
    throw new Error('The required fixed Copper Vale / GJ 9066 proposal is stale or missing.');
  }

  return {
    reportVersion: 2,
    algorithmVersion: ALGORITHM_VERSION,
    seed: SEED,
    status: 'offline-weighted-review-proposals-only',
    runtimeEnabled: false,
    published: false,
    writesPerformedOutsideNewReviewArtifacts: false,
    requestedBatchSize: count,
    filledProposalCount: rows.length,
    unfilledSlotCount: allocation.unfilledCount,
    registryCount: registry.length,
    selectedSystemCount: systemSelection.suggestions.length,
    assignmentApprovalCount: Object.keys(manifest.approvedAssignments || {}).length,
    eligibilityApprovalsCreated: 0,
    contractChanges: 0,
    bodyOrStarOrPlanetChanges: 0,
    selection: {
      ordering:
        'The versioned review plan freezes all 25 selected system IDs and slot indices. Twenty existing candidate-to-system pairings are pinned by stable candidate ID; only five previously unfilled slots are candidate-ranked.',
      fixedReviewPlan: {
        file: 'data/system-naming-weighted-batch-plan-v2.json',
        version: batchPlan.planVersion,
        digestSha256: inputDigests.batchPlanSha256,
        allSystemSlotsFrozen: true,
        existingFilledPairingsPinned: batchPlan.slots.filter((slot) => slot.candidateId !== null)
          .length,
      },
      fixedExistingProposal: {
        systemId: FIXED_PROPOSAL.systemId,
        candidateId: fixedCandidate.candidateId,
        name: fixedCandidate.name,
        priorDryRunArtifactPreserved: 'data/system-naming-dry-run-proposal.json',
      },
      noCrossLanguageRedistribution: true,
      cumulativeFairnessPromised: false,
      repeatedBatchWarning:
        'Hamilton rounding is applied independently per batch. A low-weight language can receive zero slots repeatedly for identical small batch sizes; no cumulative fairness ledger is maintained.',
    },
    allocation: {
      method: allocation.allocationMethod,
      tieBreak: allocation.fractionalRemainderTieBreak,
      weightTotal: allocation.weightTotal,
      policyVersion: policy.policyVersion,
      quotas: allocation.quotas.map((item) => ({
        languageId: item.id,
        language: item.language,
        weight: item.weight,
        quota: item.quota,
        remainderNumerator: item.remainderNumerator,
        remainderDenominator: item.remainderDenominator,
        receivesRemainderSlot: item.receivesRemainderSlot,
        filled: item.filledCount,
        unfilled: item.unfilledCount,
        rejectedCandidateIds: item.rejectedCandidateIds,
      })),
      countsByPolicyLanguage,
      countsByCandidateLanguage,
      countsByLane,
    },
    candidateBank: {
      version: weightedBank.bankVersion,
      status: weightedBank.status,
      files: weightedBank.sourceFiles,
      supplementApproval: supplement.approval,
      provisionalCandidatesAllowedForReviewOnly: true,
    },
    inputs: {
      manifestVersion: manifest.manifestVersion,
      manifestAlgorithmVersion: manifest.algorithmVersion,
      manifestSeed: manifest.seed,
      policyVersion: policy.policyVersion,
      candidateBankVersion: weightedBank.bankVersion,
      candidateSupplementVersion: supplement.supplementVersion,
      batchPlanVersion: batchPlan.planVersion,
      ...inputDigests,
    },
    reviewCaveats: [
      'Every filled row is a review-only proposal, not an assignment, publication approval or runtime name.',
      'All selected system rows are catalog-style nominations; each decision remains not-decided and awaits human source/proper-name review.',
      'The fixed review plan preserves all 25 selected system IDs and slot indices plus all 20 previously filled candidate-to-system pairings; only the five previously unfilled slots are newly filled.',
      'The five Earth-remembrance entries have user-approved editorial candidate content dated 2026-11-05; independent linguistic, cultural, context and all-ages verification remains pending. No legal clearance or assignment/publication authorization is asserted.',
      'Other provisional multilingual names remain unverified sketches. A candidate language tag is retained as recorded; it does not certify translation, naturalness, cultural suitability or all-ages safety.',
      'The user-approved English author wording retains its recorded rights-risk status; that approval is not legal clearance.',
      'No assignments, eligibility approvals, manifest changes, contract changes, catalog changes, celestial data changes or runtime writes were made.',
    ],
    rows,
    unfilledSlots: slots.filter((slot) => slot.status === 'unfilled-candidate-shortage'),
    slots,
  };
}

function markdownCell(value) {
  return String(value ?? '')
    .replace(/\|/gu, '\\|')
    .replace(/\r?\n/gu, ' ');
}

function renderMarkdown(preview) {
  const quotaRows = preview.allocation.quotas.map(
    (quota) =>
      `| ${markdownCell(quota.language)} | ${quota.weight}% | ${quota.quota} | ${quota.filled} | ${quota.unfilled} | ${quota.remainderNumerator}/100 |`
  );
  const proposalRows = preview.rows.map(
    (row) =>
      `| ${row.slot} | \`${row.systemId}\` | ${markdownCell(row.originalDesignation)} | ${markdownCell(row.proposedDisplayName)} | ${markdownCell(row.policyLanguage)} (${markdownCell(row.candidateLanguageTag)}) | ${markdownCell(row.namingLane)}; ${markdownCell(row.candidateEditorialStatus)}; rights: ${markdownCell(row.rightsStatus)} |`
  );
  const unfilledRows = preview.unfilledSlots.map(
    (slot) =>
      `| ${slot.slot} | \`${slot.systemId}\` | ${markdownCell(slot.policyLanguage)} | ${markdownCell(slot.originalDesignation)} | ${markdownCell(slot.unfilledReason)} |`
  );
  return [
    '# Weighted system-naming batch review',
    '',
    `Status: **${preview.status}**. Requested ${preview.requestedBatchSize} slots; ${preview.filledProposalCount} have candidate proposals and ${preview.unfilledSlotCount} remain explicitly unfilled. The five added Earth-remembrance candidate contents are user-approved for this proposal/content-selection gate only; this offline report is not assignment, eligibility or publication approval.`,
    '',
    '## Weighted allocation',
    '',
    `Policy: \`${preview.inputs.policyVersion}\`; method: ${preview.allocation.method}; tie-break: ${preview.allocation.tieBreak}. Quotas use integer weight × batch-size division and integer remainders; exact ties follow policy language order.`,
    '',
    '| Policy language | Weight | Quota | Filled | Unfilled | Integer remainder / 100 |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
    ...quotaRows,
    '',
    'Hamilton rounding is applied independently per batch. No cumulative fairness ledger is used; low-weight languages may remain at zero in repeated identical small batches. Shortages are never redistributed across languages.',
    '',
    'The existing `exo-gj-9066` / Copper Vale proposal occupies one of eight English slots. The seven user-approved author-honoring English candidates are prioritized deterministically after that fixed item when available; their recorded rights risk is not legal clearance.',
    '',
    'A versioned frozen review plan fixes all 25 selected system IDs and slot indices, and pins every one of the prior 20 candidate-to-system pairings by stable ID. Candidate-bank growth therefore affects only the five previously unfilled Mandarin, Russian and French slots. The three new Mandarin candidates carry the explicit `Mandarin` tag; the earlier two candidates retain their recorded `Chinese` tags.',
    '',
    'User approval on 2026-11-05 covers editorial candidate-content selection and the Earth-remembrance lane only. The source record is `docs/naming-algorithm-2026-11-05.md`; Earth references are Mount Tai, Huangshan, Tian Shan, Lake Baikal and Mont Blanc. No independent native-speaker, linguistic, cultural, context, all-ages or legal clearance is claimed. Geographic references do not imply matching destination terrain, and no system assignment or publication was authorized.',
    '',
    '## Filled proposals',
    '',
    '| Slot | Canonical system ID | Exact original designation | Proposed combined display label | Policy / candidate language | Candidate review and rights status |',
    '| ---: | --- | --- | --- | --- | --- |',
    ...proposalRows,
    '',
    '## Explicitly unfilled slots',
    '',
    '| Slot | Canonical system ID | Policy language | Exact original designation | Reason |',
    '| ---: | --- | --- | --- | --- |',
    ...(unfilledRows.length ? unfilledRows : ['| — | — | — | — | No slots unfilled. |']),
    '',
    preview.unfilledSlotCount === 0
      ? 'No slots remain unfilled in this batch.'
      : 'Unfilled slots remain reserved for their stated language quota. They do not receive a fallback candidate from another language, and their catalog designation remains unchanged.',
    '',
    '## Provenance and safeguards',
    '',
    `- Registry: ${preview.registryCount} systems; ${preview.selectedSystemCount} catalog-style nominations selected by the versioned seed. Protected systems are excluded by existing protection/source helpers.`,
    '- Candidate names are checked against registry display/catalog/proper/alias names, source component proper names, manifest assignments/overrides/aliases, the existing single-pilot dry-run proposal, and names selected earlier in this batch. Locked prior proposals are checked for collisions by the allocator.',
    '- Each filled row records its exact combined label, stable candidate ID, explicit language tag, bank source/version, review lane/status, rights status, source-evidence SHA-256, catalog-pattern nomination and pending assignment status.',
    '- Five Earth-remembrance contents are user-approved editorial selections with approval date and Earth-reference provenance. Their linguistic/cultural/context and all-ages review remains pending; legal clearance, source eligibility approval and assignment authorization are not asserted.',
    '- No manifest, runtime state, OpenAPI/API contract, catalog, system/body IDs, star/planet data, physical seeds, prior single-pilot report, or 100-system review preview was changed.',
    '',
    `Input SHA-256: registry \`${preview.inputs.registrySha256}\`; manifest \`${preview.inputs.manifestSha256}\`; combined bank \`${preview.inputs.candidateBankSha256}\`; base bank \`${preview.inputs.baseCandidateBankSha256}\`; landmark supplement \`${preview.inputs.candidateSupplementSha256}\`; frozen batch plan \`${preview.inputs.batchPlanSha256}\`; policy \`${preview.inputs.policySha256}\`; source evidence \`${preview.inputs.sourceEvidenceSha256}\`; preserved prior proposal \`${preview.inputs.priorProposalSha256}\`.`,
    '',
    '## Human review required',
    '',
    '1. Review every catalog-style nomination and source/proper-name evidence before any eligibility decision.',
    '2. Have knowledgeable speakers review all five newly selected names for language, meaning, pronunciation, cultural/context appropriateness and all-ages suitability; this review is not recorded here.',
    '3. Reassess author-tribute rights/trademark context; recorded owner risk acceptance is not legal clearance.',
    '4. Do not publish or enable runtime assignments without a separately approved change and validation.',
    '',
  ].join('\n');
}

function writeArtifacts(preview = buildWeightedPreview()) {
  fs.writeFileSync(JSON_OUTPUT, `${JSON.stringify(preview, null, 2)}\n`, 'utf8');
  fs.writeFileSync(MARKDOWN_OUTPUT, renderMarkdown(preview), 'utf8');
  return {
    jsonPath: path.relative(ROOT, JSON_OUTPUT),
    markdownPath: path.relative(ROOT, MARKDOWN_OUTPUT),
    requested: preview.requestedBatchSize,
    filled: preview.filledProposalCount,
    unfilled: preview.unfilledSlotCount,
  };
}

function parseArguments(args) {
  let count = DEFAULT_COUNT;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--help' || argument === '-h') {
      return { help: true };
    }
    let value;
    if (argument === '--count') {
      value = args[index + 1];
      index += 1;
      if (value === undefined) throw new Error('--count requires a positive integer.');
    } else if (argument.startsWith('--count=')) {
      value = argument.slice('--count='.length);
    } else {
      throw new Error(`Unknown option: ${argument}`);
    }
    if (!/^[0-9]+$/u.test(value)) throw new Error('--count requires a positive integer.');
    count = Number(value);
  }
  validateBatchSize(count);
  return { count };
}

function printHelp() {
  console.log(
    [
      'Offline weighted system-naming review preview.',
      `Usage: node scripts/dry-run-system-naming-weighted.js [--count N]`,
      `Batch size: fixed at ${DEFAULT_COUNT} by the frozen v2 continuity plan.`,
      'Writes only the new weighted JSON and Markdown review artifacts.',
    ].join('\n')
  );
}

if (require.main === module) {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) {
      printHelp();
    } else {
      const result = writeArtifacts(buildWeightedPreview({ count: options.count }));
      console.log(
        `Offline weighted review written: ${result.jsonPath} and ${result.markdownPath} (${result.filled}/${result.requested} filled; ${result.unfilled} unfilled; runtime disabled)`
      );
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  ALGORITHM_VERSION,
  BATCH_PLAN_PATH,
  DEFAULT_COUNT,
  MARKDOWN_OUTPUT,
  JSON_OUTPUT,
  SEED,
  SUPPLEMENT_PATH,
  buildWeightedPreview,
  parseArguments,
  renderMarkdown,
  writeArtifacts,
};
