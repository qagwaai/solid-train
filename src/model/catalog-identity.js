'use strict';

const Ajv = require('ajv');
const schema = require('../../api/schemas/catalog-identity.schema.json');
const validateIdentity = new Ajv({ allErrors: true }).compile(schema);

// Explicit curated source bindings, not an entity-id prefix or display-name heuristic.
const SOL_CATALOG_IDENTITIES = [
  ['sol-earth', 'earth', 'planet'],
  ['sol-luna', 'luna', 'moon'],
  ['sol-mars', 'mars', 'planet'],
  ['sol-mercury', 'mercury', 'planet'],
  ['sol-venus', 'venus', 'planet'],
  ['sol-io', 'io', 'moon'],
  ['sol-europa', 'europa', 'moon'],
  ['sol-ganymede', 'ganymede', 'moon'],
  ['sol-callisto', 'callisto', 'moon'],
  ['sol-titan', 'titan', 'moon'],
  ['sol-enceladus', 'enceladus', 'moon'],
  ['sol-tethys', 'tethys', 'moon'],
  ['sol-mimas', 'mimas', 'moon'],
  ['sol-dione', 'dione', 'moon'],
  ['sol-rhea', 'rhea', 'moon'],
  ['sol-iapetus', 'iapetus', 'moon'],
  ['sol-triton', 'triton', 'moon'],
  ['sol-pluto', 'pluto', 'dwarf-planet'],
  ['sol-charon', 'charon', 'moon'],
  ['sol-miranda', 'miranda', 'moon'],
  ['sol-ariel', 'ariel', 'moon'],
  ['sol-umbriel', 'umbriel', 'moon'],
  ['sol-titania', 'titania', 'moon'],
  ['sol-oberon', 'oberon', 'moon'],
].map(([catalogId, key, bodyType]) =>
  Object.freeze({ catalogId, bodyType, namespace: 'sol', key })
);

const byKey = new Map(SOL_CATALOG_IDENTITIES.map((entry) => [entry.key, entry]));
const byCatalogId = new Map(SOL_CATALOG_IDENTITIES.map((entry) => [entry.catalogId, entry]));

class CatalogIdentityError extends Error {}

function assertCatalogIdentity(body) {
  const identity = body.catalogIdentity;
  if (identity === undefined) return;
  if (!validateIdentity(identity)) {
    throw new CatalogIdentityError(
      `Invalid catalogIdentity: ${JSON.stringify(validateIdentity.errors)}`
    );
  }
  const registered = identity?.namespace === 'sol' ? byKey.get(identity.key) : null;
  if (
    registered &&
    (body.catalogId !== registered.catalogId ||
      body.bodyType !== registered.bodyType ||
      body.sourceScanId !== 'catalog' ||
      body.createdByCharacterId !== 'system-catalog')
  ) {
    throw new CatalogIdentityError(
      `catalogIdentity sol/${identity.key} requires curated source ${registered.catalogId} (${registered.bodyType})`
    );
  }
  const source = byCatalogId.get(body.catalogId);
  if (
    identity &&
    source &&
    body.sourceScanId === 'catalog' &&
    body.createdByCharacterId === 'system-catalog' &&
    (identity.namespace !== source.namespace || identity.key !== source.key)
  ) {
    throw new CatalogIdentityError(
      `Conflicting catalogIdentity for curated source ${body.catalogId}`
    );
  }
}

function assertCatalogIdentityAssignments(bodies) {
  const assignments = new Map();
  for (const body of bodies) {
    assertCatalogIdentity(body);
    if (!body.catalogIdentity) continue;
    const { namespace, key } = body.catalogIdentity;
    const scope = JSON.stringify([body.spatial.solarSystemId, namespace, key]);
    const existing = assignments.get(scope);
    if (existing && existing !== body.catalogId) {
      throw new CatalogIdentityError(
        `Duplicate catalogIdentity ${namespace}/${key} for distinct curated sources`
      );
    }
    assignments.set(scope, body.catalogId);
  }
}

module.exports = {
  SOL_CATALOG_IDENTITIES,
  CatalogIdentityError,
  assertCatalogIdentity,
  assertCatalogIdentityAssignments,
};
