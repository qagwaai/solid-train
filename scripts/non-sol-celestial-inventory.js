'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { getSolarSystemRegistry } = require('../src/model/solar-system-registry');
const {
  buildSeededCelestialBodiesForSolarSystem,
  getSolarSystemCelestialSeedVersion,
} = require('../src/model/solar-system-celestial-seed');
const { buildSeededMarketsForSolarSystem } = require('../src/model/solar-system-market-seed');
const { getSourceEvidence, getSystemNamingManifest } = require('../src/model/system-naming');
const { ALL_ITEMS, craftableItems, rawMaterials } = require('../src/model/canonical-items');
const { MARKET_CATALOG } = require('../src/model/market-catalog');
const { LaunchItemMessageHandler } = require('../src/handlers/launch-item-message-handler');
const {
  BASELINE_EPOCH,
  buildManifest,
  validateManifest,
  assertCurrentBaseline,
  assertPreservedBaseline,
  summarizeProgress,
} = require('./lib/non-sol-celestial-manifest');

const ROOT = path.join(__dirname, '..');
const DEFAULT_MANIFEST = path.join(ROOT, 'data', 'non-sol-celestial-generation-manifest-v1.json');
const POLICY = require('../data/system-naming-weight-policy-v2.json');
const AUDITS = [
  { file: 'system-naming-weighted-batch-v1.json', rows: 'rows', name: 'proposedSettlementName' },
  {
    file: 'system-naming-full-catalog-review-v1.json',
    rows: 'reviewProposals',
    name: 'proposedSettlementName',
  },
  { file: 'system-naming-finalization-v1.json', rows: 'rows', name: 'name' },
];
// The accepted P0 manifest stores evidence paths with Windows separators on every platform.
const SOURCE_PATHS = [
  ...[
    'hyg-fixture.csv',
    'sol-comets.json',
    'sol-satellites.json',
    'exoplanet-systems.json',
    'exoplanet-hosts.json',
    'exoplanet-hyg-stars.json',
    'exoplanet-planets.json',
    'exoplanet-names.json',
    'exoplanet-overrides.json',
    'exoplanet-references.json',
    'system-naming-manifest.json',
    'system-naming-weight-policy-v2.json',
    ...AUDITS.map((audit) => audit.file),
  ].map((file) => path.win32.join('data', file)),
  ...[
    'solar-system-registry.js',
    'solar-system-celestial-seed.js',
    'solar-system-market-seed.js',
    'sol-system-catalog.js',
    'alpha-centauri-system-catalog.js',
    'cygnus-x1-system-catalog.js',
    'exoplanet-catalog.js',
    'exoplanet-system-generator.js',
    'exoplanet-star-facts.js',
    'hyg-star-catalog.js',
    'star-catalog.js',
    'catalog-identity.js',
    'procedural-system-generator.js',
    'system-naming.js',
    'system-naming-weighted-allocation.js',
    'canonical-items.js',
    'canonical-item-type-registry.js',
    'market-catalog.js',
    'celestial-body-upsert.js',
  ].map((file) => path.win32.join('src', 'model', file)),
  path.win32.join('src', 'handlers', 'launch-item-message-handler.js'),
  path.win32.join('src', 'handlers', 'context', 'celestial-operations-service.js'),
  path.win32.join('src', 'handlers', 'context', 'market-service.js'),
  path.win32.join('src', 'db', 'service', 'celestial-write-service.js'),
  path.win32.join('docs', 'Stellar notes.md'),
].sort();
const OWNERSHIP = [
  {
    domain: 'celestial-bodies',
    seedOwnedFields: [
      'id',
      'catalogId',
      'catalogIdentity',
      'bodyType',
      'surfaceArchetype',
      'displayName',
      'parentBodyId',
      'orbitalElements',
      'physicalCatalog',
      'rings',
    ],
    mutableFields: [
      'state',
      'observability',
      'destroyedAt',
      'destroyedReason',
      'debrisSeed',
      'debris',
      'createdAt',
      'updatedAt',
      'missionId',
      'missionInstanceId',
      'createdByCharacterId',
    ],
    currentBehavior:
      'A version change upserts complete canonical seeds, including active state and empty debris; this is not mutable-state-safe reseeding.',
    requiredSafeguard:
      'P1 must separate seed-owned updates from discovery/destruction/depletion and player-created body state before P6 writes.',
    evidenceFile: path.win32.join('src', 'handlers', 'context', 'celestial-operations-service.js'),
  },
  {
    domain: 'markets-and-stations',
    seedOwnedFields: [
      'marketId',
      'solarSystemId',
      'marketName',
      'siteType',
      'siteName',
      'trajectory',
    ],
    mutableFields: ['inventory', 'lastRestockAt', 'transactions', 'spatial'],
    currentBehavior:
      'Existing markets require explicit force repair; repair materializes seeded trajectory/spatial while retaining existing economy fields.',
    requiredSafeguard:
      'Preserve inventory, trades, prices and station IDs; derive spatial snapshots through supported trajectory math.',
    evidenceFile: path.win32.join('src', 'handlers', 'context', 'market-service.js'),
  },
  {
    domain: 'items-and-character-progression',
    seedOwnedFields: ['itemType', 'craftingRequirements', 'dependentItems'],
    mutableFields: [
      'quantity',
      'state',
      'container',
      'damageStatus',
      'missions',
      'ships',
      'inventory',
    ],
    currentBehavior:
      'Mining consumes an expendable dart, creates canonical yield items and destroys the target; catalog recipe tiers are provisional progression inputs.',
    requiredSafeguard:
      'Universe reseeding must not recreate consumed items or reset character missions, inventory or destroyed asteroid state.',
    evidenceFile: path.win32.join('src', 'handlers', 'launch-item-message-handler.js'),
  },
];

function sourceFiles() {
  return SOURCE_PATHS.map((relative) => ({
    path: relative,
    sha256: createHash('sha256')
      .update(fs.readFileSync(path.join(ROOT, ...relative.split('\\'))))
      .digest('hex'),
  }));
}

function collectProfiles(manifest = getSystemNamingManifest()) {
  const profiles = new Map();
  for (const audit of AUDITS) {
    const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', audit.file), 'utf8'));
    for (const row of data[audit.rows]) {
      const assignment = manifest.approvedAssignments[row.systemId];
      if (
        assignment?.candidateId !== row.candidateId ||
        assignment?.settlementName !== row[audit.name]
      ) {
        continue;
      }
      const language = row.language ?? row.candidateLanguage ?? row.candidateLanguageTag;
      const policyLanguageId = row.policyLanguageId;
      assert.ok(
        POLICY.languages
          .find((bucket) => bucket.id === policyLanguageId)
          ?.candidateLanguageLabels.includes(language),
        `Missing explicit language evidence: ${row.systemId}`
      );
      profiles.set(row.systemId, {
        status: 'inherited-evidence',
        language,
        policyLanguageId,
        theme: row.gloss ?? row.provisionalGloss ?? row.candidateLane ?? row.namingLane ?? null,
        evidenceFile: path.win32.join('data', audit.file),
        candidateId: row.candidateId,
      });
    }
  }
  for (const id of Object.keys(manifest.approvedAssignments)) {
    assert.ok(profiles.has(id), `Approved assignment has no exact language evidence: ${id}`);
  }
  return profiles;
}

function collectResources() {
  const handler = new LaunchItemMessageHandler({
    toNonEmptyString: (value) => (typeof value === 'string' ? value.trim() : ''),
  });
  const materials = rawMaterials.map((item) => {
    const market = MARKET_CATALOG.find((entry) => entry.itemId === item.itemType);
    return {
      itemType: item.itemType,
      displayName: item.displayName,
      tier: item.tier,
      rarity: item.rarity,
      yieldItemType: handler.resolveYieldItemType(item.displayName),
      marketCanBuy: market?.marketCanBuy ?? false,
      marketCanSell: market?.marketCanSell ?? false,
      miningRequirement: item.miningRequirement,
      typicalLocation: item.typicalLocation,
      scientificStatus:
        item.itemType === 'unobtainium' ? 'fictional' : 'not-scientifically-calibrated',
    };
  });
  const crafting = craftableItems.map((item) => ({
    itemType: item.itemType,
    displayName: item.displayName,
    tier: item.tier,
    category: item.category,
    requirements: item.craftingRequirements.map((requirement) => ({
      ...requirement,
      resolvedItemType: handler.resolveYieldItemType(requirement.material),
    })),
    dependentItems: item.dependentItems.map((itemType) => ({
      itemType,
      resolved: ALL_ITEMS.some((candidate) => candidate.itemType === itemType),
    })),
    fabrication: item.fabrication ?? null,
  }));
  const notes = fs.readFileSync(path.join(ROOT, 'docs', 'Stellar notes.md'), 'utf8');
  const firstHierarchy = notes.split('### **Fleet Strategy Tips**')[0];
  const proposedLevels = [...firstHierarchy.matchAll(/^\|\s*(\d+)\s*\|\s*\*\*(.*?)\*\*/gm)].map(
    (match) => ({
      level: Number(match[1]),
      label: match[2],
      canonicalItemTypes: ALL_ITEMS.filter(
        (item) => item.displayName.toLowerCase() === match[2].toLowerCase()
      ).map((item) => item.itemType),
    })
  );
  assert.equal(proposedLevels.length, 50, 'Provisional first 50-level hierarchy was not found');
  const unresolvedRequirements = crafting.flatMap((item) =>
    item.requirements
      .filter((requirement) => !requirement.resolvedItemType)
      .map((requirement) => ({ itemType: item.itemType, material: requirement.material }))
  );
  const unresolvedDependencies = crafting.flatMap((item) =>
    item.dependentItems
      .filter((dependency) => !dependency.resolved)
      .map((dependency) => ({ itemType: item.itemType, dependency: dependency.itemType }))
  );
  return {
    authority: 'backend (Forge); Nova consumes the completed definition',
    status: 'existing-catalog-inventory-not-a-final-tech-tree',
    materials,
    crafting,
    techNotes: {
      path: path.win32.join('docs', 'Stellar notes.md'),
      status: 'provisional-design-not-runtime-unlocks',
      selection:
        'First 50-level Drone-Logic hierarchy; later variants remain source notes, not adopted rules.',
      proposedLevels,
    },
    mining: {
      evidenceFile: path.win32.join('src', 'handlers', 'launch-item-message-handler.js'),
      executableItemType: 'expendable-dart-drone',
      materialResolution: 'Existing resolveYieldItemType method; no new aliases introduced.',
      playableChainVerified: false,
    },
    unresolvedRequirements,
    unresolvedDependencies,
    gaps: [
      {
        id: 'tech-tree-provisional',
        blockingPhase: 'P4',
        reason:
          'Notes contain alternative hierarchies; backend catalog IDs exist, but no final research/unlock graph is adopted. Forge must define it before binding story/tech gates.',
      },
      ...(unresolvedRequirements.length || unresolvedDependencies.length
        ? [
            {
              id: 'crafting-reference-gaps',
              blockingPhase: 'P3',
              reason: `${unresolvedRequirements.length} recipe material references and ${unresolvedDependencies.length} dependency IDs need explicit reconciliation before resource-to-tech binding; existing recipes are unchanged.`,
            },
          ]
        : []),
      {
        id: 'resource-science-calibration',
        blockingPhase: 'P2',
        reason:
          'Market typical-location and mining-requirement labels are game-grade inputs, not a scientifically calibrated abundance or executable equipment-gate model.',
      },
    ],
  };
}

function buildCurrentManifest() {
  return buildManifest({
    registry: getSolarSystemRegistry(),
    getBodies: (id) => buildSeededCelestialBodiesForSolarSystem(id, BASELINE_EPOCH),
    getMarkets: (id) => buildSeededMarketsForSolarSystem(id, BASELINE_EPOCH),
    getSeedVersion: getSolarSystemCelestialSeedVersion,
    getSourceEvidence,
    sourceFiles: sourceFiles(),
    profiles: collectProfiles(),
    policy: POLICY,
    existingPlanetNameOverrides: Object.keys(require('../data/exoplanet-names.json').planets)
      .length,
    resources: collectResources(),
    ownership: OWNERSHIP,
  });
}

function writeManifest(file, manifest) {
  validateManifest(manifest);
  if (fs.existsSync(file)) {
    assertCurrentBaseline(JSON.parse(fs.readFileSync(file, 'utf8')), manifest);
    return false;
  }
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
    // Exclusive publication cannot overwrite a baseline created by another process.
    fs.linkSync(temporary, file);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
  return true;
}

function parseArgs(args) {
  const options = { mode: '--progress', file: DEFAULT_MANIFEST, systemId: null, json: false };
  let modeSet = false;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (['--write', '--check', '--check-preservation', '--progress'].includes(arg)) {
      assert.ok(!modeSet, 'Choose only one of --write, --check, --check-preservation, --progress');
      options.mode = arg;
      modeSet = true;
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--manifest' || arg === '--system') {
      const value = args[++index];
      assert.ok(value && !value.startsWith('--'), `Missing value for ${arg}`);
      if (arg === '--manifest') options.file = path.resolve(value);
      else options.systemId = value;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  assert.ok(!options.systemId || options.mode === '--progress', '--system requires --progress');
  return options;
}

function renderProgress(progress) {
  return [
    `P0 frozen baseline: ${progress.targetSystems} non-Sol systems; Sol excluded.`,
    `Stages: pending=${progress.stages.pending}; generated=0; validated=0; approved=0; persisted=0; verified=0 (0%).`,
    `Baseline: ${progress.counts.star} stars, ${progress.counts.planet} planets, ${progress.counts['black-hole']} black hole(s), ${progress.counts.rings} ringed bodies.`,
    `Baseline station systems=${progress.baselineStationSystems}; asteroid systems=${progress.baselineAsteroidSystems}. Neither is a playable/persistent verification.`,
    `Profiles: ${progress.targetSystems - progress.unprofiledSystems} inherited; ${progress.unprofiledSystems} unassigned. Naming target: 60% inherited / 40% narrative.`,
    `Open exceptions=${progress.unresolvedExceptions.length}; tech-tree and recipe gaps are recorded, not repaired.`,
    `Manifest SHA-256: ${progress.manifestSha256}`,
    progress.pendingCheckpoint,
    progress.nextAction,
  ].join('\n');
}

function main(args = process.argv.slice(2)) {
  const options = parseArgs(args);
  const current = buildCurrentManifest();
  let reportManifest = current;
  if (options.mode === '--write') {
    const created = writeManifest(options.file, current);
    console.log(`${created ? 'Created' : 'Unchanged'} offline P0 manifest: ${options.file}`);
  } else {
    const frozen = JSON.parse(fs.readFileSync(options.file, 'utf8'));
    reportManifest = frozen;
    const changedSources =
      options.mode === '--check'
        ? (assertCurrentBaseline(frozen, current), [])
        : assertPreservedBaseline(frozen, current);
    if (options.mode === '--check' || options.mode === '--check-preservation') {
      console.log(
        `PASS: accepted P0 IDs, names, bodies, markets and Sol output are preserved (${frozen.expectedTargetCount} targets).`
      );
      if (changedSources.length) {
        console.log(
          `Historical source-file changes (not rewritten into P0): ${changedSources.join(', ')}`
        );
      }
      return;
    }
    if (options.systemId) {
      const system = frozen.systems.find((entry) => entry.id === options.systemId);
      assert.ok(system, `Unknown non-Sol system: ${options.systemId}`);
      console.log(JSON.stringify(system, null, 2));
      return;
    }
  }
  const progress = summarizeProgress(reportManifest);
  console.log(options.json ? JSON.stringify(progress, null, 2) : renderProgress(progress));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`[non-sol-celestial-inventory] ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  buildCurrentManifest,
  collectProfiles,
  collectResources,
  writeManifest,
  parseArgs,
  renderProgress,
  main,
};
