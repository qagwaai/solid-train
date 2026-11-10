'use strict';

const { createHash } = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const manifest = require('../../data/copper-vale-body-naming-manifest-v1.json');
const systemManifest = require('../../data/system-naming-manifest.json');
const weightedReview = require('../../data/system-naming-weighted-batch-v1.json');
const languageBank = require('../../data/system-naming-review-bank-v1.json');
const languagePolicy = require('../../data/system-naming-weight-policy-v2.json');
const { previewCopperValeP3 } = require('./non-sol-p3-preview');
const { previewExpandedNonSolSystem } = require('./non-sol-expanded-augmentation');
const { assertUniverseRelationships } = require('./celestial-universe-metadata');
const { comparisonKeys, normalizeAlias, uniqueNames } = require('./system-naming');
const { getHamiltonQuotas } = require('./system-naming-weighted-allocation');
const { validateCelestialBody } = require('./celestial-body-validation');

const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

function isNamingEligible(body, minimumDiameterKm = 200, storyImportantBodyIds = []) {
  return (
    ['planet', 'dwarf-planet'].includes(body.bodyType) ||
    (body.bodyType === 'moon' && body.physicalCatalog.meanRadiusKm * 2 >= minimumDiameterKm) ||
    storyImportantBodyIds.includes(body.id)
  );
}

function assertCanonical(body) {
  if (!validateCelestialBody(body)) {
    throw new Error(
      `Invalid named body ${body.id}: ${JSON.stringify(validateCelestialBody.errors)}`
    );
  }
}

function assertNameLookup(bodies) {
  const owners = new Map();
  for (const body of bodies) {
    for (const name of [body.displayName, ...(body.universeMetadata?.naming?.aliases || [])]) {
      for (const key of comparisonKeys(name)) {
        const qualified = `${body.spatial.solarSystemId}:${key}`;
        if (owners.has(qualified) && owners.get(qualified) !== body.id)
          throw new Error(`Ambiguous system-qualified body name: ${name}`);
        owners.set(qualified, body.id);
      }
    }
  }
}

function resolveNamedBody(bodies, systemId, nameOrId) {
  if (
    typeof systemId !== 'string' ||
    !systemId.trim() ||
    typeof nameOrId !== 'string' ||
    !nameOrId.trim()
  )
    throw new Error('Body lookup requires an explicit system ID and body name/ID');
  assertNameLookup(bodies);
  const keys = comparisonKeys(nameOrId);
  const matches = bodies.filter(
    (body) =>
      body.spatial.solarSystemId === systemId &&
      (body.id === nameOrId ||
        [body.displayName, ...(body.universeMetadata?.naming?.aliases || [])].some((name) =>
          comparisonKeys(name).some((key) => keys.includes(key))
        ))
  );
  if (matches.length !== 1)
    throw new Error(`Body lookup must resolve exactly one body in ${systemId}: ${nameOrId}`);
  return matches[0];
}

function applyBodyNames(bodies, approvedManifest) {
  const eligible = bodies.filter((body) =>
    isNamingEligible(
      body,
      approvedManifest.eligibility.moonMinimumDiameterKm,
      approvedManifest.eligibility.storyImportantBodyIds
    )
  );
  if (
    !isDeepStrictEqual(
      eligible.map((body) => body.id).sort(),
      Object.keys(approvedManifest.assignments).sort()
    )
  )
    throw new Error('Frozen naming assignments do not match eligible body IDs');
  const result = bodies.map((body) => {
    const assignment = approvedManifest.assignments[body.id];
    if (!assignment) return structuredClone(body);
    const oldNaming = body.universeMetadata.naming;
    if (oldNaming.lane === 'protected') throw new Error('Cannot rename a protected body');
    const aliases = uniqueNames([body.displayName, ...oldNaming.aliases]).filter(
      (name) => normalizeAlias(name) !== normalizeAlias(assignment.preferredName)
    );
    const named = structuredClone(body);
    named.displayName = assignment.preferredName;
    named.universeMetadata.naming = {
      preferredName: assignment.preferredName,
      aliases,
      lane: assignment.lane,
      language: assignment.language,
      motivation: assignment.motivation,
      policyVersion: approvedManifest.version,
    };
    named.universeMetadata.provenance.fieldSources = [
      ...named.universeMetadata.provenance.fieldSources.filter(
        (entry) => !['displayName', 'universeMetadata.naming'].includes(entry.field)
      ),
      {
        field: 'displayName',
        derivation: 'authored',
        reference: approvedManifest.version,
        uncertainty: 'Owner-approved fictional name; language sketches remain provisional.',
      },
      {
        field: 'universeMetadata.naming',
        derivation: 'authored',
        reference: approvedManifest.version,
        uncertainty:
          'Editorial naming lanes/motivations, not demographic or astronomical evidence.',
      },
    ];
    assertCanonical(named);
    return named;
  });
  assertNameLookup(result);
  return result;
}

function assertManifestSources() {
  if (
    manifest.runtimeEnabled !== false ||
    manifest.approval.status !== 'owner-approved' ||
    manifest.systemId !== 'exo-gj-9066' ||
    manifest.eligibility.moonMinimumDiameterKm !== 200 ||
    manifest.eligibility.storyImportantBodyIds.length !== 0
  )
    throw new Error('Naming manifest differs from approved offline scope');
  const row = weightedReview.rows.find((entry) => entry.systemId === manifest.systemId);
  const assignment = systemManifest.approvedAssignments[manifest.systemId];
  if (
    !row ||
    assignment.status !== 'approved' ||
    row.candidateId !== assignment.candidateId ||
    assignment.candidateId !== manifest.profile.candidateId ||
    row.candidateLanguageTag !== manifest.profile.language ||
    hash({ assignment, row, bank: languageBank.multilingualProposals }) !==
      manifest.profileSourceSha256
  )
    throw new Error('Naming profile/source lineage changed; owner re-review required');
  for (const entry of Object.values(manifest.assignments)) {
    if (entry.language === 'English') continue;
    if (!('bankLanguage' in entry) || !('provisionalGloss' in entry))
      throw new Error('Non-English naming assignment requires explicit provisional bank evidence');
    const candidate = languageBank.multilingualProposals.find(
      (item) => item.name === entry.preferredName && item.language === entry.bankLanguage
    );
    if (!candidate || candidate.provisionalGloss !== entry.provisionalGloss)
      throw new Error('Provisional language-bank pairing changed');
  }
}

/** @param {{epoch?: string}} [options] */
function previewCopperValeP4(options = {}) {
  assertManifestSources();
  const fixedP3 = previewCopperValeP3({ epoch: manifest.epoch });
  if (fixedP3.outputSha256 !== manifest.p3InputSha256)
    throw new Error('Accepted P3 naming baseline changed; owner re-review required');
  const p3 = previewCopperValeP3(options);
  const generatedBodies = applyBodyNames(p3.generatedBodies, manifest);
  const bodies = [...p3.baseBodies, ...generatedBodies];
  assertUniverseRelationships(bodies);
  assertNameLookup(bodies);
  const station = structuredClone(p3.station);
  station.trajectory.orbit.anchorBodyName = resolveNamedBody(
    bodies,
    p3.systemId,
    station.trajectory.orbit.anchorBodyId
  ).displayName;
  const assignments = Object.entries(manifest.assignments).map(([bodyId, assignment]) => ({
    bodyId,
    ...assignment,
    editorialStatus: 'owner-approved-offline',
    linguisticStatus:
      assignment.language === 'English'
        ? 'original-editorial-no-certification'
        : 'unverified-sketch-owner-accepted',
    aliases: generatedBodies.find((body) => body.id === bodyId).universeMetadata.naming.aliases,
  }));
  const counts = {
    cultural: assignments.length,
    inherited: assignments.filter((entry) => entry.lane === 'inherited').length,
    narrative: assignments.filter((entry) => entry.lane === 'narrative').length,
    systematic: generatedBodies.length - assignments.length,
    protectedExisting: p3.baseBodies.length,
    languages: {},
  };
  for (const entry of assignments)
    counts.languages[entry.language] = (counts.languages[entry.language] || 0) + 1;
  if (
    counts.inherited !== manifest.eligibility.inherited ||
    counts.narrative !== manifest.eligibility.narrative
  )
    throw new Error('Naming lane quotas changed');
  for (const quota of getHamiltonQuotas(counts.narrative, languagePolicy)) {
    if (
      assignments.filter((entry) => entry.lane === 'narrative' && entry.language === quota.language)
        .length !== quota.quota
    )
      throw new Error(`Narrative language quota mismatch: ${quota.language}`);
  }
  const unchangedSystems = ['alpha-centauri', 'barnards-star', 'cygnus-x1', 'exo-hr-8799'].map(
    (systemId) => {
      const preview = previewExpandedNonSolSystem(systemId, { epoch: p3.epoch });
      return {
        systemId,
        status: preview.status,
        baseBodyCount: preview.baseBodies.length,
        generatedBodyCount: preview.generatedBodies.length,
        outputSha256: preview.outputSha256,
        exclusionCodes: preview.exclusions.map((entry) => entry.code),
        namingChanged: false,
      };
    }
  );
  const result = {
    schemaVersion: 'copper-vale-p4-preview-v1',
    systemId: p3.systemId,
    epoch: p3.epoch,
    runtimeEnabled: false,
    databaseWrites: false,
    manifestSha256: hash(manifest),
    p3InputSha256: p3.outputSha256,
    profile: manifest.profile,
    approval: manifest.approval,
    baseBodies: p3.baseBodies,
    generatedBodies,
    station,
    assignments,
    counts,
    unchangedSystems,
  };
  return { ...result, outputSha256: hash(result) };
}

function validateP4Preview(preview) {
  if (!isDeepStrictEqual(preview, previewCopperValeP4({ epoch: preview.epoch })))
    throw new Error('P4 preview differs from approved deterministic replay');
  return true;
}

module.exports = {
  previewCopperValeP4,
  validateP4Preview,
  applyBodyNames,
  isNamingEligible,
  resolveNamedBody,
  assertNameLookup,
};
