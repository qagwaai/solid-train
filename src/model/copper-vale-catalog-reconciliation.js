'use strict';

const { createHash } = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const { previewCopperValeP4 } = require('./non-sol-p4-preview');
const { MUTABLE_BODY_FIELDS } = require('./celestial-seed-ownership');
const REVISIONS = Object.freeze({
  source: 'copper-vale-p3-source-v1',
  physical: 'copper-vale-p3-physical-v1',
  resource: 'copper-vale-p3-resource-v1',
  naming: 'copper-vale-p4-naming-v1',
  station: 'copper-vale-p3-station-v1',
});

function physicalBodyFields(body) {
  return {
    id: body.id, catalogId: body.catalogId, isCatalogBody: body.isCatalogBody,
    spatial: body.spatial, bodyType: body.bodyType, surfaceArchetype: body.surfaceArchetype,
    physicalCatalog: body.physicalCatalog, orbitalElements: body.orbitalElements,
    universeMetadata: {
      generation: body.universeMetadata?.generation,
      provenance: body.universeMetadata?.provenance,
      lifecycle: body.universeMetadata?.lifecycle,
    },
  };
}

function resourceBodyFields(body) {
  return { id: body.id, composition: body.composition,
    asteroidMaterialProfile: body.asteroidMaterialProfile,
    physicalResources: body.physicalCatalog?.resources };
}

function namingBodyFields(body) {
  return { id: body.id, displayName: body.displayName, naming: body.universeMetadata?.naming };
}

function sortedValue(value) {
  if (Array.isArray(value)) return value.map(sortedValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortedValue(value[key])]));
  }
  return value;
}

function sha256(value) {
  return createHash('sha256').update(JSON.stringify(sortedValue(value))).digest('hex');
}

function projectToExpectedShape(actual, expected) {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length) return actual;
    return expected.map((entry, index) => projectToExpectedShape(actual[index], entry));
  }
  if (expected && typeof expected === 'object') {
    if (!actual || typeof actual !== 'object') return actual;
    return Object.fromEntries(Object.keys(expected).map((key) =>
      [key, projectToExpectedShape(actual[key], expected[key])]));
  }
  return actual;
}

function bodyDeltas(actual, expected) {
  const seedOwned = [];
  const gameplay = [];
  function compare(value, wanted, path, target) {
    const projected = projectToExpectedShape(value, wanted);
    if (isDeepStrictEqual(projected, wanted)) return;
    if (wanted && typeof wanted === 'object' && !Array.isArray(wanted) &&
        value && typeof value === 'object') {
      for (const key of Object.keys(wanted)) compare(value[key], wanted[key], `${path}.${key}`, target);
    } else {
      target.push({ field: path, expected: wanted, actual: value === undefined ? null : value,
        ...(typeof value === 'number' && typeof wanted === 'number' ? { delta: value - wanted } : {}) });
    }
  }
  for (const [field, value] of Object.entries(expected)) {
    if (field === 'updatedAt') continue;
    compare(actual?.[field], value, field,
      MUTABLE_BODY_FIELDS.includes(field) ? gameplay : seedOwned);
  }
  const updatedAt = actual?.updatedAt;
  const timestampValid = typeof updatedAt === 'string' && Number.isFinite(Date.parse(updatedAt));
  if (!timestampValid) seedOwned.push({ field: 'updatedAt', expected: 'valid ISO timestamp', actual: updatedAt ?? null });
  return { id: expected.id, seedOwned, gameplay,
    updatedAt: { expected: expected.updatedAt, actual: updatedAt ?? null, validMutableTimestamp: timestampValid } };
}

function assertBodyMatches(actual, expected, { allowGameplayChanges = true } = {}) {
  if (!actual) throw new Error(`Missing expected seeded body ${expected.id}`);
  const differences = bodyDeltas(actual, expected);
  const mismatch = differences.seedOwned[0] ||
    (!allowGameplayChanges && differences.gameplay[0]);
  if (mismatch) throw new Error(`Seed readback mismatch for ${expected.id}.${mismatch.field}`);
  return { pristine: differences.gameplay.length === 0 };
}

/**
 * Pure, fail-closed evidence check. P4 replay validates the current source at its
 * approved epoch before a normal seed version can be adopted; never infer source
 * validity from IDs, current seed state, or a fabricated version in the P6 journal.
 */
function reconcileCopperValeCatalog(state, actualBodies, catalogBodies, preview = previewCopperValeP4()) {
  const expected = [...preview.baseBodies, ...preview.generatedBodies];
  const expectedIds = expected.map((body) => body.id).sort();
  const expectedHashes = Object.fromEntries(expected.map((body) => [body.id, sha256(body)]));
  const hashes = {
    sourceSha256: preview.p3InputSha256,
    physicalSha256: sha256(expected.map(physicalBodyFields)),
    resourceSha256: sha256(expected.map(resourceBodyFields)),
    namingSha256: sha256(expected.map(namingBodyFields)),
    stationSha256: sha256(preview.station),
  };
  if (!state || state.schemaVersion !== 'copper-vale-seed-lifecycle-v1' ||
      state.systemId !== preview.systemId || state.status !== 'complete' ||
      state.marketVerified !== true || state.p4OutputSha256 !== preview.outputSha256 ||
      !isDeepStrictEqual(state.hashes, hashes) ||
      !isDeepStrictEqual(state.revisions, REVISIONS) ||
      !isDeepStrictEqual(state.expectedBodyIds, expectedIds) ||
      !isDeepStrictEqual([...new Set(state.verifiedBodyIds || [])].sort(), expectedIds) ||
      state.verifiedBodyIds.length !== expectedIds.length ||
      !isDeepStrictEqual(state.expectedBodies, expectedHashes) ||
      typeof state.expectedMarketSha256 !== 'string' ||
      typeof state.expectedMarketSeedSha256 !== 'string' ||
      state.planSha256 !== sha256({
        schemaVersion: state.schemaVersion, systemId: preview.systemId,
        epoch: preview.epoch, p4OutputSha256: preview.outputSha256,
        revisions: REVISIONS, hashes, expectedBodies: expectedHashes,
        expectedMarketSha256: state.expectedMarketSha256,
        expectedMarketSeedSha256: state.expectedMarketSeedSha256,
      })) {
    throw new Error('Approved P6 source/checkpoint mismatch; catalog refresh requires owner review');
  }
  // The normal builder must still match the replayed base source exactly.
  if (!isDeepStrictEqual(catalogBodies, preview.baseBodies)) {
    throw new Error('Normal catalog source differs from approved P6 base source; owner review required');
  }
  const byId = new Map(actualBodies.map((body) => [body.id, body]));
  const bodies = expected.map((body) => bodyDeltas(byId.get(body.id), body));
  return {
    writes: false, sourceVerified: true, expectedBodyCount: expected.length,
    actualBodyCount: actualBodies.length,
    matches: bodies.every((body) => body.seedOwned.length === 0),
    bodies,
    basePositions: preview.baseBodies.map((body) => ({
      id: body.id, expected: body.spatial, actual: byId.get(body.id)?.spatial ?? null,
    })),
  };
}

module.exports = {
  REVISIONS, physicalBodyFields, resourceBodyFields, namingBodyFields,
  sha256, projectToExpectedShape, assertBodyMatches, bodyDeltas, reconcileCopperValeCatalog,
};
