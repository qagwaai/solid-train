'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { getSolarSystemRegistry } = require('../src/model/solar-system-registry');
const { getSystemNamingManifest, isProtected } = require('../src/model/system-naming');
const { buildPreview, renderMarkdown } = require('../scripts/dry-run-system-naming-100-review');

const ROOT = path.join(__dirname, '..');
const historicalManifest = require('./fixtures/system-naming-proposal-manifest-v1.json');

test('100-system review preview is deterministic, source-evidenced, and proposal-only', () => {
  const registry = getSolarSystemRegistry({ namingManifest: historicalManifest });
  const preview = buildPreview({ registry, manifest: historicalManifest });
  const reorderedPreview = buildPreview({
    registry: [...registry].reverse(),
    manifest: historicalManifest,
  });
  const storedJson = fs.readFileSync(
    path.join(ROOT, 'data', 'system-naming-100-review-preview.json'),
    'utf8'
  );
  const stored = JSON.parse(storedJson);
  const storedMarkdown = fs.readFileSync(
    path.join(ROOT, 'docs', 'system-naming-100-review-preview-2026-11-05.md'),
    'utf8'
  );

  assert.deepEqual(stored, preview);
  assert.equal(JSON.stringify(reorderedPreview), JSON.stringify(preview));
  assert.equal(renderMarkdown(reorderedPreview), renderMarkdown(preview));
  assert.equal(preview.previewCount, 100);
  assert.equal(preview.registryCount, registry.length);
  assert.equal(preview.runtimeEnabled, false);
  assert.equal(preview.published, false);
  assert.equal(preview.assignmentApprovalCount, 0);
  assert.equal(preview.eligibilityApprovalsCreated, 0);
  assert.equal(preview.contractChanges, 0);
  assert.equal(preview.bodyOrStarOrPlanetChanges, 0);
  assert.equal(new Set(preview.rows.map((row) => row.systemId)).size, 100);
  assert.equal(new Set(preview.rows.map((row) => row.proposedSettlementName)).size, 100);
  assert.equal(preview.rows[0].systemId, 'exo-gj-9066');
  assert.equal(preview.rows[0].originalDesignation, 'GJ 9066');
  assert.equal(preview.rows[0].proposedSettlementName, 'Copper Vale');

  for (const row of preview.rows) {
    const system = registry.find((entry) => entry.id === row.systemId);
    assert.ok(system, `unknown preview system ${row.systemId}`);
    assert.equal(row.originalDesignation, system.catalogName || system.displayName);
    assert.equal(isProtected(system), false, `protected preview system ${row.systemId}`);
    assert.equal(
      row.proposedDisplayName,
      `${row.proposedSettlementName} (${row.originalDesignation})`
    );
    assert.ok(storedMarkdown.includes(row.proposedDisplayName));
    assert.equal(row.proposedEligibility.decision, 'not-decided');
    assert.equal(row.proposedEligibility.status, 'catalog-style-suggestion-only');
    assert.equal(
      row.proposedEligibility.reviewStatus,
      'pending-human-source-and-proper-name-review'
    );
    assert.match(row.proposedEligibility.sourceEvidenceSha256, /^[0-9a-f]{64}$/u);
    assert.equal(row.assignmentStatus, 'pending-human-review-not-approved');
    assert.equal(row.runtimeEnabled, false);
  }

  const authors = preview.rows.filter((row) => row.namingLane === 'author-honoring');
  assert.deepEqual(
    authors.map((row) => row.proposedSettlementName).sort(),
    [
      "Asimov's Beacon",
      "Bradbury's Hearth",
      "Butler's Reach",
      'Clarke Meridian',
      'Jemisin Accord',
      "Le Guin's Horizon",
      "Liu Cixin's Signal",
    ].sort()
  );
  assert.equal(preview.candidatePortfolio.countsByLane['multilingual-provisional'], 24);
  assert.equal(Object.keys(preview.candidatePortfolio.countsByLanguage).length, 13);
  assert.equal(preview.candidatePortfolio.reviewerSignoffsRecorded, 0);
  assert.equal(getSystemNamingManifest().runtimeEnabled, true);
  assert.equal(Object.keys(getSystemNamingManifest().approvedAssignments).length, 4025);
  assert.equal(Object.keys(getSystemNamingManifest().eligibility).length, 4025);
});
