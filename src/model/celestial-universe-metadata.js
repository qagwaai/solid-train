'use strict';

const { createHash } = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const { createSchemaValidator } = require('./schema-validator');
const { rawMaterials } = require('./canonical-items');
const { normalizeAlias } = require('./system-naming');
const schema = require('../../api/schemas/celestial-universe-metadata.schema.json');
/**
 * @typedef {Object} UniverseMetadata
 * @property {'non-sol-universe-v1'} schemaVersion
 * @property {{origin: 'catalog'|'hypothetical'|'gameplay-exception', sourceReferences: string[], fieldSources: Array<{field: string, derivation: 'observed'|'estimated'|'seeded'|'authored', reference: string|null, uncertainty?: string|null}>, rationale?: string|null}} provenance
 * @property {{generatorVersion: string, seedKey: string, sourceSha256: string}|null} [generation]
 * @property {{preferredName: string, aliases: string[], lane: 'protected'|'systematic'|'inherited'|'narrative', language: string|null, motivation: string|null, policyVersion: string}|null} [naming]
 * @property {{status: 'active'|'retired', retiredAt: string|null, reason: string|null}|null} [lifecycle]
 * @property {{materialItemTypes: string[], abundance: 'sparse'|'moderate'|'rich', accessibility: 'accessible'|'difficult'|'hazardous', policyVersion: string}|null} [resourceProfile]
 * @property {{id: string, kind: 'asteroid-belt'|'trojan'|'scattered-asteroids'|'comet-reservoir', hostBodyId: string, abundance: 'sparse'|'moderate'|'rich', estimatedTotalCount: number|null, policyVersion: string}|null} [population]
 */
/** @type {import('ajv').ValidateFunction<UniverseMetadata>} */
const validate = createSchemaValidator({ allErrors: true, strictNumbers: true }).compile(schema);
const materialTypes = new Set(rawMaterials.map((item) => item.itemType));

function assertUniverseMetadata(body) {
  const metadata = body.universeMetadata;
  if (metadata === undefined || metadata === null) return;
  if (!validate(metadata)) {
    throw new Error(`Celestial universe metadata invalid: ${JSON.stringify(validate.errors)}`);
  }
  const provenance = metadata.provenance;
  if (provenance.origin !== 'catalog' && (!metadata.generation || !provenance.rationale?.trim())) {
    throw new Error(
      'Hypothetical/gameplay bodies require generation identity and explicit rationale'
    );
  }
  const paths = provenance.fieldSources.map((entry) => entry.field);
  if (new Set(paths).size !== paths.length) {
    throw new Error('Provenance fieldSources contain duplicate field paths');
  }
  if (
    provenance.fieldSources.some((entry) => entry.derivation === 'observed' && !entry.reference)
  ) {
    throw new Error('Observed field sources require a reference');
  }
  const naming = metadata.naming;
  if (naming) {
    if (body.displayName !== naming.preferredName) {
      throw new Error('displayName must equal universeMetadata.naming.preferredName');
    }
    const aliases = naming.aliases.map(normalizeAlias);
    if (
      new Set(aliases).size !== aliases.length ||
      aliases.includes(normalizeAlias(naming.preferredName))
    ) {
      throw new Error('Naming aliases must be distinct and must not duplicate the preferred name');
    }
    if (
      ['inherited', 'narrative'].includes(naming.lane) &&
      (!naming.language || !naming.motivation)
    ) {
      throw new Error('Cultural names require explicit language and motivation');
    }
  }
  if (
    metadata.lifecycle?.status === 'retired' &&
    (provenance.origin === 'catalog' || !metadata.generation || body.isCatalogBody !== true)
  ) {
    throw new Error('Only generated seed-owned non-catalog bodies may be retired');
  }
  if (metadata.resourceProfile?.materialItemTypes.some((type) => !materialTypes.has(type))) {
    throw new Error('Resource profile must use canonical raw-material item types');
  }
  if (
    metadata.population &&
    (metadata.population.kind === 'comet-reservoir'
      ? body.bodyType !== 'comet'
      : body.bodyType !== 'asteroid')
  ) {
    throw new Error('Population representatives must have the matching asteroid/comet bodyType');
  }
}

function pickUniverseMetadata(body) {
  assertUniverseMetadata(body);
  return body.universeMetadata === undefined
    ? {}
    : {
        universeMetadata:
          body.universeMetadata === null ? null : structuredClone(body.universeMetadata),
      };
}

function assertUniverseRelationships(bodies) {
  const byId = new Map();
  const populations = new Map();
  const names = new Map();
  for (const body of bodies) {
    assertUniverseMetadata(body);
    if (byId.has(body.id)) throw new Error(`Duplicate universe body ID: ${body.id}`);
    byId.set(body.id, body);
    const name = body.universeMetadata?.naming;
    if (name || body.displayName) {
      for (const label of name ? [name.preferredName, ...name.aliases] : [body.displayName]) {
        const key = `${body.spatial.solarSystemId}:${normalizeAlias(label)}`;
        if (names.has(key) && names.get(key).id !== body.id && (name || names.get(key).annotated)) {
          throw new Error(`Body name/alias collision: ${label}`);
        }
        names.set(key, { id: body.id, annotated: Boolean(name) });
      }
    }
  }
  for (const body of bodies) {
    const population = body.universeMetadata?.population;
    if (!population) continue;
    const host = byId.get(population.hostBodyId);
    if (!host || host.spatial.solarSystemId !== body.spatial.solarSystemId || host.id === body.id) {
      throw new Error(`Unresolved population host: ${population.hostBodyId}`);
    }
    const key = `${body.spatial.solarSystemId}:${population.id}`;
    if (populations.has(key) && !isDeepStrictEqual(populations.get(key), population)) {
      throw new Error(`Inconsistent population descriptor: ${population.id}`);
    }
    populations.set(key, population);
  }
}

function generatedBodyId({ solarSystemId, parentBodyId, bodyType, slot }) {
  for (const value of [solarSystemId, parentBodyId, bodyType, slot]) {
    if (typeof value !== 'string' || !value.trim() || value !== value.trim()) {
      throw new Error(
        'Generated identity requires canonical system, parent, bodyType and stable slot'
      );
    }
  }
  if (
    !['planet', 'dwarf-planet', 'moon', 'asteroid', 'comet', 'tno'].includes(bodyType) ||
    solarSystemId === 'sol' ||
    !/^[a-z0-9-]+$/.test(solarSystemId)
  ) {
    throw new Error('Unsupported generated non-Sol identity');
  }
  const key = createHash('sha256')
    .update(JSON.stringify([solarSystemId, parentBodyId, bodyType, slot]))
    .digest('hex')
    .slice(0, 24);
  return `${solarSystemId}-generated-${bodyType}-${key}`;
}

module.exports = {
  assertUniverseMetadata,
  pickUniverseMetadata,
  assertUniverseRelationships,
  generatedBodyId,
};
