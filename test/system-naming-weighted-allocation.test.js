'use strict';

const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const test = require('node:test');
const {
  getSolarSystemRegistry: getRuntimeRegistry,
} = require('../src/model/solar-system-registry');
const {
  getSystemNamingManifest,
  comparisonKeys,
  isProtected,
} = require('../src/model/system-naming');
const {
  allocateWeightedCandidates,
  getHamiltonQuotas,
  validateBatchSize,
} = require('../src/model/system-naming-weighted-allocation');
const {
  DEFAULT_COUNT,
  BATCH_PLAN_PATH,
  JSON_OUTPUT,
  MARKDOWN_OUTPUT,
  SUPPLEMENT_PATH,
  buildWeightedPreview: buildPreviewFromInputs,
  parseArguments,
  renderMarkdown,
} = require('../scripts/dry-run-system-naming-weighted');

const POLICY = require('../data/system-naming-weight-policy-v2.json');
const REVIEW_BANK = require('../data/system-naming-review-bank-v1.json');
const AUTHOR_NAMES = require('../data/system-naming-candidates.json').authorHonoringProposals;
const BATCH_PLAN = require(BATCH_PLAN_PATH);
const LANDMARK_SUPPLEMENT = require(SUPPLEMENT_PATH);
const historicalManifest = require('./fixtures/system-naming-proposal-manifest-v1.json');
const getSolarSystemRegistry = () => getRuntimeRegistry({ namingManifest: historicalManifest });
const buildWeightedPreview = (options) =>
  buildPreviewFromInputs({ manifest: historicalManifest, ...options });

const PREVIOUS_PAIRS = [
  [1, 'exo-gj-9066', 'original-english-01', 'Copper Vale'],
  [2, 'exo-kepler-931', 'author-tribute-07', "Liu Cixin's Signal"],
  [3, 'exo-kepler-1723', 'author-tribute-02', "Le Guin's Horizon"],
  [4, 'exo-toi-406', 'author-tribute-06', 'Jemisin Accord'],
  [5, 'exo-hd-221416', 'author-tribute-01', "Asimov's Beacon"],
  [6, 'exo-wispit-1', 'author-tribute-03', "Butler's Reach"],
  [7, 'exo-hd-103197', 'author-tribute-05', "Bradbury's Hearth"],
  [8, 'exo-hd-133131', 'author-tribute-04', 'Clarke Meridian'],
  [9, 'exo-kepler-397', 'multilingual-chinese-21', '星港'],
  [10, 'exo-kepler-214', 'multilingual-chinese-22', '同行'],
  [14, 'exo-kepler-1633', 'multilingual-russian-24', 'Маяк'],
  [15, 'exo-kepler-1548', 'multilingual-russian-23', 'Заря'],
  [17, 'exo-hd-86065', 'multilingual-spanish-08', 'Encuentro'],
  [18, 'exo-hd-164595', 'multilingual-spanish-07', 'Alborada'],
  [19, 'exo-k2-221', 'multilingual-arabic-04', 'منارة'],
  [20, 'exo-kepler-1999', 'multilingual-hindi-17', 'आशा'],
  [21, 'exo-kepler-625', 'multilingual-portuguese-09', 'Travessia'],
  [22, 'exo-k2-133', 'multilingual-japanese-01', '木漏れ日'],
  [24, 'exo-k2-196', 'multilingual-swahili-06', 'Pamoja'],
  [25, 'exo-kic-9663113', 'multilingual-indonesian-15', 'Harapan'],
];

const FROZEN_SYSTEM_IDS = [
  'exo-gj-9066',
  'exo-kepler-931',
  'exo-kepler-1723',
  'exo-toi-406',
  'exo-hd-221416',
  'exo-wispit-1',
  'exo-hd-103197',
  'exo-hd-133131',
  'exo-kepler-397',
  'exo-kepler-214',
  'exo-toi-1846',
  'exo-hd-216770',
  'exo-kepler-1605',
  'exo-kepler-1633',
  'exo-kepler-1548',
  'exo-hd-238914',
  'exo-hd-86065',
  'exo-hd-164595',
  'exo-k2-221',
  'exo-kepler-1999',
  'exo-kepler-625',
  'exo-k2-133',
  'exo-hd-66428',
  'exo-k2-196',
  'exo-kic-9663113',
];

const PROTECTED_INPUT_HASHES = {
  'data/system-naming-dry-run-proposal.json':
    '87e8a6440fe4617d9040378ae9c3695982fc8246fae9486c7b284843c467b17d',
  'data/system-naming-100-review-preview.json':
    '41e29dc877b603cbdb7943e077cbfa661cdab7a9a1e5bf9bbb50581619586800',
  'docs/system-naming-100-review-preview-2026-11-05.md':
    '905d39c4cdaf6c08af8d188a0f5ccdd611678293807467e446add3d111c69ea8',
  'data/system-naming-candidates.json':
    '8c9d9aae5d5e7df897db30bd07c68f22a520f48909b0bc97016790100f0032e1',
  'data/system-naming-review-bank-v1.json':
    '7f143e305b30a35f757e731035465da10ae3d4e503a984b7442f1c4b5de03958',
  'data/system-naming-weight-policy-v1.json':
    '715e7901603299cffc88dbd74198dc5eb7364b47463272d2958d4cbce68d24a1',
};

const quotaSummary = (quotas) => quotas.map(({ language, quota }) => [language, quota]);

test('batch count and policy validation reject invalid inputs loudly', () => {
  for (const count of [0, -1, 1.5, 101, NaN]) {
    assert.throws(() => validateBatchSize(count), RangeError);
  }
  assert.throws(() => getHamiltonQuotas(25, { languages: [] }), /ordered languages/);
  assert.throws(
    () =>
      getHamiltonQuotas(25, {
        languages: [{ id: 'one', language: 'One', weight: 99, candidateLanguageLabels: [] }],
      }),
    /sum to 100/
  );
  assert.throws(
    () =>
      getHamiltonQuotas(25, {
        languages: [
          { id: 'same', language: 'One', weight: 50, candidateLanguageLabels: [] },
          { id: 'same', language: 'Two', weight: 50, candidateLanguageLabels: [] },
        ],
      }),
    /Duplicate policy language id/
  );
  assert.equal(parseArguments([]).count, DEFAULT_COUNT);
  assert.equal(parseArguments(['--count', '7']).count, 7);
  assert.equal(parseArguments(['--count=7']).count, 7);
  assert.equal(parseArguments(['--help']).help, true);
  assert.throws(() => parseArguments(['--count', '0']), /integer from 1 through 100/);
  assert.throws(() => parseArguments(['--count', '2.5']), /positive integer/);
  assert.throws(() => parseArguments(['--unknown']), /Unknown option/);
});

test('Hamilton quotas use integer arithmetic and policy order for exact fractional ties', () => {
  const tiePolicy = {
    languages: [
      { id: 'first', language: 'First', weight: 34, candidateLanguageLabels: [] },
      { id: 'second', language: 'Second', weight: 33, candidateLanguageLabels: [] },
      { id: 'third', language: 'Third', weight: 33, candidateLanguageLabels: [] },
    ],
  };
  assert.deepEqual(quotaSummary(getHamiltonQuotas(2, tiePolicy)), [
    ['First', 1],
    ['Second', 1],
    ['Third', 0],
  ]);
  assert.deepEqual(quotaSummary(getHamiltonQuotas(1, tiePolicy)), [
    ['First', 1],
    ['Second', 0],
    ['Third', 0],
  ]);

  const quotas = getHamiltonQuotas(25, POLICY);
  assert.deepEqual(quotaSummary(quotas), [
    ['English', 8],
    ['Mandarin', 5],
    ['Russian', 3],
    ['Spanish', 2],
    ['Arabic', 1],
    ['Hindi', 1],
    ['Portuguese', 1],
    ['Japanese', 1],
    ['French', 1],
    ['Swahili', 1],
    ['Indonesian', 1],
    ['Turkish', 0],
    ['Korean', 0],
    ['German', 0],
    ['Other reviewed traditions', 0],
  ]);
  assert.equal(
    quotas.reduce((sum, item) => sum + item.quota, 0),
    25
  );
  for (const quota of quotas) {
    const numerator = quota.weight * 25;
    assert.equal(quota.quota - Number(quota.receivesRemainderSlot), Math.floor(numerator / 100));
    assert.equal(quota.remainderNumerator, numerator % 100);
    assert.equal(quota.remainderDenominator, 100);
  }
});

test('candidate allocation is deterministic, collision-aware and does not redistribute shortages', () => {
  const policy = {
    languages: [
      { id: 'alpha', language: 'Alpha', weight: 50, candidateLanguageLabels: ['Alpha'] },
      { id: 'beta', language: 'Beta', weight: 50, candidateLanguageLabels: ['Beta'] },
    ],
  };
  const candidates = [
    { candidateId: 'alpha-reserved', name: 'Café', language: 'Alpha', lane: 'provisional' },
    {
      candidateId: 'alpha-available',
      name: 'Alpha Harbor',
      language: 'Alpha',
      lane: 'provisional',
    },
    { candidateId: 'beta-one', name: 'Beta Harbor', language: 'Beta', lane: 'provisional' },
  ];
  const options = {
    count: 4,
    policy,
    candidates,
    reservedKeys: new Set(comparisonKeys('Cafe')),
    algorithmVersion: 'test-v1',
    seed: 'fixed-seed',
  };
  const first = allocateWeightedCandidates(options);
  const second = allocateWeightedCandidates({ ...options, candidates: [...candidates].reverse() });
  assert.deepEqual(first, second);
  assert.equal(first.filledCount, 2);
  assert.equal(first.unfilledCount, 2);
  assert.deepEqual(
    first.quotas.map((item) => [item.language, item.quota, item.filledCount, item.unfilledCount]),
    [
      ['Alpha', 2, 1, 1],
      ['Beta', 2, 1, 1],
    ]
  );
  assert.ok(first.quotas[0].rejectedCandidateIds.includes('alpha-reserved'));
  assert.ok(
    first.quotas.every((item) =>
      item.allocatedCandidates.every(
        (candidate) => !candidate || item.candidateLanguageLabels.includes(candidate.language)
      )
    )
  );
  assert.throws(
    () =>
      allocateWeightedCandidates({
        ...options,
        pinnedCandidates: [{ languageId: 'alpha', candidateId: 'not-present' }],
      }),
    /unknown/
  );
});

test('approved author-lane priority and fixed Copper Vale preserve existing review states', () => {
  const bank = require('../scripts/dry-run-system-naming-100-review').getCandidates(REVIEW_BANK);
  const pinned = bank.find((candidate) => candidate.name === 'Copper Vale');
  const allocation = allocateWeightedCandidates({
    count: 25,
    policy: POLICY,
    candidates: bank,
    reservedKeys: new Set(),
    algorithmVersion: 'weighted-test-v1',
    seed: 'test',
    pinnedCandidates: [{ languageId: 'english', candidateId: pinned.candidateId }],
    preferredCandidateLanes: ['author-honoring'],
  });
  const english = allocation.quotas[0];
  assert.equal(english.quota, 8);
  assert.equal(english.allocatedCandidates[0].name, 'Copper Vale');
  assert.deepEqual(
    english.allocatedCandidates
      .slice(1)
      .map((candidate) => candidate.name)
      .sort(),
    AUTHOR_NAMES.map((candidate) => candidate.name).sort()
  );
  for (const author of english.allocatedCandidates.slice(1)) {
    assert.equal(author.editorialStatus, 'user-approved');
    assert.equal(author.rightsStatus, 'owner-authorized-risk-accepted-not-legally-cleared');
    assert.equal(author.approved, true);
  }
});

test('weighted review preview preserves all frozen pairings and fills the approved 25-slot batch', () => {
  const registry = getSolarSystemRegistry();
  const preview = buildWeightedPreview({ registry });
  const reordered = buildWeightedPreview({ registry: [...registry].reverse() });
  const stored = JSON.parse(fs.readFileSync(JSON_OUTPUT, 'utf8'));
  const markdown = fs.readFileSync(MARKDOWN_OUTPUT, 'utf8');

  assert.deepEqual(preview, reordered);
  assert.deepEqual(stored, preview);
  assert.equal(preview.requestedBatchSize, 25);
  assert.equal(preview.selectedSystemCount, 25);
  assert.equal(preview.reportVersion, 2);
  assert.equal(preview.filledProposalCount, 25);
  assert.equal(preview.unfilledSlotCount, 0);
  assert.equal(preview.slots.length, 25);
  assert.equal(preview.rows.length + preview.unfilledSlots.length, 25);
  assert.equal(preview.runtimeEnabled, false);
  assert.equal(preview.published, false);
  assert.equal(preview.assignmentApprovalCount, 0);
  assert.equal(preview.eligibilityApprovalsCreated, 0);
  assert.equal(preview.contractChanges, 0);
  assert.equal(preview.bodyOrStarOrPlanetChanges, 0);
  assert.equal(preview.selection.noCrossLanguageRedistribution, true);
  assert.equal(preview.selection.cumulativeFairnessPromised, false);
  assert.equal(preview.selection.fixedReviewPlan.allSystemSlotsFrozen, true);
  assert.equal(preview.selection.fixedReviewPlan.existingFilledPairingsPinned, 20);
  assert.equal(preview.candidateBank.version, 2);
  assert.equal(preview.candidateBank.files.length, 2);
  assert.equal(preview.inputs.candidateSupplementVersion, 1);
  assert.equal(preview.inputs.batchPlanVersion, 2);
  assert.match(preview.inputs.candidateSupplementSha256, /^[0-9a-f]{64}$/u);
  assert.match(preview.inputs.batchPlanSha256, /^[0-9a-f]{64}$/u);

  const counts = new Map(
    preview.allocation.quotas.map((item) => [
      item.language,
      { quota: item.quota, filled: item.filled, unfilled: item.unfilled },
    ])
  );
  assert.deepEqual(counts.get('English'), { quota: 8, filled: 8, unfilled: 0 });
  assert.deepEqual(counts.get('Mandarin'), { quota: 5, filled: 5, unfilled: 0 });
  assert.deepEqual(counts.get('Russian'), { quota: 3, filled: 3, unfilled: 0 });
  assert.deepEqual(counts.get('French'), { quota: 1, filled: 1, unfilled: 0 });
  assert.equal(counts.get('Spanish').filled, 2);
  assert.equal(counts.get('Arabic').filled, 1);
  assert.equal(counts.get('Hindi').filled, 1);
  assert.equal(counts.get('Portuguese').filled, 1);
  assert.equal(counts.get('Japanese').filled, 1);
  assert.equal(counts.get('Swahili').filled, 1);
  assert.equal(counts.get('Indonesian').filled, 1);

  const firstRow = preview.rows[0];
  assert.equal(firstRow.systemId, 'exo-gj-9066');
  assert.equal(firstRow.policyLanguage, 'English');
  assert.equal(firstRow.candidateId, 'original-english-01');
  assert.equal(firstRow.proposedSettlementName, 'Copper Vale');
  assert.equal(firstRow.proposedDisplayName, 'Copper Vale (GJ 9066)');
  assert.equal(firstRow.priorManifestEligibility.decision, 'eligible');
  assert.equal(firstRow.priorManifestEligibility.reviewStatus, 'reviewed-eligible-proposal-only');
  assert.equal(firstRow.proposedEligibility.decision, 'not-decided');
  assert.equal(firstRow.assignmentStatus, 'pending-human-review-not-approved');
  assert.equal(firstRow.runtimeEnabled, false);

  assert.deepEqual(
    preview.slots.map(({ slot, systemId }) => [slot, systemId]),
    FROZEN_SYSTEM_IDS.map((systemId, index) => [index + 1, systemId])
  );
  assert.deepEqual(
    preview.rows
      .filter((row) => BATCH_PLAN.slots.find((slot) => slot.slot === row.slot)?.candidateId)
      .map((row) => [row.slot, row.systemId, row.candidateId, row.proposedSettlementName]),
    PREVIOUS_PAIRS
  );
  assert.deepEqual(
    preview.rows
      .filter((row) => row.namingLane === 'earth-remembrance')
      .map((row) => [row.slot, row.systemId, row.proposedSettlementName, row.candidateId]),
    [
      [11, 'exo-toi-1846', '泰山', 'earth-mandarin-taishan'],
      [12, 'exo-hd-216770', '天山', 'earth-mandarin-tianshan'],
      [13, 'exo-kepler-1605', '黄山', 'earth-mandarin-huangshan'],
      [16, 'exo-hd-238914', 'Байкал', 'earth-russian-baykal'],
      [23, 'exo-hd-66428', 'Mont Blanc', 'earth-french-mont-blanc'],
    ]
  );

  for (const row of preview.rows) {
    assert.equal(
      row.proposedDisplayName,
      `${row.proposedSettlementName} (${row.originalDesignation})`
    );
    assert.match(row.sourceEvidenceSha256, /^[0-9a-f]{64}$/u);
    assert.match(row.proposedEligibility.sourceEvidenceSha256, /^[0-9a-f]{64}$/u);
    assert.ok(row.candidateLanguageTag);
    assert.equal(row.candidateReviewProvenance.reviewerSignoffsRecorded, 0);
    assert.equal(
      row.proposedEligibility.reviewStatus,
      'pending-human-source-and-proper-name-review'
    );
  }
  assert.deepEqual(preview.unfilledSlots, []);
  const earthRows = preview.rows.filter((row) => row.namingLane === 'earth-remembrance');
  for (const row of earthRows) {
    assert.equal(row.candidateLanguageTag, row.policyLanguage);
    assert.equal(row.candidateEditorialStatus, 'user-approved');
    assert.equal(row.candidateContentApproved, true);
    assert.equal(
      row.candidateApprovalScope,
      'weighted-proposal-and-candidate-content-selection-only'
    );
    assert.equal(row.candidateReviewProvenance.approvalProvenance.date, '2026-11-05');
    assert.equal(
      row.candidateReviewProvenance.approvalProvenance.source,
      'docs/naming-algorithm-2026-11-05.md'
    );
    assert.equal(row.independentLinguisticOrCulturalVerification, 'not-performed');
    assert.equal(row.earthReferenceContextReview, 'pending');
    assert.equal(row.allAgesReviewStatus, 'pending');
    assert.equal(row.legalClearanceStatus, 'not-asserted');
    assert.equal(row.assignmentStatus, 'pending-human-review-not-approved');
    assert.equal(row.proposedEligibility.decision, 'not-decided');
    assert.equal(row.runtimeEnabled, false);
    assert.equal(row.candidateReviewProvenance.reviewerSignoffsRecorded, 0);
    assert.equal(
      row.candidateReviewProvenance.bankFile,
      'data/system-naming-weighted-landmark-supplement-v1.json'
    );
  }
  assert.deepEqual(
    earthRows.map((row) => row.candidateReviewProvenance.earthReference),
    ['Mount Tai', 'Tian Shan', 'Huangshan', 'Lake Baikal', 'Mont Blanc']
  );
  assert.ok(
    preview.rows.some(
      (row) =>
        row.policyLanguage === 'Mandarin' &&
        row.candidateLanguageTag === 'Chinese' &&
        row.linguisticStatus === 'unverified-lexical-sketch'
    )
  );
  assert.ok(
    preview.rows
      .filter((row) => row.namingLane === 'author-honoring')
      .every(
        (row) =>
          row.rightsStatus === 'owner-authorized-risk-accepted-not-legally-cleared' &&
          row.candidateContentApproved === true
      )
  );
  assert.equal(preview.rows.length, new Set(preview.rows.map((row) => row.systemId)).size);
  assert.equal(preview.rows.length, new Set(preview.rows.map((row) => row.candidateId)).size);

  const rendered = renderMarkdown(preview);
  assert.match(
    rendered,
    /Requested 25 slots; 25 have candidate proposals and 0 remain explicitly unfilled/u
  );
  assert.match(rendered, /prior 20 candidate-to-system pairings/u);
  assert.match(rendered, /not assignment, eligibility or publication approval/u);
  assert.match(rendered, /Copper Vale \(GJ 9066\)/u);
  assert.match(rendered, /No cumulative fairness ledger/u);
  assert.match(
    markdown,
    /Requested 25 slots; 25 have candidate proposals and 0 remain explicitly unfilled/u
  );
  assert.match(markdown, /Copper Vale \(GJ 9066\)/u);
  for (const row of earthRows) assert.ok(rendered.includes(row.proposedDisplayName));

  assert.equal(getSystemNamingManifest().runtimeEnabled, true);
  assert.equal(Object.keys(getSystemNamingManifest().approvedAssignments).length, 119);
});

test('frozen review locks reject stale, invalid, colliding, protected and mismatched references', () => {
  const registry = getSolarSystemRegistry();
  const withPlan = (mutate) => {
    const batchPlan = structuredClone(BATCH_PLAN);
    mutate(batchPlan);
    return () => buildWeightedPreview({ registry, batchPlan });
  };

  assert.throws(
    withPlan((plan) => {
      plan.slots[0].slot = 2;
    }),
    /Invalid weighted batch plan slot index/u
  );
  assert.throws(
    withPlan((plan) => {
      plan.slots[1].candidateId = 'original-english-01';
      plan.slots[1].candidateName = 'Copper Vale';
    }),
    /repeats candidate ID/u
  );
  assert.throws(
    withPlan((plan) => {
      plan.slots[0].systemId = registry.find((system) =>
        isProtected(system, getSystemNamingManifest())
      ).id;
    }),
    /Protected system cannot be included/u
  );
  assert.throws(
    withPlan((plan) => {
      plan.slots[10].sourceEvidenceSha256 = '0'.repeat(64);
    }),
    /stale source evidence/u
  );
  assert.throws(
    withPlan((plan) => {
      plan.slots[0].systemId = 'missing-system-id';
    }),
    /stale system reference/u
  );
  assert.throws(
    withPlan((plan) => {
      plan.slots[0].candidateId = 'retired-candidate-id';
    }),
    /stale candidate reference/u
  );
  assert.throws(
    withPlan((plan) => {
      plan.slots[10].policyLanguageId = 'russian';
    }),
    /language slot does not match policy/u
  );
  assert.throws(
    withPlan((plan) => {
      plan.policyVersion = 'wrong-policy-version';
    }),
    /policy mismatch/u
  );

  const collisionPlan = structuredClone(BATCH_PLAN);
  collisionPlan.slots[10].candidateId = 'earth-mandarin-taishan';
  collisionPlan.slots[10].candidateName = 'Copper Vale';
  const collisionSupplement = structuredClone(LANDMARK_SUPPLEMENT);
  collisionSupplement.candidates[0].name = 'Copper Vale';
  assert.throws(
    () =>
      buildWeightedPreview({
        registry,
        batchPlan: collisionPlan,
        supplement: collisionSupplement,
      }),
    /Pinned candidate collides with a reserved name/u
  );
});

test('protected prior review inputs and the single-pilot report remain byte-identical', () => {
  // The new Windows fixture preserves the old manifest bytes after CRLF normalization.
  const pinnedManifest = fs
    .readFileSync('test/fixtures/system-naming-proposal-manifest-v1.json', 'utf8')
    .replace(/\r\n/g, '\n');
  assert.equal(
    createHash('sha256').update(pinnedManifest).digest('hex'),
    'e09f1ea35acb5a5cf32971b519e300b88c161b26ba897015f0ed5d3743a2ece6'
  );
  for (const [file, expectedHash] of Object.entries(PROTECTED_INPUT_HASHES)) {
    const actualHash = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    assert.equal(
      actualHash,
      expectedHash,
      `${file} changed outside the weighted preview artifacts`
    );
  }
});
