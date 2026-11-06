'use strict';

const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { getSolarSystemRegistry } = require('../src/model/solar-system-registry');
const {
  comparisonKeys,
  getSourceEvidence,
  isProtected,
  validateNamingManifest,
} = require('../src/model/system-naming');
const { getExoplanetSystemProperNames } = require('../src/model/exoplanet-catalog');
const { addReservedLabels } = require('../src/model/system-naming-proposal');
const {
  allocateWeightedScopeCandidates,
} = require('../src/model/system-naming-weighted-allocation');
const { getCatalogNominations } = require('./dry-run-system-naming-full-catalog');
const policy = require('../data/system-naming-weight-policy-v2.json');
const vocabulary = require('../data/system-naming-final-vocabulary-v1.json');
const frozenReview = require('../data/system-naming-full-catalog-review-v1.json');

const ROOT = path.join(__dirname, '..');
const BASELINE_PATH = path.join(ROOT, 'data', 'system-naming-finalization-baseline-v1.json');
const MANIFEST_PATH = path.join(ROOT, 'data', 'system-naming-manifest.json');
const REPORT_PATH = path.join(ROOT, 'data', 'system-naming-finalization-v1.json');
const MARKDOWN_PATH = path.join(ROOT, 'docs', 'system-naming-final-review-2026-11-06.md');
const ALGORITHM = 'system-naming-finalization-v1';
const DATE = '2026-11-06';
const REVIEWER = 'project owner (user)';
const digest = (value) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const invalidText = /[\p{Cc}\u200b-\u200f\u202a-\u202e\u2060-\u206f]/u;

function text(value, description) {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value !== value.trim() ||
    value !== value.normalize('NFC') ||
    invalidText.test(value)
  ) {
    throw new Error(`Invalid ${description}.`);
  }
  return value;
}

function vocabularyEntry(value) {
  const parts = text(value, 'vocabulary entry').split('|');
  if (parts.length !== 2) throw new Error(`Vocabulary entry needs label|gloss: ${value}`);
  return { name: text(parts[0], 'label'), gloss: text(parts[1], 'gloss') };
}

function compose(template, image, place) {
  if (
    typeof template !== 'string' ||
    !template.includes('{image}') ||
    !template.includes('{place}') ||
    /[{}]/u.test(template.replace('{image}', '').replace('{place}', ''))
  ) {
    throw new Error(`Invalid vocabulary template: ${template}`);
  }
  return template.replace('{image}', image).replace('{place}', place);
}

function buildCandidates(bank = vocabulary) {
  const candidates = [];
  const ids = new Set();
  for (const language of bank.languages) {
    text(language.language, 'language');
    text(language.script, 'script');
    if (
      !Array.isArray(language.references) ||
      !language.references.length ||
      language.references.some((reference) => !reference.startsWith('https://en.wiktionary.org/wiki/'))
    ) {
      throw new Error(`Missing lexical references for ${language.language}`);
    }
    for (const [imageIndex, imageValue] of language.images.entries()) {
      for (const [placeIndex, placeValue] of language.places.entries()) {
        const image = vocabularyEntry(imageValue);
        const place = vocabularyEntry(placeValue);
        const candidateId =
          `final-v1-${language.language.toLowerCase()}-${imageIndex + 1}-${placeIndex + 1}`;
        if (ids.has(candidateId)) throw new Error(`Duplicate candidate ID: ${candidateId}`);
        ids.add(candidateId);
        candidates.push({
          candidateId,
          name: text(compose(language.template, image.name, place.name), 'candidate name'),
          language: language.language,
          policyLanguageId: language.policyId,
          script: language.script,
          gloss: compose(language.glossTemplate, image.gloss, place.gloss),
          lexicalReferences: language.references,
          image: image.name,
          place: place.name,
          linguisticStatus: 'owner-authorized-compositional-fiction-not-independently-certified',
        });
      }
    }
  }
  return candidates;
}

function buildFinalization(baselineManifest, registry, bank = vocabulary) {
  assert.equal(Object.keys(baselineManifest.approvedAssignments).length, 119);
  assert.equal(Object.keys(baselineManifest.eligibility).length, 144);
  assert.equal(baselineManifest.runtimeEnabled, true);
  assert.equal(registry.length, 4845);
  validateNamingManifest(registry, baselineManifest);
  const nominations = getCatalogNominations(registry, baselineManifest);
  assert.equal(nominations.length, 4025);
  const scope = nominations.filter((row) => !baselineManifest.approvedAssignments[row.systemId]);
  assert.equal(scope.length, 3906);
  const frozenById = new Map(frozenReview.pendingNominations.map((row) => [row.systemId, row]));
  for (const row of scope) {
    const historical = frozenById.get(row.systemId);
    assert.ok(historical, `Scope drift: ${row.systemId}`);
    assert.equal(row.sourceEvidenceSha256, historical.sourceEvidenceSha256);
    assert.equal(row.sourceSnapshot, historical.sourceSnapshot);
  }

  const finalPolicy = structuredClone(policy);
  finalPolicy.policyVersion = 'system-naming-owner-curated-final-v1';
  finalPolicy.status = 'owner-authorized-full-scope-allocation';
  const other = finalPolicy.languages.find((language) => language.id === 'other-reviewed-traditions');
  delete other.requiredLinguisticStatus;
  other.candidateEligibilityNote =
    'Owner-authorized Finnish/Welsh fictional compounds; no independent linguistic certification claimed.';
  const candidates = buildCandidates(bank);
  for (const candidate of candidates) {
    const category = finalPolicy.languages.find((language) => language.id === candidate.policyLanguageId);
    assert.ok(category?.candidateLanguageLabels.includes(candidate.language));
  }
  const reserved = new Set();
  for (const system of registry) {
    addReservedLabels(reserved, system);
    for (const name of getExoplanetSystemProperNames(system.id)) {
      for (const key of comparisonKeys(name)) reserved.add(key);
    }
  }
  const allocation = allocateWeightedScopeCandidates({
    count: scope.length,
    policy: finalPolicy,
    candidates,
    reservedKeys: reserved,
    algorithmVersion: ALGORITHM,
    seed: bank.seed,
  });
  if (allocation.unfilledCount) {
    throw new Error(
      `Candidate shortages: ${allocation.quotas.filter((quota) => quota.unfilledCount)
        .map((quota) => `${quota.id}: ${quota.unfilledCount}`).join(', ')}`
    );
  }
  const manifest = structuredClone(baselineManifest);
  const byId = new Map(registry.map((system) => [system.id, system]));
  const rows = [];
  let index = 0;
  for (const quota of allocation.quotas) {
    for (const [slot, candidate] of quota.allocatedCandidates.entries()) {
      const nomination = scope[index++];
      const system = byId.get(nomination.systemId);
      assert.equal(isProtected(system, baselineManifest), false);
      assert.deepEqual(getExoplanetSystemProperNames(system.id), []);
      const evidence = getSourceEvidence(system);
      assert.equal(evidence.digest, nomination.sourceEvidenceSha256);
      assert.equal(evidence.snapshot, nomination.sourceSnapshot);
      if (!manifest.eligibility[system.id]) {
        manifest.eligibility[system.id] = {
          decision: 'eligible',
          reason: `${nomination.designation}: owner-authorized final source review; catalog pattern, no attached proper names or protection conflict.`,
          reviewer: REVIEWER,
          reviewStatus: 'owner-authorized-final-source-eligibility',
          sourceSnapshot: evidence.snapshot,
          sourceEvidenceSha256: evidence.digest,
        };
      } else {
        assert.equal(manifest.eligibility[system.id].decision, 'eligible');
      }
      const assignment = {
        status: 'approved',
        settlementName: candidate.name,
        candidateId: candidate.candidateId,
        version: manifest.manifestVersion,
        provenance: `data/system-naming-finalization-v1.json; ${quota.id} slot ${slot + 1}; owner-authorized finalization ${DATE}`,
        rightsStatus: bank.rightsStatus,
      };
      manifest.approvedAssignments[system.id] = assignment;
      rows.push({
        systemId: system.id,
        designation: nomination.designation,
        matchedDesignationPattern: nomination.matchedDesignationPattern,
        sourceSnapshot: evidence.snapshot,
        sourceEvidenceSha256: evidence.digest,
        sourceRank: nomination.rank,
        eligibilityPreviouslyApproved: Boolean(baselineManifest.eligibility[system.id]),
        ...candidate,
        languageSlot: slot + 1,
        displayName: `${candidate.name} (${nomination.designation})`,
        status: 'owner-authorized-active-on-disk',
      });
    }
  }
  manifest.approval.scope =
    'Existing 119 assignments preserved; owner authorized generated fictional names, source eligibility decisions, and activation for all 3906 remaining catalog-pattern nominations. Protected systems and proper names remain unchanged.';
  manifest.finalization = {
    date: DATE,
    reviewer: REVIEWER,
    report: 'data/system-naming-finalization-v1.json',
    vocabulary: 'data/system-naming-final-vocabulary-v1.json',
    algorithmVersion: ALGORITHM,
    policyVersion: finalPolicy.policyVersion,
    baselineManifestSha256: digest(baselineManifest),
    ownerAuthorization:
      'Authorize generation, eligibility decisions, and activation now within the confirmed scope.',
    scope: 'All remaining catalog-pattern nominations; preserve protected systems and existing proper names.',
    curation: bank.curation,
    independentLinguisticOrCulturalVerification: 'not-performed',
    rightsStatus: bank.rightsStatus,
    deploymentStatus: 'enabled-on-disk; coordinated-restart-and-live-verification-required',
  };
  assert.equal(index, scope.length);
  assert.equal(Object.keys(manifest.eligibility).length, 4025);
  assert.equal(Object.keys(manifest.approvedAssignments).length, 4025);
  validateNamingManifest(registry, manifest);

  const report = {
    reportVersion: 1,
    date: DATE,
    algorithmVersion: ALGORITHM,
    seed: bank.seed,
    status: 'owner-authorized-finalization-enabled-on-disk',
    liveDatabaseWrites: 0,
    livePublicationVerified: false,
    curation: bank.curation,
    independentLinguisticOrCulturalVerification: 'not-performed',
    rightsStatus: bank.rightsStatus,
    baselineManifestSha256: digest(baselineManifest),
    vocabularySha256: digest(bank),
    historicalReviewSha256: digest(frozenReview),
    manifestSha256: digest(manifest),
    registryCount: registry.length,
    preservedAssignments: 119,
    newAssignments: rows.length,
    newEligibilityDecisions: rows.filter((row) => !row.eligibilityPreviouslyApproved).length,
    activeAssignmentCount: 4025,
    unchangedSystems: 820,
    protectedSystems: registry.filter((system) => isProtected(system, baselineManifest)).length,
    allocation: {
      method: 'hamilton-largest-remainder-per-final-remaining-scope',
      noCrossLanguageRedistribution: true,
      cumulativeFairnessPromised: false,
      policy: finalPolicy,
      quotas: allocation.quotas.map((quota) => ({
        languageId: quota.id,
        language: quota.language,
        weight: quota.weight,
        quota: quota.quota,
        filled: quota.filledCount,
        unfilled: quota.unfilledCount,
        rejectedCandidateIds: quota.rejectedCandidateIds,
      })),
    },
    rows,
  };
  return { manifest, report };
}

function renderMarkdown(report) {
  const lines = [
    '# Final system-naming review',
    '',
    `Date: ${DATE}. Owner authorized generation, eligibility decisions, and activation.`,
    '',
    `Registry: **${report.registryCount}**. Existing assignments preserved: **119**. New assignments: **${report.newAssignments}**. Total names enabled on disk: **${report.activeAssignmentCount}**.`,
    `Protected systems: **${report.protectedSystems}**. Systems left unchanged: **${report.unchangedSystems}**. New eligibility decisions: **${report.newEligibilityDecisions}**.`,
    '',
    'Curation is owner-authorized original fictional naming using the existing landscape, settlement, aspiration and journey themes. Component lexical references are editorial aids, not verification of every compound or native-speaker/cultural certification. No legal clearance is claimed.',
    '',
    'All original catalog designations, IDs, existing 119 assignments and aliases are preserved. New compounds do not claim real settlements, populations, physical conditions, or habitability. No star/planet/body labels change.',
    '',
    'The runtime manifest is enabled on disk. This report does not establish live publication: no live database writes or server restarts were performed by the finalizer.',
    '',
    '## Allocation',
    '',
    'Hamilton weights apply to these 3,906 remaining systems, not retroactively to earlier assignments. Shortages are never redistributed between languages. The Finnish/Welsh bucket uses owner-authorized curation instead of the earlier independent-reviewed-status gate; its 2% weight is unchanged.',
    '',
    '| Language | Weight | New assignments |',
    '| --- | ---: | ---: |',
    ...report.allocation.quotas.map((quota) => `| ${quota.language} | ${quota.weight}% | ${quota.filled} |`),
    '',
    '## Complete assignment review',
    '',
    'Exact evidence SHA-256 digests, vocabulary components, lexical references and owner-authorization metadata are in [the JSON audit](../data/system-naming-finalization-v1.json). This list contains all new assignments.',
    '',
    '| # | System ID | Original designation | Assigned name | Language | Editorial gloss |',
    '| ---: | --- | --- | --- | --- | --- |',
    ...report.rows.map((row, index) =>
      `| ${index + 1} | ${row.systemId} | ${row.designation} | ${row.name} | ${row.language} | ${row.gloss} |`
    ),
    '',
    '## Deployment and rollback',
    '',
    '1. Review and commit the final artifacts. Back up/pin the full pre-expansion database presentation before deployment.',
    '2. Coordinate the normal backend restart. Startup must synchronize the full 4,845-system registry, never an assignment subset.',
    '3. Verify 4,845 records, 4,025 active names, exactly 3,906 additional label changes against the 119-name deployment, zero removals, preserved IDs and body/save data, and authenticated list/get/search parity.',
    '4. For expansion-only rollback, restore the pinned 119-assignment manifest from [the finalization baseline](../data/system-naming-finalization-baseline-v1.json), then perform the same coordinated full-registry sync. Setting runtimeEnabled false rolls back all names, not just this expansion.',
    '',
  ];
  return lines.join('\n');
}

function main(args) {
  if (args.length !== 1 || !['--activate', '--check'].includes(args[0])) {
    throw new Error('Usage: node scripts/finalize-system-naming.js --activate|--check');
  }
  const current = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const baselineExists = fs.existsSync(BASELINE_PATH);
  const baseline = baselineExists
    ? JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'))
    : current;
  const registry = getSolarSystemRegistry({ namingManifest: baseline });
  const { manifest, report } = buildFinalization(baseline, registry);
  const outputs = [
    [BASELINE_PATH, json(baseline)],
    [REPORT_PATH, json(report)],
    [MARKDOWN_PATH, renderMarkdown(report)],
    [MANIFEST_PATH, json(manifest)],
  ];
  if (args[0] === '--check') {
    for (const [file, expected] of outputs) {
      assert.equal(fs.readFileSync(file, 'utf8'), expected, `Finalization drift: ${file}`);
    }
  } else {
    assert.ok(
      digest(current) === digest(baseline) || digest(current) === digest(manifest),
      'Manifest drift: refusing to overwrite changes outside this finalization.'
    );
    for (const [file, contents] of outputs) fs.writeFileSync(file, contents);
  }
  console.log(JSON.stringify({
    mode: args[0],
    newAssignments: report.newAssignments,
    activeAssignments: report.activeAssignmentCount,
    newEligibilityDecisions: report.newEligibilityDecisions,
    manifestSha256: report.manifestSha256,
    liveDatabaseWrites: 0,
  }));
}

if (require.main === module) main(process.argv.slice(2));

module.exports = { buildCandidates, buildFinalization, renderMarkdown };
