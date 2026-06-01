'use strict';

const fs = require('node:fs');
const path = require('node:path');

const LOCKED_SCHEMA_VERSION = 'sw-13-m0-v1';
const LOCKED_FALLBACK_TIERS = ['hero', 'minimal', 'standard'];
const FORBIDDEN_LEGACY_FIELDS = [
  'legacyDomain',
  'legacyFamily',
  'legacyFallback',
  'fallbackMapping',
  'fallbackAlias',
  'legacyMapping',
];

const PAYLOAD_FILES = Object.freeze({
  m1DebrisAsteroids: 'test/fixtures/sw13/external-object-descriptor-m1-debris-asteroids.json',
  m2ShipsStations: 'test/fixtures/sw13/external-object-descriptor-m2-ships-stations.json',
  m3GateLandmarks: 'test/fixtures/sw13/external-object-gate-landmark-m3.json',
});

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      result[key] = true;
      continue;
    }

    result[key] = next;
    index += 1;
  }
  return result;
}

function sortValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sortValue(item));
  }

  if (value && typeof value === 'object') {
    const sorted = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = sortValue(value[key]);
    }
    return sorted;
  }

  return value;
}

function stableStringify(value) {
  return `${JSON.stringify(sortValue(value), null, 2)}\n`;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function ensureStatBucket(bucket, key) {
  if (!bucket[key]) {
    bucket[key] = {
      count: 0,
      min: Number.POSITIVE_INFINITY,
      max: 0,
      total: 0,
      average: 0,
    };
  }

  return bucket[key];
}

function addSize(bucket, key, size) {
  const stats = ensureStatBucket(bucket, key);
  stats.count += 1;
  stats.min = Math.min(stats.min, size);
  stats.max = Math.max(stats.max, size);
  stats.total += size;
}

function finalizeStats(statsByKey) {
  for (const key of Object.keys(statsByKey)) {
    const stats = statsByKey[key];
    stats.average = stats.count > 0 ? Math.round(stats.total / stats.count) : 0;
    if (!Number.isFinite(stats.min)) {
      stats.min = 0;
    }
  }
}

function buildReport(rootDir) {
  const payloads = {};
  for (const key of Object.keys(PAYLOAD_FILES)) {
    payloads[key] = readJson(path.resolve(rootDir, PAYLOAD_FILES[key]));
  }

  const descriptorsByPayload = {
    m1DebrisAsteroids: payloads.m1DebrisAsteroids.descriptors,
    m2ShipsStations: payloads.m2ShipsStations.descriptors,
    m3GateLandmarks: payloads.m3GateLandmarks.gates.map((entry) => entry.descriptor),
  };

  const allDescriptors = Object.values(descriptorsByPayload).flat();
  const descriptorKeySet = new Set(allDescriptors.flatMap((entry) => Object.keys(entry)));
  const canonicalDescriptorKeys = [...descriptorKeySet].sort();
  const schemaVersions = [...new Set(allDescriptors.map((entry) => entry.schemaVersion))].sort();
  const fallbackTiers = [...new Set(allDescriptors.map((entry) => entry.fallbackTier))].sort();

  const descriptorShapeMismatch = [];
  const legacyFieldHits = [];
  const descriptorStatsByDomain = {};
  const descriptorSizeStatsByDomain = {};
  const payloadByteSizeByBundle = {};

  for (const [bundleName, descriptors] of Object.entries(descriptorsByPayload)) {
    for (const descriptor of descriptors) {
      const keys = Object.keys(descriptor).sort();
      if (keys.join('|') !== canonicalDescriptorKeys.join('|')) {
        descriptorShapeMismatch.push({
          bundle: bundleName,
          descriptorId: descriptor.descriptorId,
          keys,
        });
      }

      for (const forbidden of FORBIDDEN_LEGACY_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(descriptor, forbidden)) {
          legacyFieldHits.push({
            bundle: bundleName,
            descriptorId: descriptor.descriptorId,
            field: forbidden,
          });
        }
      }

      descriptorStatsByDomain[descriptor.domain] = (descriptorStatsByDomain[descriptor.domain] || 0) + 1;
      addSize(descriptorSizeStatsByDomain, descriptor.domain, JSON.stringify(descriptor).length);
    }

    payloadByteSizeByBundle[bundleName] = Buffer.byteLength(
      stableStringify(payloads[bundleName]),
      'utf8'
    );
  }

  const approachMetadataEntries = payloads.m3GateLandmarks.gates.map((entry) => entry.approachMetadata);
  const approachMetadataKeySet = new Set(approachMetadataEntries.flatMap((entry) => Object.keys(entry)));
  const canonicalApproachMetadataKeys = [...approachMetadataKeySet].sort();
  const approachMetadataMismatch = [];
  const approachMetadataSizeStats = {};

  for (const gate of payloads.m3GateLandmarks.gates) {
    const keys = Object.keys(gate.approachMetadata).sort();
    if (keys.join('|') !== canonicalApproachMetadataKeys.join('|')) {
      approachMetadataMismatch.push({
        descriptorId: gate.descriptor.descriptorId,
        keys,
      });
    }
    addSize(approachMetadataSizeStats, 'gateApproachMetadata', JSON.stringify(gate.approachMetadata).length);
  }

  finalizeStats(descriptorSizeStatsByDomain);
  finalizeStats(approachMetadataSizeStats);

  const payloadOrderingChecks = Object.entries(descriptorsByPayload).map(([bundle, descriptors]) => {
    const descriptorIds = descriptors.map((entry) => entry.descriptorId);
    const isSorted = descriptorIds.join('|') === [...descriptorIds].sort().join('|');
    return {
      bundle,
      sortedByDescriptorId: isSorted,
    };
  });

  const report = {
    summary: {
      scope: 'SW-13 M4 Forge descriptor size and payload consistency review',
      lockedSchemaVersion: LOCKED_SCHEMA_VERSION,
      lockedFallbackTiers: LOCKED_FALLBACK_TIERS,
      consistencyChecks: {
        schemaVersionLocked:
          schemaVersions.length === 1 && schemaVersions[0] === LOCKED_SCHEMA_VERSION,
        fallbackTierLocked:
          fallbackTiers.join('|') === LOCKED_FALLBACK_TIERS.join('|'),
        descriptorShapeConsistent: descriptorShapeMismatch.length === 0,
        approachMetadataShapeConsistent: approachMetadataMismatch.length === 0,
        noLegacyFallbackFields: legacyFieldHits.length === 0,
        deterministicOrdering: payloadOrderingChecks.every((entry) => entry.sortedByDescriptorId),
      },
      payloadByteSizeByBundle,
      descriptorCountByDomain: descriptorStatsByDomain,
      descriptorSizeByDomain: descriptorSizeStatsByDomain,
      approachMetadataSize: approachMetadataSizeStats,
    },
    evidence: {
      payloadFiles: PAYLOAD_FILES,
      descriptorFieldKeys: canonicalDescriptorKeys,
      approachMetadataFieldKeys: canonicalApproachMetadataKeys,
      schemaVersions,
      fallbackTierValues: fallbackTiers,
      payloadOrderingChecks,
      descriptorShapeMismatch,
      approachMetadataMismatch,
      legacyFieldHits,
      generatedBy: 'scripts/sw13/review-descriptor-size-consistency.js',
    },
  };

  return report;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const rootDir = path.resolve(__dirname, '..', '..');
  const reportPath = path.resolve(
    rootDir,
    args.report || 'artifacts/contracts/sw13-m4-size-consistency-report.json'
  );

  const report = buildReport(rootDir);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, stableStringify(report), 'utf8');

  console.log(`[sw13-m4] wrote size/consistency review: ${path.relative(rootDir, reportPath)}`);
}

if (require.main === module) {
  main();
}

module.exports = {
  buildReport,
  LOCKED_SCHEMA_VERSION,
  LOCKED_FALLBACK_TIERS,
  FORBIDDEN_LEGACY_FIELDS,
};
