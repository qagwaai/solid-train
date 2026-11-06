'use strict';

const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { getHygSystems } = require('../src/model/hyg-star-catalog');
const {
  getExoplanetSystems,
  getExoplanetSystemProperNames,
} = require('../src/model/exoplanet-catalog');
const { getSolarSystemRegistry } = require('../src/model/solar-system-registry');
const {
  getSystemNamingManifest,
  comparisonKeys,
  getSourceEvidence,
  isProtected,
} = require('../src/model/system-naming');
const { addReservedLabels } = require('../src/model/system-naming-proposal');

const ROOT = path.join(__dirname, '..');
const BANK_PATH = path.join(ROOT, 'data', 'system-naming-review-bank-v1.json');
const JSON_OUTPUT = path.join(ROOT, 'data', 'system-naming-100-review-preview.json');
const MARKDOWN_OUTPUT = path.join(ROOT, 'docs', 'system-naming-100-review-preview-2026-11-05.md');
const ALGORITHM_VERSION = 'system-naming-100-preview-v1';
const SEED = 'stellar-naming-review-preview-2026-11-05-v1';
const FIXED_PROPOSAL = {
  systemId: 'exo-gj-9066',
  candidateName: 'Copper Vale',
  candidateId: 'original-english-01',
};
const CATALOG_DESIGNATION_PATTERNS = [
  ['GJ', /^GJ\s*\d/iu],
  ['HD', /^HD\s*\d/iu],
  ['HIP', /^HIP\s*\d/iu],
  ['HYG', /^HYG\s*\d/iu],
  ['Kepler', /^Kepler[-\s]*\d/iu],
  ['TOI', /^TOI[-\s]*\d/iu],
  ['TIC', /^TIC[-\s]*\d/iu],
  ['K2', /^K2[-\s]*\d/iu],
  ['WASP', /^WASP[-\s]*\d/iu],
  ['XO', /^XO[-\s]*\d/iu],
  ['CoRoT', /^CoRoT[-\s]*\d/iu],
  ['Other-numbered-catalog', /^[A-Z][A-Z0-9-]{1,14}\s+\d/iu],
];

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const digestJson = (value) => sha256(JSON.stringify(value));
const hashRank = (parts) => sha256(JSON.stringify(parts));
const compareText = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

function candidateId(prefix, index) {
  return `${prefix}-${String(index + 1).padStart(2, '0')}`;
}

function getCandidates(bank) {
  const candidates = [
    ...bank.originalEnglishNames.map((name, index) => ({
      candidateId: candidateId('original-english', index),
      name,
      language: 'English',
      script: 'Latin',
      transliteration: null,
      gloss: null,
      lane: 'original-fictional',
      editorialStatus: 'proposal-unreviewed',
      allAgesStatus: 'human-review-pending',
      rightsStatus: 'originality-review-pending',
      linguisticStatus: 'not-applicable',
      approved: false,
    })),
    ...bank.multilingualProposals.map((candidate, index) => ({
      candidateId: candidateId(`multilingual-${candidate.language.toLowerCase()}`, index),
      name: candidate.name,
      language: candidate.language,
      script: candidate.script,
      transliteration: candidate.transliteration,
      gloss: candidate.provisionalGloss,
      lane: 'multilingual-provisional',
      editorialStatus: 'provisional-unreviewed',
      allAgesStatus: 'knowledgeable-speaker-cultural-and-all-ages-review-pending',
      rightsStatus: 'originality-and-context-review-pending',
      linguisticStatus: candidate.linguisticStatus,
      approved: false,
    })),
    ...bank.authorHonoringProposals.map((candidate, index) => ({
      candidateId: candidateId('author-tribute', index),
      name: candidate.name,
      language: candidate.language,
      script: 'Latin',
      transliteration: null,
      gloss: null,
      honors: candidate.honors,
      lane: 'author-honoring',
      editorialStatus: candidate.editorialStatus,
      allAgesStatus: candidate.allAgesStatus,
      rightsStatus: candidate.rightsStatus,
      linguisticStatus: 'english-only-review',
      approved: candidate.approved,
    })),
  ];
  const ids = new Set();
  const keys = new Map();
  for (const candidate of candidates) {
    if (
      !candidate.name ||
      candidate.name !== candidate.name.normalize('NFC') ||
      /[\p{Cc}\u200b-\u200f\u202a-\u202e\u2060-\u206f]/u.test(candidate.name)
    ) {
      throw new Error(`Invalid or non-NFC preview candidate: ${candidate.name}`);
    }
    if (ids.has(candidate.candidateId))
      throw new Error(`Duplicate candidate id: ${candidate.candidateId}`);
    ids.add(candidate.candidateId);
    for (const key of comparisonKeys(candidate.name)) {
      if (keys.has(key)) {
        throw new Error(`Candidate name collision: ${keys.get(key)} and ${candidate.candidateId}`);
      }
      keys.set(key, candidate.candidateId);
    }
  }
  return candidates;
}

function getPattern(designation) {
  return CATALOG_DESIGNATION_PATTERNS.find(([, pattern]) => pattern.test(designation))?.[0] || null;
}

function getSourceRows(registry) {
  return registry
    .map((system) => {
      const evidence = getSourceEvidence(system);
      return {
        id: system.id,
        displayName: system.displayName,
        catalogName: system.catalogName || null,
        source: system.source,
        evidence: evidence ? { snapshot: evidence.snapshot, sha256: evidence.digest } : null,
        protected: isProtected(system),
      };
    })
    .sort((left, right) => compareText(left.id, right.id));
}

function buildReservedKeys(registry, manifest) {
  const reserved = new Set();
  for (const system of registry) addReservedLabels(reserved, system);
  for (const properName of getExoplanetSystems().flatMap((system) =>
    getExoplanetSystemProperNames(system.id)
  )) {
    for (const key of comparisonKeys(properName)) reserved.add(key);
  }
  for (const hygSystem of getHygSystems()) {
    for (const star of hygSystem.stars || []) {
      for (const key of comparisonKeys(star.properName)) reserved.add(key);
    }
  }
  for (const [id, assignment] of Object.entries(manifest.approvedAssignments || {})) {
    for (const key of comparisonKeys(assignment.settlementName)) reserved.add(key);
    for (const key of comparisonKeys(manifest.aliases?.[id] || [])) reserved.add(key);
  }
  for (const override of Object.values(manifest.overrides || {})) {
    for (const key of comparisonKeys(override.settlementName)) reserved.add(key);
  }
  for (const aliases of Object.values(manifest.aliases || {})) {
    for (const key of comparisonKeys(aliases)) reserved.add(key);
  }
  return reserved;
}

function getEligibleSuggestions(
  registry,
  registryDigest,
  {
    count = 100,
    algorithmVersion = ALGORITHM_VERSION,
    seed = SEED,
    rankIndependentOfRegistry = false,
    manifest = getSystemNamingManifest(),
  } = {}
) {
  const nominations = registry
    .filter((system) => system.source === 'exoplanet-catalog')
    .map((system) => {
      const designation = system.catalogName || system.displayName;
      return {
        system,
        designation,
        pattern: getPattern(designation),
        evidence: getSourceEvidence(system),
      };
    })
    .filter(
      ({ system, pattern, evidence }) => pattern && evidence && !isProtected(system, manifest)
    )
    .map((entry) => ({
      ...entry,
      rank: hashRank(
        rankIndependentOfRegistry
          ? [algorithmVersion, seed, entry.system.id]
          : [algorithmVersion, seed, registryDigest, entry.system.id, entry.evidence.digest]
      ),
    }));
  const fixed = nominations.find(({ system }) => system.id === FIXED_PROPOSAL.systemId);
  if (!fixed)
    throw new Error('The existing GJ9066 proposal no longer passes the preview-only source gates.');
  const selected = nominations
    .filter(({ system }) => system.id !== FIXED_PROPOSAL.systemId)
    .sort(
      (left, right) =>
        compareText(left.rank, right.rank) || compareText(left.system.id, right.system.id)
    )
    .slice(0, count - 1);
  if (selected.length !== count - 1) {
    throw new Error(
      `Expected ${count - 1} additional catalog-style suggestions; found ${selected.length}.`
    );
  }
  return [fixed, ...selected];
}

function getNearSimilarityFlags(candidates) {
  const fold = (value) =>
    value
      .normalize('NFC')
      .toLocaleLowerCase('en-US')
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/[\p{P}\p{S}\s]/gu, '');
  const distanceAtMostOne = (left, right) => {
    if (Math.abs(left.length - right.length) > 1) return false;
    let leftIndex = 0;
    let rightIndex = 0;
    let edits = 0;
    while (leftIndex < left.length && rightIndex < right.length) {
      if (left[leftIndex] === right[rightIndex]) {
        leftIndex += 1;
        rightIndex += 1;
      } else {
        edits += 1;
        if (edits > 1) return false;
        if (left.length > right.length) leftIndex += 1;
        else if (right.length > left.length) rightIndex += 1;
        else {
          leftIndex += 1;
          rightIndex += 1;
        }
      }
    }
    if (leftIndex < left.length || rightIndex < right.length) edits += 1;
    return edits <= 1;
  };
  const flags = [];
  for (let left = 0; left < candidates.length; left += 1) {
    const leftKey = fold(candidates[left].name);
    if (leftKey.length < 5) continue;
    for (let right = left + 1; right < candidates.length; right += 1) {
      const rightKey = fold(candidates[right].name);
      if (rightKey.length >= 5 && distanceAtMostOne(leftKey, rightKey)) {
        flags.push({
          candidateIds: [candidates[left].candidateId, candidates[right].candidateId],
          names: [candidates[left].name, candidates[right].name],
          reason: 'single-edit lexical similarity; human review required',
        });
      }
    }
  }
  return flags;
}

function buildPreview({
  registry = getSolarSystemRegistry(),
  manifest = getSystemNamingManifest(),
  bank = require(BANK_PATH),
} = {}) {
  const sourceRows = getSourceRows(registry);
  const registryDigest = digestJson(sourceRows);
  const candidates = getCandidates(bank);
  const bankDigest = digestJson(bank);
  const candidatesById = new Map(candidates.map((candidate) => [candidate.candidateId, candidate]));
  const fixedCandidate = candidatesById.get(FIXED_PROPOSAL.candidateId);
  if (!fixedCandidate || fixedCandidate.name !== FIXED_PROPOSAL.candidateName) {
    throw new Error('The fixed Copper Vale / GJ 9066 proposal was changed or removed.');
  }

  const reserved = buildReservedKeys(registry, manifest);
  const systemSuggestions = getEligibleSuggestions(registry, registryDigest);
  const selectedCandidates = [fixedCandidate];
  const additionalCandidates = candidates
    .filter((candidate) => candidate.candidateId !== fixedCandidate.candidateId)
    .sort((left, right) =>
      compareText(
        hashRank([ALGORITHM_VERSION, SEED, bankDigest, left.candidateId]),
        hashRank([ALGORITHM_VERSION, SEED, bankDigest, right.candidateId])
      )
    );
  selectedCandidates.push(...additionalCandidates);
  if (systemSuggestions.length !== 100 || selectedCandidates.length !== 100) {
    throw new Error(
      `Preview composition must be exactly 100; got ${systemSuggestions.length} systems and ${selectedCandidates.length} names.`
    );
  }
  const usedKeys = new Set(reserved);
  for (const candidate of selectedCandidates) {
    const keys = comparisonKeys(candidate.name);
    if (keys.some((key) => usedKeys.has(key))) {
      throw new Error(
        `Preview name collides with a catalog/protected/approved label: ${candidate.name}`
      );
    }
    for (const key of keys) usedKeys.add(key);
  }

  const rows = systemSuggestions.map((suggestion, index) => {
    const candidate = index === 0 ? fixedCandidate : selectedCandidates[index];
    return {
      row: index + 1,
      systemId: suggestion.system.id,
      source: suggestion.system.source,
      originalDesignation: suggestion.designation,
      currentDisplayName: suggestion.system.displayName,
      proposedSettlementName: candidate.name,
      proposedDisplayName: `${candidate.name} (${suggestion.designation})`,
      candidateId: candidate.candidateId,
      language: candidate.language,
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
      assignmentStatus: 'pending-human-review-not-approved',
      proposedEligibility: {
        decision: 'not-decided',
        status: 'catalog-style-suggestion-only',
        nominationReason:
          'A source catalog-style pattern was recognized; regex nomination is not eligibility approval.',
        matchedDesignationPattern: suggestion.pattern,
        reviewStatus: 'pending-human-source-and-proper-name-review',
        sourceSnapshot: suggestion.evidence.snapshot,
        sourceEvidenceSha256: suggestion.evidence.digest,
      },
      runtimeEnabled: false,
    };
  });

  const inputDigests = {
    registrySha256: registryDigest,
    manifestSha256: digestJson(manifest),
    candidateBankSha256: bankDigest,
    sourceEvidenceSha256: digestJson(sourceRows.map(({ id, evidence }) => ({ id, evidence }))),
  };
  const countsByLanguage = {};
  const countsByLane = {};
  const countsByScript = {};
  for (const row of rows) {
    countsByLanguage[row.language] = (countsByLanguage[row.language] || 0) + 1;
    countsByLane[row.namingLane] = (countsByLane[row.namingLane] || 0) + 1;
    countsByScript[row.script] = (countsByScript[row.script] || 0) + 1;
  }
  const proposal = {
    previewVersion: 1,
    algorithmVersion: ALGORITHM_VERSION,
    seed: SEED,
    status: 'offline-review-preview-only',
    runtimeEnabled: false,
    published: false,
    writesPerformedOutsidePreviewArtifacts: false,
    assignmentApprovalCount: 0,
    eligibilityApprovalsCreated: 0,
    contractChanges: 0,
    bodyOrStarOrPlanetChanges: 0,
    registryCount: registry.length,
    previewCount: rows.length,
    selection: {
      count: 100,
      catalogStylePatternIsNominativeOnly: true,
      fixedExistingProposal: {
        systemId: FIXED_PROPOSAL.systemId,
        candidateId: FIXED_PROPOSAL.candidateId,
        name: FIXED_PROPOSAL.candidateName,
        priorDryRunArtifactPreserved: 'data/system-naming-dry-run-proposal.json',
      },
      ordering:
        'fixed GJ9066 row first; remaining source records ordered by SHA-256 rank and stable ID tie-break',
    },
    candidatePortfolio: {
      bankVersion: bank.bankVersion,
      countsByLanguage,
      countsByLane,
      countsByScript,
      allNamesUsedExactlyOnce: true,
      nearSimilarityFlags: getNearSimilarityFlags(candidates),
      fuzzyTransliterationHomophoneAndCulturalChecks: 'not automated; human review required',
      reviewerSignoffsRecorded: 0,
    },
    inputs: {
      manifestVersion: manifest.manifestVersion,
      manifestAlgorithmVersion: manifest.algorithmVersion,
      manifestSeed: manifest.seed,
      registryCount: registry.length,
      ...inputDigests,
    },
    reviewCaveats: [
      'Every row is a proposal-only nomination, not an eligibility decision; explicit per-row source evidence is provided for human review.',
      'No systems were added to or marked eligible in the approved manifest.',
      'No source proper-name labels are included; systems flagged by current protection/source-name checks are excluded.',
      'Multilingual glosses and transliterations are unverified sketches, not authoritative translations or cultural approvals.',
      'Chinese and Russian entries are explicitly provisional lexical sketches; no historical expedition or alternate-history claim is made.',
      'Language and naming-lane counts are editor-selected sample composition, not geopolitical weights, forecasts, or launch statistics.',
      'The seven author-honoring candidates retain their prior English editorial/all-ages approvals and explicitly unresolved, not-legally-cleared rights status; no assignment is approved.',
      'Fictional off-world influences are style metadata only and assert no habitation, sovereignty, population, or historical fact.',
    ],
    rows,
  };
  return proposal;
}

function renderMarkdown(preview) {
  const summary = [
    `| ${preview.candidatePortfolio.countsByLanguage.English} | English | ${preview.candidatePortfolio.countsByLane['original-fictional']} original + ${preview.candidatePortfolio.countsByLane['author-honoring']} author-honoring |`,
    ...Object.entries(preview.candidatePortfolio.countsByLanguage)
      .filter(([language]) => language !== 'English')
      .sort(([left], [right]) => compareText(left, right))
      .map(([language, count]) => `| ${count} | ${language} | multilingual provisional |`),
  ];
  const tableRows = preview.rows.map((row) => {
    const details =
      row.namingLane === 'multilingual-provisional'
        ? `${row.language}; ${row.script}${row.transliteration ? `; ${row.transliteration}` : ''}; gloss: ${row.provisionalGloss}; unverified`
        : row.namingLane === 'author-honoring'
          ? `${row.language}; honors ${row.honors}; owner accepted rights risk, not legally cleared`
          : `${row.language}; original-fictional, editorial review pending`;
    return `| ${row.row} | \`${row.systemId}\` | ${row.originalDesignation.replace(/\|/gu, '\\|')} | ${row.proposedDisplayName.replace(/\|/gu, '\\|')} | ${row.namingLane} | ${details.replace(/\|/gu, '\\|')} |`;
  });
  return [
    '# 100-system naming review preview',
    '',
    `Generated offline from the checked-in catalog on 2026-11-05. Status: **${preview.status}**. This report is a review artifact only: no runtime assignment, publication, manifest eligibility change, API contract change, catalog refresh, or celestial-body mutation occurred.`,
    '',
    '## Composition (illustrative, not a population or launch forecast)',
    '',
    'The language and lane mix is an editor-selected sample to enable review; it is not a geopolitical weighting or ranking.',
    '',
    '| Count | Language | Lane / note |',
    '| ---: | --- | --- |',
    ...summary,
    '',
    'Lane totals: ' +
      Object.entries(preview.candidatePortfolio.countsByLane)
        .map(([lane, count]) => `${lane} ${count}`)
        .join('; ') +
      '.',
    '',
    '## Review safeguards and provenance',
    '',
    '- All 100 canonical IDs are distinct, existing catalog-style records. The exact original designation is retained on every row.',
    '- Catalog-pattern recognition only nominates records. It does **not** make them eligible. Each row says `decision: not-decided`, gives a source snapshot and SHA-256 evidence digest, and awaits human source/proper-name review.',
    '- Source proper-name/protected systems are excluded using the current source-evidence helpers. No source proper/component name is used as a proposal.',
    '- The fixed first row preserves the separate existing `exo-gj-9066` / `Copper Vale` proposal and does not rewrite `data/system-naming-dry-run-proposal.json`.',
    '- The seven author-honoring names appear once each. Their approved English editorial/all-ages status is not legal clearance; the owner-accepted rights risk remains explicitly unresolved. They remain unassigned.',
    '- All non-English material is provisional and unverified. Glosses/transliterations need knowledgeable-speaker, cultural, pronunciation, ambiguity and all-ages review. Chinese/Russian entries are lexical sketches only; historical influence references are not factual claims.',
    '- Candidate-name collision checks reserve current display/catalog/proper/alias labels, source component proper names, manifest aliases/assignments/overrides, and other preview names. Similarity flags are in JSON; fuzzy/transliteration/homophone and cultural review remains human.',
    '- No changes to system IDs, stars, planets, bodies, seeds, positions, population/habitability claims, API/OpenAPI, or runtime assignment state.',
    '',
    `Input SHA-256: registry \`${preview.inputs.registrySha256}\`; manifest \`${preview.inputs.manifestSha256}\`; preview bank \`${preview.inputs.candidateBankSha256}\`; source evidence \`${preview.inputs.sourceEvidenceSha256}\`.`,
    '',
    '## Numbered proposals',
    '',
    '| # | Canonical system ID | Exact original designation | Proposed display name | Lane | Language / provenance and review status |',
    '| ---: | --- | --- | --- | --- | --- |',
    ...tableRows,
    '',
    '## Human review still required',
    '',
    '1. Confirm or reject each of the 100 proposed eligibility nominations against source records and any applicable naming protections; the preview intentionally leaves the approved manifest unchanged.',
    '2. Have knowledgeable speakers review each provisional linguistic item, transliteration, meaning, pronunciation, cultural context, similarity, and all-ages suitability.',
    '3. Reconfirm editorial and rights/trademark context for the seven author-honoring names; existing owner acceptance is not legal clearance.',
    '4. Explicitly approve only after review, then separately prepare a versioned assignment/contract/runtime change with backend tests and drift checks.',
    '',
  ].join('\n');
}

function writeArtifacts(preview = buildPreview()) {
  fs.writeFileSync(JSON_OUTPUT, `${JSON.stringify(preview, null, 2)}\n`, 'utf8');
  fs.writeFileSync(MARKDOWN_OUTPUT, renderMarkdown(preview), 'utf8');
  return {
    jsonPath: path.relative(ROOT, JSON_OUTPUT),
    markdownPath: path.relative(ROOT, MARKDOWN_OUTPUT),
    count: preview.rows.length,
  };
}

if (require.main === module) {
  try {
    const result = writeArtifacts();
    console.log(
      `Offline review preview written: ${result.jsonPath} and ${result.markdownPath} (${result.count} pending rows; no runtime assignments)`
    );
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}

module.exports = {
  ALGORITHM_VERSION,
  FIXED_PROPOSAL,
  SEED,
  buildReservedKeys,
  buildPreview,
  compareText,
  getCandidates,
  getEligibleSuggestions,
  getPattern,
  getSourceRows,
  hashRank,
  renderMarkdown,
  writeArtifacts,
};
