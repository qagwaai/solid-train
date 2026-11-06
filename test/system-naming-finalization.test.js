'use strict';

const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { getSolarSystemRegistry } = require('../src/model/solar-system-registry');
const {
  comparisonKeys,
  getSourceEvidence,
  getSystemNamingManifest,
  isProtected,
  validateNamingManifest,
} = require('../src/model/system-naming');
const { getHamiltonScopeQuotas } = require('../src/model/system-naming-weighted-allocation');
const {
  buildCandidates,
  buildFinalization,
  renderMarkdown,
} = require('../scripts/finalize-system-naming');
const baseline = require('../data/system-naming-finalization-baseline-v1.json');
const report = require('../data/system-naming-finalization-v1.json');
const vocabulary = require('../data/system-naming-final-vocabulary-v1.json');
const policy = require('../data/system-naming-weight-policy-v2.json');
const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const identity = ({ displayName, settlementName, aliases, ...record }) => record;

test('finalization is deterministic, fills every language quota, and matches all persisted artifacts', () => {
  const registry = getSolarSystemRegistry({ namingManifest: baseline });
  const generated = buildFinalization(baseline, registry);
  assert.deepEqual(generated.manifest, getSystemNamingManifest());
  assert.deepEqual(generated.report, report);
  assert.equal(report.baselineManifestSha256, hash(baseline));
  assert.equal(report.vocabularySha256, hash(vocabulary));
  assert.equal(report.manifestSha256, hash(getSystemNamingManifest()));
  assert.equal(report.rows.length, 3906);
  assert.equal(report.newEligibilityDecisions, 3881);
  assert.equal(report.liveDatabaseWrites, 0);
  assert.equal(report.livePublicationVerified, false);
  assert.equal(
    renderMarkdown(report),
    fs.readFileSync(path.join(__dirname, '..', 'docs', 'system-naming-final-review-2026-11-06.md'), 'utf8')
  );
  const counts = new Map();
  for (const row of report.rows) {
    counts.set(row.policyLanguageId, (counts.get(row.policyLanguageId) || 0) + 1);
  }
  for (const quota of getHamiltonScopeQuotas(3906, policy)) {
    assert.equal(counts.get(quota.id), quota.quota, quota.id);
  }
  assert.equal(report.allocation.policy.languages.at(-1).requiredLinguisticStatus, undefined);
  assert.equal(policy.languages.at(-1).requiredLinguisticStatus, 'reviewed');
  assert.equal(report.independentLinguisticOrCulturalVerification, 'not-performed');
  assert.equal(report.rightsStatus, 'owner-authorized-not-legal-clearance');
  assert.ok(report.allocation.quotas.every((quota) => quota.unfilled === 0));
});

test('full naming expansion preserves existing assignments, all other systems, and physical identity', () => {
  const before = getSolarSystemRegistry({ namingManifest: baseline });
  const active = getSolarSystemRegistry();
  const manifest = getSystemNamingManifest();
  const expandedIds = new Set(report.rows.map((row) => row.systemId));
  assert.equal(expandedIds.size, 3906);
  assert.equal(Object.keys(manifest.approvedAssignments).length, 4025);
  assert.equal(Object.keys(manifest.eligibility).length, 4025);
  for (const [id, assignment] of Object.entries(baseline.approvedAssignments)) {
    assert.deepEqual(manifest.approvedAssignments[id], assignment);
  }
  for (const [id, decision] of Object.entries(baseline.eligibility)) {
    assert.deepEqual(manifest.eligibility[id], decision);
  }
  assert.deepEqual(manifest.aliases, baseline.aliases);
  assert.deepEqual(manifest.protections, baseline.protections);
  assert.deepEqual(manifest.overrides, baseline.overrides);
  assert.equal(active.length, 4845);
  assert.deepEqual(active.map(identity), before.map(identity));
  assert.equal(active.filter((system) => system.settlementName).length, 4025);
  assert.equal(active.filter((system, i) => system.displayName !== before[i].displayName).length, 3906);
  assert.equal(before.filter((system) => isProtected(system, baseline)).length, 162);
  for (let index = 0; index < active.length; index++) {
    if (!expandedIds.has(active[index].id)) assert.deepEqual(active[index], before[index]);
  }
  const byId = new Map(active.map((system) => [system.id, system]));
  const used = new Set();
  for (const assignment of Object.values(manifest.approvedAssignments)) {
    for (const key of comparisonKeys(assignment.settlementName)) {
      assert.equal(used.has(key), false, assignment.settlementName);
      used.add(key);
    }
  }
  for (const row of report.rows) {
    const system = byId.get(row.systemId);
    const evidence = getSourceEvidence(system);
    assert.equal(isProtected(system, manifest), false);
    assert.equal(evidence.digest, row.sourceEvidenceSha256);
    assert.equal(evidence.snapshot, row.sourceSnapshot);
    assert.equal(system.catalogName, row.designation);
    assert.equal(system.displayName, row.displayName);
    assert.equal(system.settlementName, row.name);
    assert.ok(system.aliases.includes(row.designation));
    assert.equal(row.name, row.name.normalize('NFC'));
    assert.equal(/[\p{Cc}\u200b-\u200f\u202a-\u202e\u2060-\u206f]/u.test(row.name), false);
  }
  assert.equal(validateNamingManifest(before, manifest), true);
});

test('generation rejects invalid content, language shortages, and protection drift without fallbacks', () => {
  const registry = getSolarSystemRegistry({ namingManifest: baseline });
  const invalid = structuredClone(vocabulary);
  invalid.languages[0].images[0] = 'Bad\u202ename|bad';
  assert.throws(() => buildCandidates(invalid), /Invalid vocabulary entry/u);
  const shortage = structuredClone(vocabulary);
  shortage.languages[0].images = [];
  assert.throws(() => buildFinalization(baseline, registry, shortage), /Candidate shortages/u);
  const protectedRegistry = registry.map((system) =>
    system.id === report.rows[0].systemId
      ? { ...system, primaryStar: { ...system.primaryStar, properName: 'Established name' } }
      : system
  );
  assert.throws(() => buildFinalization(baseline, protectedRegistry));
});

test('indexed collision validation still rejects folded labels and aliases but permits self labels', () => {
  const registry = getSolarSystemRegistry({ namingManifest: baseline });
  const assigned = registry.find((system) => system.id === 'exo-gj-9066');
  const other = registry.find((system) => system.id === 'exo-kepler-931');
  const manifest = {
    eligibility: { [assigned.id]: baseline.eligibility[assigned.id] },
    approvedAssignments: {
      [assigned.id]: { status: 'approved', settlementName: 'Café' },
    },
  };
  assert.equal(validateNamingManifest([{ ...assigned, aliases: ['cafe'] }, other], manifest), true);
  for (const collision of [
    { displayName: 'cafe' },
    { catalogName: 'CA-FE' },
    { aliases: ['CAFÉ'] },
    { primaryStar: { ...other.primaryStar, properName: 'Café' } },
  ]) {
    assert.throws(
      () => validateNamingManifest([assigned, { ...other, ...collision }], manifest),
      /assignment name collision/u
    );
  }
});
