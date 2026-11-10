'use strict';

const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { createSchemaValidator } = require('../../src/model/schema-validator');
const { BODY_TYPE_VALUES } = require('../../src/model/celestial-body-upsert');
const { getHamiltonScopeQuotas } = require('../../src/model/system-naming-weighted-allocation');

const SCHEMA_VERSION = 'non-sol-celestial-manifest-p0-v1';
const BASELINE_EPOCH = '2000-01-01T12:00:00.000Z';
const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const compareIds = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const shaSchema = { type: 'string', pattern: '^[a-f0-9]{64}$' };
const textSchema = { type: 'string', minLength: 1 };
const nullableText = { anyOf: [textSchema, { type: 'null' }] };
const textArray = { type: 'array', items: textSchema, uniqueItems: true };
const countsSchema = {
  type: 'object',
  additionalProperties: false,
  required: [...BODY_TYPE_VALUES, 'rings'],
  properties: Object.fromEntries(
    [...BODY_TYPE_VALUES, 'rings'].map((type) => [type, { type: 'integer', minimum: 0 }])
  ),
};

function objectSchema(properties) {
  return {
    type: 'object',
    additionalProperties: false,
    required: Object.keys(properties),
    properties,
  };
}

const profileSchema = objectSchema({
  status: { enum: ['inherited-evidence', 'unassigned'] },
  language: nullableText,
  policyLanguageId: nullableText,
  theme: nullableText,
  evidenceFile: nullableText,
  candidateId: nullableText,
});
const resourceSchema = objectSchema({
  authority: textSchema,
  status: { const: 'existing-catalog-inventory-not-a-final-tech-tree' },
  materials: {
    type: 'array',
    items: objectSchema({
      itemType: textSchema,
      displayName: textSchema,
      tier: { type: ['integer', 'null'], minimum: 1 },
      rarity: { enum: ['common', 'uncommon', 'rare', 'exotic'] },
      yieldItemType: nullableText,
      marketCanBuy: { type: 'boolean' },
      marketCanSell: { type: 'boolean' },
      miningRequirement: { type: ['string', 'null'] },
      typicalLocation: { type: ['string', 'null'] },
      scientificStatus: { enum: ['fictional', 'not-scientifically-calibrated'] },
    }),
  },
  crafting: {
    type: 'array',
    items: objectSchema({
      itemType: textSchema,
      displayName: textSchema,
      tier: { type: ['integer', 'null'], minimum: 1 },
      category: textSchema,
      requirements: {
        type: 'array',
        items: objectSchema({
          material: textSchema,
          quantity: { type: 'number', exclusiveMinimum: 0 },
          resolvedItemType: nullableText,
        }),
      },
      dependentItems: {
        type: 'array',
        items: objectSchema({
          itemType: textSchema,
          resolved: { type: 'boolean' },
        }),
      },
      fabrication: { type: ['object', 'null'] },
    }),
  },
  techNotes: objectSchema({
    path: textSchema,
    status: { const: 'provisional-design-not-runtime-unlocks' },
    selection: textSchema,
    proposedLevels: {
      type: 'array',
      items: objectSchema({
        level: { type: 'integer', minimum: 1, maximum: 50 },
        label: textSchema,
        canonicalItemTypes: textArray,
      }),
    },
  }),
  mining: objectSchema({
    evidenceFile: textSchema,
    executableItemType: textSchema,
    materialResolution: textSchema,
    playableChainVerified: { const: false },
  }),
  unresolvedRequirements: {
    type: 'array',
    items: objectSchema({
      itemType: textSchema,
      material: textSchema,
    }),
  },
  unresolvedDependencies: {
    type: 'array',
    items: objectSchema({
      itemType: textSchema,
      dependency: textSchema,
    }),
  },
  gaps: {
    type: 'array',
    items: objectSchema({
      id: textSchema,
      blockingPhase: textSchema,
      reason: textSchema,
    }),
  },
});
const bodySchema = objectSchema({
  id: textSchema,
  catalogId: nullableText,
  catalogIdentity: { type: ['object', 'null'] },
  parentBodyId: nullableText,
  orbitalAnchorBodyId: nullableText,
  circumbinaryStarIds: textArray,
  bodyType: { enum: BODY_TYPE_VALUES },
  displayName: textSchema,
  catalogName: nullableText,
  surfaceArchetype: textSchema,
  baselineSha256: shaSchema,
  catalogSource: nullableText,
  approximateFields: textArray,
  diameterKm: { type: ['number', 'null'], minimum: 0 },
  namingEligible: { type: ['boolean', 'null'] },
  rings: { type: ['object', 'null'] },
});
const marketSchema = objectSchema({
  id: textSchema,
  siteType: textSchema,
  marketName: textSchema,
  anchorBodyId: nullableText,
  trajectory: { type: ['object', 'null'] },
  baselineSha256: shaSchema,
  anchorResolved: { type: 'boolean' },
});
const systemSchema = objectSchema({
  id: textSchema,
  source: { enum: ['curated', 'procedural', 'exoplanet-catalog'] },
  displayName: textSchema,
  catalogName: nullableText,
  aliases: textArray,
  registrySha256: shaSchema,
  sourceEvidenceSha256: shaSchema,
  sourceEvidenceKind: { enum: ['source-record', 'canonical-baseline'] },
  seedVersion: textSchema,
  generationSeed: { type: ['number', 'null'] },
  baselineSha256: shaSchema,
  profile: profileSchema,
  counts: countsSchema,
  bodies: { type: 'array', items: bodySchema, minItems: 1 },
  markets: { type: 'array', items: marketSchema },
  stage: { const: 'pending' },
  generatedBodyIds: { type: 'array', maxItems: 0 },
  generatedOutputSha256: { type: 'null' },
  populations: { type: 'null' },
  stationPlacements: { type: 'null' },
  validation: objectSchema({
    baselineReferencesChecked: { const: true },
    scientific: { const: 'not-run' },
    gameplay: { const: 'not-run' },
    persistent: { const: 'not-run' },
    consumer: { const: 'not-run' },
  }),
  exceptionIds: textArray,
});

const manifestSchema = objectSchema({
  schemaVersion: { const: SCHEMA_VERSION },
  scopeRevision: { const: 1 },
  scopeDate: { const: '2026-11-07' },
  baselineEpoch: { const: BASELINE_EPOCH },
  runtimeEnabled: { const: false },
  databaseWrites: { const: 0 },
  excludedSystemIds: { const: ['sol'] },
  expectedTargetCount: { type: 'integer', minimum: 1 },
  registryCount: { type: 'integer', minimum: 2 },
  registrySha256: shaSchema,
  sourceFiles: {
    type: 'array',
    minItems: 1,
    items: objectSchema({ path: textSchema, sha256: shaSchema }),
  },
  policyVersions: objectSchema({
    physical: { type: 'null' },
    naming: textSchema,
    resource: { type: 'null' },
    station: { type: 'null' },
  }),
  namingPolicy: objectSchema({
    weights: {
      type: 'array',
      minItems: 1,
      items: objectSchema({
        id: textSchema,
        language: textSchema,
        weight: { type: 'integer', minimum: 0 },
        candidateLanguageLabels: textArray,
      }),
    },
    inheritedPercent: { const: 60 },
    narrativePercent: { const: 40 },
    quotaScope: { const: 'unprofiled-systems-only' },
    unprofiledSystemIds: textArray,
    unprofiledQuotas: {
      type: 'array',
      items: objectSchema({
        id: textSchema,
        quota: { type: 'integer', minimum: 0 },
      }),
    },
  }),
  protectedBaseline: objectSchema({
    systemId: { const: 'sol' },
    bodyCount: { type: 'integer', minimum: 1 },
    bodiesSha256: shaSchema,
    bodyIdsSha256: shaSchema,
    registrySha256: shaSchema,
    marketsSha256: shaSchema,
    counts: countsSchema,
  }),
  inventory: objectSchema({
    counts: countsSchema,
    sourceCounts: objectSchema({
      curated: { type: 'integer', minimum: 0 },
      procedural: { type: 'integer', minimum: 0 },
      'exoplanet-catalog': { type: 'integer', minimum: 0 },
    }),
    existingNamedSystemCount: { type: 'integer', minimum: 0 },
    existingPlanetNameOverrides: { type: 'integer', minimum: 0 },
  }),
  resources: resourceSchema,
  ownership: {
    type: 'array',
    minItems: 1,
    items: objectSchema({
      domain: textSchema,
      seedOwnedFields: textArray,
      mutableFields: textArray,
      currentBehavior: textSchema,
      requiredSafeguard: textSchema,
      evidenceFile: textSchema,
    }),
  },
  exceptions: {
    type: 'array',
    items: objectSchema({
      id: textSchema,
      systemId: nullableText,
      reason: textSchema,
      blockingPhase: textSchema,
      status: { const: 'open' },
    }),
  },
  approvals: objectSchema({
    implementation: { const: 'p0-authorized' },
    checkpoint: { type: 'null' },
    pilot: { type: 'null' },
    bulk: { type: 'null' },
  }),
  systems: { type: 'array', minItems: 1, items: systemSchema },
  manifestSha256: shaSchema,
});
const validateSchema = createSchemaValidator({ allErrors: true, strictNumbers: true }).compile(
  manifestSchema
);

function bodyCounts(bodies) {
  const counts = Object.fromEntries([...BODY_TYPE_VALUES, 'rings'].map((type) => [type, 0]));
  for (const body of bodies) {
    assert.ok(BODY_TYPE_VALUES.includes(body.bodyType), `Unknown bodyType: ${body.id}`);
    counts[body.bodyType]++;
    if (body.rings) counts.rings++;
  }
  return counts;
}

function assertBodyReferences(bodies, systemId) {
  const byId = new Map();
  for (const body of bodies) {
    assert.ok(body.id && !byId.has(body.id), `Duplicate or missing body ID in ${systemId}`);
    byId.set(body.id, body);
  }
  for (const body of bodies) {
    const references = [
      ...(body.circumbinaryStarIds ?? []),
      ...(body.orbitalAnchorBodyId ? [body.orbitalAnchorBodyId] : []),
      ...(body.orbitalElements?.anchorBodyId ? [body.orbitalElements.anchorBodyId] : []),
    ];
    for (const reference of references) {
      assert.ok(byId.has(reference), `Orphan orbital reference ${reference} in ${systemId}`);
    }
    const visited = new Set([body.id]);
    let parentId = body.parentBodyId;
    while (parentId) {
      assert.ok(byId.has(parentId), `Orphan parent ${parentId} in ${systemId}`);
      assert.ok(!visited.has(parentId), `Parent cycle in ${systemId}: ${body.id}`);
      visited.add(parentId);
      parentId = byId.get(parentId).parentBodyId;
    }
  }
}

function summarizeBody(body) {
  const diameterKm =
    Number.isFinite(body.physical?.estimatedDiameterM) && body.physical.estimatedDiameterM > 0
      ? body.physical.estimatedDiameterM / 1000
      : null;
  return {
    id: body.id,
    catalogId: body.catalogId ?? null,
    catalogIdentity: body.catalogIdentity ?? null,
    parentBodyId: body.parentBodyId ?? null,
    orbitalAnchorBodyId: body.orbitalElements?.anchorBodyId ?? null,
    circumbinaryStarIds: body.circumbinaryStarIds ?? [],
    bodyType: body.bodyType,
    displayName: body.displayName,
    catalogName: body.catalogName ?? null,
    surfaceArchetype: body.surfaceArchetype,
    baselineSha256: digest(body),
    catalogSource: body.catalogSource ?? null,
    approximateFields: body.approximateFields ?? [],
    diameterKm,
    namingEligible: ['planet', 'dwarf-planet'].includes(body.bodyType)
      ? true
      : body.bodyType === 'moon'
        ? diameterKm === null
          ? null
          : diameterKm >= 200
        : false,
    rings: body.rings ?? null,
  };
}

function summarizeMarkets(markets, bodies) {
  const ids = new Set(bodies.map((body) => body.id));
  return markets
    .map((market) => ({
      id: market.marketId,
      siteType: market.siteType,
      marketName: market.marketName,
      anchorBodyId: market.trajectory?.orbit?.anchorBodyId ?? null,
      trajectory: market.trajectory ?? null,
      baselineSha256: digest(market),
      anchorResolved:
        !market.trajectory?.orbit?.anchorBodyId || ids.has(market.trajectory.orbit.anchorBodyId),
    }))
    .sort(compareIds);
}

function quotaRows(count, policy) {
  return count === 0
    ? policy.languages.map(({ id }) => ({ id, quota: 0 }))
    : getHamiltonScopeQuotas(count, policy).map(({ id, quota }) => ({ id, quota }));
}

function buildManifest(inputs) {
  const registry = [...inputs.registry].sort(compareIds);
  assert.equal(
    new Set(registry.map((system) => system.id)).size,
    registry.length,
    'Duplicate system ID'
  );
  const sol = registry.find((system) => system.id === 'sol');
  assert.ok(sol, 'Sol baseline is required');
  const systems = registry
    .filter((system) => system.id !== 'sol')
    .map((system) => {
      const bodies = [...inputs.getBodies(system.id)].sort(compareIds);
      assert.ok(bodies.length, `Missing baseline bodies: ${system.id}`);
      assertBodyReferences(bodies, system.id);
      const evidence = inputs.getSourceEvidence(system);
      const baselineSha256 = digest(bodies);
      return {
        id: system.id,
        source: system.source,
        displayName: system.displayName,
        catalogName: system.catalogName ?? null,
        aliases: system.aliases ?? [],
        registrySha256: digest(system),
        sourceEvidenceSha256: evidence?.digest ?? baselineSha256,
        sourceEvidenceKind: evidence ? 'source-record' : 'canonical-baseline',
        seedVersion: inputs.getSeedVersion(system.id),
        generationSeed: system.generationSeed ?? null,
        baselineSha256,
        profile: inputs.profiles.get(system.id) ?? {
          status: 'unassigned',
          language: null,
          policyLanguageId: null,
          theme: null,
          evidenceFile: null,
          candidateId: null,
        },
        counts: bodyCounts(bodies),
        bodies: bodies.map(summarizeBody),
        markets: summarizeMarkets(inputs.getMarkets(system.id), bodies),
        stage: 'pending',
        generatedBodyIds: [],
        generatedOutputSha256: null,
        populations: null,
        stationPlacements: null,
        validation: {
          baselineReferencesChecked: true,
          scientific: 'not-run',
          gameplay: 'not-run',
          persistent: 'not-run',
          consumer: 'not-run',
        },
        exceptionIds: [],
      };
    });
  const allIds = systems.flatMap((system) => system.bodies.map((body) => body.id));
  assert.equal(new Set(allIds).size, allIds.length, 'Body IDs collide across systems');
  const unprofiledSystemIds = systems
    .filter((system) => system.profile.status === 'unassigned')
    .map((system) => system.id);
  const solBodies = [...inputs.getBodies('sol')].sort(compareIds);
  assertBodyReferences(solBodies, 'sol');
  const exceptions = inputs.resources.gaps.map((gap) => ({
    id: gap.id,
    systemId: null,
    reason: gap.reason,
    blockingPhase: gap.blockingPhase,
    status: 'open',
  }));
  for (const system of systems) {
    for (const market of system.markets.filter((market) => !market.anchorResolved)) {
      const id = `baseline-anchor:${market.id}`;
      exceptions.push({
        id,
        systemId: system.id,
        reason: `Baseline market anchor ${market.anchorBodyId} is not a canonical body.`,
        blockingPhase: 'P3',
        status: 'open',
      });
      system.exceptionIds.push(id);
    }
  }
  const manifest = {
    schemaVersion: SCHEMA_VERSION,
    scopeRevision: 1,
    scopeDate: '2026-11-07',
    baselineEpoch: BASELINE_EPOCH,
    runtimeEnabled: false,
    databaseWrites: 0,
    excludedSystemIds: ['sol'],
    expectedTargetCount: systems.length,
    registryCount: registry.length,
    registrySha256: digest(registry),
    sourceFiles: inputs.sourceFiles,
    policyVersions: {
      physical: null,
      naming: inputs.policy.policyVersion,
      resource: null,
      station: null,
    },
    namingPolicy: {
      weights: inputs.policy.languages.map(({ id, language, weight, candidateLanguageLabels }) => ({
        id,
        language,
        weight,
        candidateLanguageLabels,
      })),
      inheritedPercent: 60,
      narrativePercent: 40,
      quotaScope: 'unprofiled-systems-only',
      unprofiledSystemIds,
      unprofiledQuotas: quotaRows(unprofiledSystemIds.length, inputs.policy),
    },
    protectedBaseline: {
      systemId: 'sol',
      bodyCount: solBodies.length,
      bodiesSha256: digest(solBodies),
      bodyIdsSha256: digest(solBodies.map((body) => body.id)),
      registrySha256: digest(sol),
      marketsSha256: digest(summarizeMarkets(inputs.getMarkets('sol'), solBodies)),
      counts: bodyCounts(solBodies),
    },
    inventory: {
      counts: bodyCounts(systems.flatMap((system) => system.bodies)),
      sourceCounts: Object.fromEntries(
        ['curated', 'procedural', 'exoplanet-catalog'].map((source) => [
          source,
          systems.filter((system) => system.source === source).length,
        ])
      ),
      existingNamedSystemCount: systems.filter(
        (system) => system.profile.status === 'inherited-evidence'
      ).length,
      existingPlanetNameOverrides: inputs.existingPlanetNameOverrides,
    },
    resources: inputs.resources,
    ownership: inputs.ownership,
    exceptions,
    approvals: { implementation: 'p0-authorized', checkpoint: null, pilot: null, bulk: null },
    systems,
  };
  const sealed = { ...manifest, manifestSha256: digest(manifest) };
  validateManifest(sealed);
  return sealed;
}

function validateManifest(manifest) {
  assert.ok(
    validateSchema(manifest),
    `Manifest schema invalid: ${JSON.stringify(validateSchema.errors)}`
  );
  const { manifestSha256, ...content } = manifest;
  assert.equal(digest(content), manifestSha256, 'Manifest digest mismatch');
  assert.equal(manifest.systems.length, manifest.expectedTargetCount, 'Target count mismatch');
  assert.equal(manifest.registryCount, manifest.expectedTargetCount + 1, 'Registry count mismatch');
  assert.deepEqual(manifest.systems, [...manifest.systems].sort(compareIds), 'System order drift');
  const systemIds = manifest.systems.map((system) => system.id);
  assert.equal(new Set(systemIds).size, systemIds.length, 'Duplicate system ID');
  assert.ok(!systemIds.includes('sol'), 'Sol must not be a target');
  const bodyIds = manifest.systems.flatMap((system) => system.bodies.map((body) => body.id));
  assert.equal(new Set(bodyIds).size, bodyIds.length, 'Duplicate body ID');
  const exceptionIds = new Set(manifest.exceptions.map((exception) => exception.id));
  assert.equal(exceptionIds.size, manifest.exceptions.length, 'Duplicate exception ID');
  assert.equal(
    new Set(manifest.sourceFiles.map((file) => file.path)).size,
    manifest.sourceFiles.length,
    'Duplicate source file'
  );
  assert.deepEqual(
    manifest.inventory.counts,
    bodyCounts(manifest.systems.flatMap((system) => system.bodies)),
    'Body count mismatch'
  );
  for (const system of manifest.systems) {
    assertBodyReferences(system.bodies, system.id);
    assert.deepEqual(system.counts, bodyCounts(system.bodies), `Body count mismatch: ${system.id}`);
    assert.equal(
      new Set(system.markets.map((market) => market.id)).size,
      system.markets.length,
      `Duplicate market ID: ${system.id}`
    );
    for (const exceptionId of system.exceptionIds) {
      assert.ok(exceptionIds.has(exceptionId), `Unknown exception: ${exceptionId}`);
    }
    const profile = system.profile;
    if (profile.status === 'inherited-evidence') {
      const weight = manifest.namingPolicy.weights.find(
        (row) => row.id === profile.policyLanguageId
      );
      assert.ok(
        weight?.candidateLanguageLabels.includes(profile.language),
        `Invalid profile: ${system.id}`
      );
      assert.ok(
        profile.evidenceFile && profile.candidateId,
        `Missing profile evidence: ${system.id}`
      );
    } else {
      assert.deepEqual(
        profile,
        {
          status: 'unassigned',
          language: null,
          policyLanguageId: null,
          theme: null,
          evidenceFile: null,
          candidateId: null,
        },
        `Unassigned profile contains invented evidence: ${system.id}`
      );
    }
  }
  const unprofiled = manifest.systems
    .filter((system) => system.profile.status === 'unassigned')
    .map((system) => system.id);
  assert.deepEqual(manifest.namingPolicy.unprofiledSystemIds, unprofiled, 'Unprofiled scope drift');
  assert.deepEqual(
    manifest.namingPolicy.unprofiledQuotas,
    quotaRows(unprofiled.length, { languages: manifest.namingPolicy.weights }),
    'Quota drift'
  );
  assert.equal(
    manifest.inventory.existingNamedSystemCount,
    systemIds.length - unprofiled.length,
    'Named-system count drift'
  );
  for (const source of Object.keys(manifest.inventory.sourceCounts)) {
    assert.equal(
      manifest.inventory.sourceCounts[source],
      manifest.systems.filter((system) => system.source === source).length,
      'Source count drift'
    );
  }
  return true;
}

function assertCurrentBaseline(frozen, current) {
  validateManifest(frozen);
  validateManifest(current);
  const changedFiles = current.sourceFiles
    .filter(
      (file) =>
        !frozen.sourceFiles.some(
          (previous) => previous.path === file.path && previous.sha256 === file.sha256
        )
    )
    .map((file) => file.path);
  assert.equal(
    frozen.manifestSha256,
    current.manifestSha256,
    `Frozen baseline is stale. Changed source files: ${changedFiles.join(', ') || 'none; inspect manifest scope/output'}. Review source/scope changes; do not overwrite the approved baseline.`
  );
}

function assertPreservedBaseline(frozen, current) {
  validateManifest(frozen);
  validateManifest(current);
  const preserved = ({ sourceFiles, manifestSha256, ...content }) => content;
  assert.deepEqual(
    preserved(current),
    preserved(frozen),
    'Accepted P0 catalog scope, bodies, names, markets, ownership inventory or Sol output changed.'
  );
  return current.sourceFiles
    .filter(
      (file) =>
        !frozen.sourceFiles.some(
          (previous) => previous.path === file.path && previous.sha256 === file.sha256
        )
    )
    .map((file) => file.path);
}

function summarizeProgress(manifest) {
  validateManifest(manifest);
  const missingStations = manifest.systems
    .filter(
      (system) =>
        !system.markets.some((market) => market.siteType === 'station' && market.anchorResolved)
    )
    .map((system) => system.id);
  const missingAsteroids = manifest.systems
    .filter((system) => system.counts.asteroid === 0)
    .map((system) => system.id);
  const profiles = Object.fromEntries(
    manifest.namingPolicy.weights.map(({ id }) => [
      id,
      manifest.systems.filter((system) => system.profile.policyLanguageId === id).length,
    ])
  );
  return {
    schemaVersion: manifest.schemaVersion,
    manifestSha256: manifest.manifestSha256,
    targetSystems: manifest.expectedTargetCount,
    stages: {
      pending: manifest.expectedTargetCount,
      generated: 0,
      validated: 0,
      approved: 0,
      persisted: 0,
      verified: 0,
      blocked: 0,
      failed: 0,
    },
    verifiedPercent: 0,
    counts: manifest.inventory.counts,
    baselineNamedEligibleBodies: manifest.systems.reduce(
      (sum, system) =>
        sum + system.bodies.filter((body) => body.namingEligible && body.displayName.trim()).length,
      0
    ),
    baselineStationSystems: manifest.expectedTargetCount - missingStations.length,
    baselineAsteroidSystems: manifest.expectedTargetCount - missingAsteroids.length,
    playableMiningVerifiedSystems: 0,
    usableStationVerifiedSystems: 0,
    profiles,
    unprofiledSystems: manifest.namingPolicy.unprofiledSystemIds.length,
    profileQuotas: manifest.namingPolicy.unprofiledQuotas,
    bodyLanguageDistribution: 'not-assigned',
    unresolvedExceptions: manifest.exceptions,
    missingBaselineStations: missingStations,
    missingBaselineAsteroids: missingAsteroids,
    pendingCheckpoint:
      'Historical P0 snapshot; consult the implementation plan for phase acceptance and later checkpoints.',
    nextAction:
      'This snapshot records no new universe generation or deployment; all body rollout stages remain pending.',
  };
}

module.exports = {
  BASELINE_EPOCH,
  SCHEMA_VERSION,
  digest,
  buildManifest,
  validateManifest,
  assertCurrentBaseline,
  assertPreservedBaseline,
  summarizeProgress,
};
