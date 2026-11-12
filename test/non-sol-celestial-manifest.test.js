'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const {
  BASELINE_EPOCH,
  digest,
  buildManifest,
  validateManifest,
  assertCurrentBaseline,
  assertPreservedBaseline,
  summarizeProgress,
} = require('../scripts/lib/non-sol-celestial-manifest');
const {
  buildCurrentManifest,
  collectResources,
  writeManifest,
  parseArgs,
  renderProgress,
} = require('../scripts/non-sol-celestial-inventory');

function inputs() {
  const bodies = {
    sol: [{ id: 'sun', bodyType: 'star', surfaceArchetype: 'star', displayName: 'Sun' }],
    alpha: [
      { id: 'alpha-star', bodyType: 'star', surfaceArchetype: 'star', displayName: 'Alpha' },
      {
        id: 'alpha-planet',
        parentBodyId: 'alpha-star',
        bodyType: 'planet',
        surfaceArchetype: 'rocky',
        displayName: 'Alpha I',
        rings: { innerRadiusKm: 5000 },
      },
      ...[199.999, 200, 200.001].map((diameter, index) => ({
        id: `alpha-moon-${index}`,
        parentBodyId: 'alpha-planet',
        bodyType: 'moon',
        surfaceArchetype: 'rocky-moon',
        displayName: `Moon ${index}`,
        physical: { estimatedDiameterM: diameter * 1000 },
      })),
    ],
  };
  return {
    registry: [
      { id: 'alpha', source: 'procedural', displayName: 'Alpha' },
      { id: 'sol', source: 'curated', displayName: 'Sol' },
    ],
    getBodies: (id) => bodies[id],
    getMarkets: (id) =>
      id === 'alpha'
        ? [
            {
              marketId: 'alpha-market',
              siteType: 'station',
              marketName: 'Alpha station',
              trajectory: { kind: 'orbital-elements', orbit: { anchorBodyId: 'alpha-planet' } },
            },
          ]
        : [],
    getSeedVersion: () => 'test-v1',
    getSourceEvidence: () => null,
    sourceFiles: [{ path: 'test-fixture', sha256: digest(bodies) }],
    profiles: new Map(),
    policy: {
      policyVersion: 'test-v1',
      languages: [
        { id: 'english', language: 'English', weight: 60, candidateLanguageLabels: ['English'] },
        { id: 'russian', language: 'Russian', weight: 40, candidateLanguageLabels: ['Russian'] },
      ],
    },
    existingPlanetNameOverrides: 0,
    resources: {
      authority: 'fixture',
      status: 'existing-catalog-inventory-not-a-final-tech-tree',
      materials: [],
      crafting: [],
      techNotes: {
        path: 'fixture',
        status: 'provisional-design-not-runtime-unlocks',
        selection: 'fixture',
        proposedLevels: [],
      },
      mining: {
        evidenceFile: 'fixture',
        executableItemType: 'fixture',
        materialResolution: 'fixture',
        playableChainVerified: false,
      },
      unresolvedRequirements: [],
      unresolvedDependencies: [],
      gaps: [],
    },
    ownership: [
      {
        domain: 'fixture',
        seedOwnedFields: ['id'],
        mutableFields: ['state'],
        currentBehavior: 'fixture',
        requiredSafeguard: 'preserve state',
        evidenceFile: 'fixture',
      },
    ],
  };
}

function reseal(manifest) {
  const { manifestSha256, ...content } = manifest;
  return { ...content, manifestSha256: digest(content) };
}

test('P0 is deterministic, ordered, pending and isolates Sol from the target scope', () => {
  const source = inputs();
  const manifest = buildManifest(source);
  assert.deepEqual(
    buildManifest({ ...source, registry: [...source.registry].reverse() }),
    manifest
  );
  assert.equal(manifest.baselineEpoch, BASELINE_EPOCH);
  assert.equal(manifest.expectedTargetCount, 1);
  assert.equal(manifest.protectedBaseline.bodyCount, 1);
  assert.equal(manifest.systems[0].stage, 'pending');
  assert.equal(manifest.systems[0].generatedOutputSha256, null);
  assert.equal(manifest.runtimeEnabled, false);
  assert.deepEqual(manifest.approvals, {
    implementation: 'p0-authorized',
    checkpoint: null,
    pilot: null,
    bulk: null,
  });
  assert.deepEqual(
    manifest.systems[0].bodies
      .filter((body) => body.bodyType === 'moon')
      .map((body) => body.namingEligible),
    [false, true, true]
  );
  assert.equal(
    manifest.systems[0].bodies.find((body) => body.id === 'alpha-planet').displayName,
    'Alpha I'
  );
  assert.equal(validateManifest(manifest), true);
});

test('missing, duplicated and cyclic baseline identities are explicit failures', () => {
  const source = inputs();
  assert.throws(
    () => buildManifest({ ...source, registry: source.registry.concat(source.registry[0]) }),
    /Duplicate system ID/
  );
  assert.throws(() => buildManifest({ ...source, getBodies: () => [] }), /Missing baseline/);
  for (const bodies of [
    [{ id: 'duplicate' }, { id: 'duplicate' }],
    [{ id: 'orphan', parentBodyId: 'absent' }],
    [{ id: 'orbital-orphan', orbitalElements: { anchorBodyId: 'absent' } }],
    [{ id: 'binary-orphan', circumbinaryStarIds: ['absent'] }],
    [
      { id: 'a', parentBodyId: 'b' },
      { id: 'b', parentBodyId: 'a' },
    ],
  ]) {
    assert.throws(
      () => buildManifest({ ...source, getBodies: () => bodies }),
      /Duplicate or missing body ID|Orphan parent|Orphan orbital reference|Parent cycle/
    );
  }
  assert.throws(
    () =>
      buildManifest({
        ...source,
        registry: source.registry.filter((system) => system.id !== 'sol'),
      }),
    /Sol baseline/
  );
});

test('schema and semantic validation reject fake completion, tampering and inconsistent quotas', () => {
  const manifest = buildManifest(inputs());
  const tampered = structuredClone(manifest);
  tampered.systems[0].displayName = 'Changed';
  assert.throws(() => validateManifest(tampered), /digest mismatch/);
  for (const mutate of [
    (m) => {
      m.systems[0].stage = 'verified';
    },
    (m) => {
      m.approvals.bulk = 'invented';
    },
    (m) => {
      m.databaseWrites = 1;
    },
    (m) => {
      m.systems[0].unexpected = true;
    },
  ]) {
    const changed = structuredClone(manifest);
    mutate(changed);
    assert.throws(() => validateManifest(reseal(changed)), /schema invalid/);
  }
  const quotas = structuredClone(manifest);
  quotas.namingPolicy.unprofiledQuotas[0].quota = 0;
  assert.throws(() => validateManifest(reseal(quotas)), /Quota drift/);
  const count = structuredClone(manifest);
  count.inventory.counts.planet = 99;
  assert.throws(() => validateManifest(reseal(count)), /Body count mismatch/);
});

test('missing market anchors are recorded without fabricating canonical bodies or completion', () => {
  const source = inputs();
  const manifest = buildManifest({
    ...source,
    getMarkets: () => [
      {
        marketId: 'belt-market',
        siteType: 'free-floating',
        marketName: 'Belt',
        trajectory: { orbit: { anchorBodyId: 'unmodeled-belt' } },
      },
    ],
  });
  assert.equal(manifest.exceptions[0].id, 'baseline-anchor:belt-market');
  const progress = summarizeProgress(manifest);
  assert.equal(progress.verifiedPercent, 0);
  assert.equal(progress.baselineStationSystems, 0);
  assert.deepEqual(progress.missingBaselineAsteroids, ['alpha']);
  assert.equal(progress.playableMiningVerifiedSystems, 0);
  assert.match(renderProgress(progress), /Neither is a playable\/persistent verification/);
});

test('baseline publication is exclusive, idempotent and refuses stale overwrites', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'non-sol-manifest-'));
  const file = path.join(dir, 'manifest.json');
  try {
    const manifest = buildManifest(inputs());
    assert.equal(writeManifest(file, manifest), true);
    assert.equal(writeManifest(file, manifest), false);
    const changed = structuredClone(manifest);
    changed.systems[0].displayName = 'New label';
    const current = reseal(changed);
    assert.throws(() => assertCurrentBaseline(manifest, current), /stale/);
    assert.throws(() => writeManifest(file, current), /stale/);
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), manifest);
    assert.deepEqual(fs.readdirSync(dir), ['manifest.json']);
  } finally {
    if (fs.existsSync(file)) fs.unlinkSync(file);
    fs.rmdirSync(dir);
  }
});

test('historical preservation allows reported source-file changes but never changed body output', () => {
  const frozen = buildManifest(inputs());
  const changed = structuredClone(frozen);
  changed.sourceFiles[0].sha256 = 'a'.repeat(64);
  assert.deepEqual(assertPreservedBaseline(frozen, reseal(changed)), ['test-fixture']);
  changed.systems[0].bodies[0].displayName = 'Changed body';
  assert.throws(() => assertPreservedBaseline(frozen, reseal(changed)), /P0 catalog/);
});

test('CLI rejects unknown, conflicting and missing arguments before writes', () => {
  assert.equal(parseArgs([]).mode, '--progress');
  assert.equal(parseArgs(['--progress', '--system', 'alpha']).systemId, 'alpha');
  for (const args of [
    ['--wat'],
    ['--manifest'],
    ['--system', '--json'],
    ['--write', '--check'],
    ['--write', '--system', 'sol'],
  ])
    assert.throws(() => parseArgs(args));
});

test('actual CLI exposes existing system details and rejects unsupported targets without writes', () => {
  const script = path.join(__dirname, '..', 'scripts', 'non-sol-celestial-inventory.js');
  const detail = spawnSync(process.execPath, [script, '--progress', '--system', 'cygnus-x1'], {
    encoding: 'utf8',
  });
  assert.equal(detail.status, 0, detail.stderr);
  const system = JSON.parse(detail.stdout);
  assert.equal(system.id, 'cygnus-x1');
  assert.equal(system.stage, 'pending');
  assert.equal(system.bodies.length, 2);
  assert.equal(system.markets.length, 0);
  const unknown = spawnSync(process.execPath, [script, '--progress', '--system', 'sol'], {
    encoding: 'utf8',
  });
  assert.equal(unknown.status, 1);
  assert.match(unknown.stderr, /Unknown non-Sol system: sol/);
  const invalid = spawnSync(process.execPath, [script, '--write', '--bogus'], { encoding: 'utf8' });
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /Unknown argument/);
});

test('real baseline preserves all source outputs and audits authoritative provisional resources', () => {
  const manifest = buildCurrentManifest();
  assert.equal(manifest.expectedTargetCount, 4844);
  assert.equal(manifest.registryCount, 4845);
  assert.equal(manifest.inventory.counts.planet, 6456);
  assert.equal(manifest.inventory.counts.star, 5331);
  assert.equal(manifest.inventory.counts.asteroid, 0);
  assert.equal(manifest.inventory.existingNamedSystemCount, 4025);
  assert.equal(manifest.inventory.existingPlanetNameOverrides, 29);
  assert.equal(manifest.namingPolicy.unprofiledSystemIds.length, 819);
  const progress = summarizeProgress(manifest);
  assert.equal(progress.baselineStationSystems, 2);
  assert.equal(progress.stages.pending, 4844);
  assert.ok(manifest.sourceFiles.every((file) => !path.isAbsolute(file.path)));
  assert.ok(manifest.sourceFiles.every((file) => !file.path.includes('/')));
  assert.equal(manifest.resources.techNotes.path, 'docs\\Stellar notes.md');
  assert.equal(manifest.resources.mining.evidenceFile, 'src\\handlers\\launch-item-message-handler.js');
  assert.ok(manifest.ownership.every((entry) => entry.evidenceFile.includes('\\')));
  assert.ok(manifest.systems.filter((system) => system.profile.evidenceFile)
    .every((system) => system.profile.evidenceFile.startsWith('data\\')));
  assert.doesNotThrow(() =>
    assertPreservedBaseline(
      JSON.parse(
        fs.readFileSync(
          path.join(__dirname, '..', 'data', 'non-sol-celestial-generation-manifest-v1.json'),
          'utf8'
        )
      ),
      manifest
    )
  );
  const resources = collectResources();
  assert.equal(resources.materials.length, 22);
  assert.equal(resources.crafting.length, 36);
  assert.equal(resources.techNotes.proposedLevels.length, 50);
  assert.equal(
    resources.materials.filter((material) => material.marketCanBuy && material.marketCanSell)
      .length,
    21
  );
  assert.ok(resources.unresolvedRequirements.length > 0);
  assert.ok(resources.unresolvedDependencies.length > 0);
  assert.equal(
    resources.materials.find((material) => material.itemType === 'unobtainium').scientificStatus,
    'fictional'
  );
  assert.equal(
    resources.materials.find((material) => material.itemType === 'iron').yieldItemType,
    'iron'
  );
  assert.equal(resources.mining.playableChainVerified, false);
});
