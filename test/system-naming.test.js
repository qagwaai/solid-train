'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { getSolarSystemRegistry } = require('../src/model/solar-system-registry');
const {
  getSystemNamingManifest,
  isProtected,
  normalizeAlias,
  resolveSystemNaming,
  validateNamingManifest,
} = require('../src/model/system-naming');
const {
  addReservedLabels,
  comparisonKeys,
  selectCandidate,
} = require('../src/model/system-naming-proposal');

const ROOT = path.join(__dirname, '..');
const historicalManifest = require('./fixtures/system-naming-proposal-manifest-v1.json');
const { buildReport } = require('../scripts/dry-run-system-naming');

test('author tribute candidate approval retains its limited review metadata', () => {
  const bank = require('../data/system-naming-candidates.json');
  assert.equal(bank.candidateBankVersion, 3);
  assert.deepEqual(
    bank.authorHonoringProposals.map((candidate) => candidate.name),
    [
      "Asimov's Beacon",
      "Le Guin's Horizon",
      "Butler's Reach",
      'Clarke Meridian',
      "Bradbury's Hearth",
      'Jemisin Accord',
      "Liu Cixin's Signal",
    ]
  );
  for (const candidate of bank.authorHonoringProposals) {
    assert.equal(candidate.editorialStatus, 'user-approved');
    assert.equal(candidate.approved, true);
    assert.equal(candidate.allAgesStatus, 'user-approved-english-language-review');
    assert.equal(candidate.rightsStatus, 'owner-authorized-risk-accepted-not-legally-cleared');
  }
  assert.equal(bank.runtimeConsumed, false);
  assert.equal(getSystemNamingManifest().runtimeEnabled, true);
  assert.equal(Object.keys(getSystemNamingManifest().approvedAssignments).length, 25);
});

test('registry naming projection uses approved label and preserves original catalog designation', () => {
  const system = getSolarSystemRegistry().find((entry) => entry.id === 'exo-gj-9066');
  assert.equal(system.displayName, 'Copper Vale (GJ 9066)');
  assert.equal(system.catalogName, 'GJ 9066');
  assert.equal(system.settlementName, 'Copper Vale');
  assert.deepEqual(system.aliases, ['GJ 9066']);
});

test('proposed assignments remain inactive unless runtime and explicit reviews permit publication', () => {
  const system = {
    id: 'exo-test',
    displayName: 'HD 123',
    catalogName: 'HD 123',
    source: 'exoplanet-catalog',
    primaryStar: { properName: null },
  };
  const proposalManifest = {
    runtimeEnabled: false,
    eligibility: { 'exo-test': { decision: 'eligible' } },
    protections: {},
    approvedAssignments: {
      'exo-test': { status: 'approved', settlementName: 'Lantern Reach' },
    },
    aliases: {},
  };
  assert.equal(resolveSystemNaming(system, proposalManifest).settlementName, null);
  proposalManifest.runtimeEnabled = true;
  const resolved = resolveSystemNaming(system, proposalManifest);
  assert.equal(resolved.settlementName, 'Lantern Reach');
  assert.equal(resolved.displayName, 'Lantern Reach (HD 123)');
  assert.ok(resolved.aliases.includes('HD 123'));

  proposalManifest.protections['exo-test'] = { reason: 'protected' };
  assert.equal(resolveSystemNaming(system, proposalManifest).settlementName, null);
});

test('proper names on any source component protect a system even if the primary summary omits them', () => {
  assert.equal(
    isProtected({
      id: 'exo-55-cnc',
      source: 'exoplanet-catalog',
      primaryStar: { properName: null },
    }),
    true
  );
});

test('eligibility evidence is pinned to source records and rejects stale snapshots', () => {
  const registry = getSolarSystemRegistry();
  const pinnedManifest = JSON.parse(JSON.stringify(getSystemNamingManifest()));
  pinnedManifest.eligibility['exo-gj-9066'].sourceEvidenceSha256 = '0'.repeat(64);
  assert.throws(
    () => validateNamingManifest(registry, pinnedManifest),
    /stale or mismatched source evidence/
  );
});

test('manifest validation rejects dangling IDs, protected assignments and name collisions', () => {
  const registry = [
    { id: 'exo-a', source: 'exoplanet-catalog', primaryStar: { properName: null } },
    { id: 'exo-b', source: 'exoplanet-catalog', primaryStar: { properName: null } },
  ];
  assert.throws(
    () =>
      validateNamingManifest(registry, {
        eligibility: {},
        approvedAssignments: {},
        overrides: {},
        protections: { 'exo-missing': { reason: 'dangling' } },
      }),
    /unknown system/
  );
  const duplicateNames = {
    runtimeEnabled: true,
    eligibility: {
      'exo-a': {
        decision: 'eligible',
        reviewer: 'test',
        sourceSnapshot: 'test',
        sourceEvidenceSha256: 'a'.repeat(64),
      },
      'exo-b': {
        decision: 'eligible',
        reviewer: 'test',
        sourceSnapshot: 'test',
        sourceEvidenceSha256: 'b'.repeat(64),
      },
    },
    protections: {},
    overrides: {},
    approvedAssignments: {
      'exo-a': { status: 'approved', settlementName: 'Lantern Reach' },
      'exo-b': { status: 'approved', settlementName: 'lantern-reach' },
    },
  };
  assert.throws(() => validateNamingManifest(registry, duplicateNames), /collision/);
});

test('candidate selection is deterministic, collision-aware and exhausts without inventing names', () => {
  const candidates = [
    { candidateId: 'cafe', name: 'Café' },
    { candidateId: 'other', name: 'Other' },
  ];
  const options = {
    algorithmVersion: 'v1',
    seed: 'fixed',
    systemId: 'exo-a',
  };
  const reserved = new Set(comparisonKeys('Cafe'));
  const first = selectCandidate(candidates, reserved, options);
  assert.equal(first.candidate.candidateId, 'other');
  assert.deepEqual(selectCandidate(candidates, reserved, options), first);
  assert.equal(
    selectCandidate(
      candidates,
      new Set([...comparisonKeys('Cafe'), ...comparisonKeys('Other')]),
      options
    ),
    null
  );
  assert.deepEqual(comparisonKeys('Café'), ['café', 'cafe']);
  const system = { displayName: 'Protected Name', catalogName: 'HD 123' };
  const reservations = addReservedLabels(new Set(), system);
  assert.ok(reservations.has('protectedname'));
  assert.equal(normalizeAlias('  GJ   9066 '), 'gj 9066');
});

test('full-catalog dry-run is reproducible and leaves all assignments unpublished', () => {
  const output = path.join(ROOT, 'data', 'system-naming-dry-run-proposal.json');
  const first = fs.readFileSync(output, 'utf8');
  const generated = buildReport({ manifest: historicalManifest });
  assert.deepEqual(buildReport({ manifest: historicalManifest }), generated);
  assert.deepEqual(generated, JSON.parse(first));
  const report = JSON.parse(first);
  assert.equal(report.registryCount, getSolarSystemRegistry().length);
  assert.equal(report.registryCount, 4845);
  assert.equal(report.runtimeEnabled, false);
  assert.equal(report.writesPerformed, false);
  assert.equal(report.approvedAssignmentCount, 0);
  assert.equal(report.candidateCounts.authorHonoring, 7);
  assert.equal(report.candidateCounts.culturallySourced, 0);
  assert.equal(report.changedExistingAssignments, 0);
  assert.equal(report.proposals.length, 1);
  assert.deepEqual(report.proposals[0], {
    systemId: 'exo-gj-9066',
    source: 'exoplanet-catalog',
    originalDesignation: 'GJ 9066',
    currentDisplayName: 'GJ 9066',
    candidateId: report.proposals[0].candidateId,
    proposedSettlementName: report.proposals[0].proposedSettlementName,
    proposedDisplayName: report.proposals[0].proposedDisplayName,
    aliasesIfApproved: ['GJ 9066'],
    candidateLane: 'original-fictional',
    styles: ['landscape-metaphor'],
    collisionRetries: 0,
    eligibilityReview: 'reviewed-eligible-proposal-only',
    candidateReview: 'unreviewed-proposal',
    rightsReview: 'originality-review-pending',
    allAgesReview: 'human-review-pending',
    assignmentStatus: 'pending-human-approval',
    runtimeEnabled: false,
  });
  assert.equal(report.proposals[0].candidateId, 'original-copper-vale');
  assert.equal(report.proposals[0].proposedSettlementName, 'Copper Vale');
  assert.equal(report.proposals[0].proposedDisplayName, 'Copper Vale (GJ 9066)');
  assert.equal(report.protectedOrUnreviewedLabelsChanged, 0);
  assert.equal(report.nonNameFieldsChanged, 0);
  assert.equal(report.identitiesChanged, 0);
  assert.equal(report.physicalSeedOrBodyChanges, 0);
  assert.equal(Object.keys(getSystemNamingManifest().approvedAssignments).length, 25);
});
