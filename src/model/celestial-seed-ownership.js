'use strict';

const { assertUniverseMetadata } = require('./celestial-universe-metadata');
const { isDeepStrictEqual } = require('node:util');
const MUTABLE_BODY_FIELDS = Object.freeze([
  'state',
  'observability',
  'composition',
  'destroyedAt',
  'destroyedReason',
  'debrisSeed',
  'debris',
  'createdAt',
  'sourceScanId',
  'createdByCharacterId',
  'missionId',
  'missionInstanceId',
]);

function assertStableSeedIdentity(previous, incoming) {
  if (!previous) return;
  if (
    previous.id !== incoming.id ||
    previous.catalogId !== incoming.catalogId ||
    previous.spatial.solarSystemId !== incoming.spatial.solarSystemId
  ) {
    throw new Error('Seed update cannot change stable body/catalog/system identity');
  }
  const seedKey = previous.universeMetadata?.generation?.seedKey;
  if (seedKey && seedKey !== incoming.universeMetadata?.generation?.seedKey) {
    throw new Error('Seed update cannot change or remove the durable generation seedKey');
  }
}

function assertUniverseTransition(previous, incoming) {
  if (!previous?.universeMetadata) return;
  const before = previous.universeMetadata;
  const after = incoming.universeMetadata;
  if (
    !after ||
    (before.generation?.seedKey && before.generation.seedKey !== after.generation?.seedKey)
  ) {
    throw new Error('Universe update cannot remove metadata or change durable generation identity');
  }
  assertStableSeedIdentity(previous, incoming);
  if (
    before.naming?.lane === 'protected' &&
    (previous.displayName !== incoming.displayName ||
      !isDeepStrictEqual(before.naming, after.naming))
  ) {
    throw new Error('Universe update cannot rename a protected body');
  }
  if (
    before.lifecycle?.status === 'retired' &&
    !isDeepStrictEqual(before.lifecycle, after.lifecycle)
  ) {
    throw new Error(
      'Retirement history requires an explicitly approved rollback, not a normal upsert'
    );
  }
  if (before.lifecycle?.status !== 'retired' && after.lifecycle?.status === 'retired') {
    for (const field of MUTABLE_BODY_FIELDS) {
      if (!isDeepStrictEqual(previous[field], incoming[field])) {
        throw new Error(`Retirement cannot change gameplay history: ${field}`);
      }
    }
  }
}

function mergeCelestialSeed(previous, seed) {
  if (!previous) return seed;
  assertStableSeedIdentity(previous, seed);
  if (previous.isCatalogBody !== true) {
    throw new Error('Seed update cannot overwrite a player-created body');
  }
  const merged = { ...previous, ...seed };
  for (const field of MUTABLE_BODY_FIELDS) {
    if (Object.hasOwn(previous, field)) merged[field] = previous[field];
  }
  if (previous.catalogIdentity !== undefined) merged.catalogIdentity = previous.catalogIdentity;
  if (previous.universeMetadata) {
    merged.universeMetadata = { ...previous.universeMetadata, ...seed.universeMetadata };
    if (previous.universeMetadata.lifecycle) {
      merged.universeMetadata.lifecycle = previous.universeMetadata.lifecycle;
    }
    if (previous.universeMetadata.naming?.lane === 'protected') {
      merged.displayName = previous.displayName;
      merged.universeMetadata.naming = previous.universeMetadata.naming;
    }
  }
  assertUniverseMetadata(merged);
  return merged;
}

function seedMongoUpdate(body) {
  const set = {};
  const insert = {};
  for (const [field, value] of Object.entries(body)) {
    if (['_id', '__v'].includes(field)) continue;
    if (MUTABLE_BODY_FIELDS.includes(field)) {
      insert[field] = value;
    } else if (field === 'universeMetadata' && value) {
      for (const [key, entry] of Object.entries(value)) {
        (key === 'lifecycle' ? insert : set)[`universeMetadata.${key}`] = entry;
      }
    } else {
      set[field] = value;
    }
  }
  return { $set: set, $setOnInsert: insert };
}

function renameCelestialSeed(body, naming) {
  if (!body.universeMetadata || body.universeMetadata.naming?.lane === 'protected') {
    throw new Error('Name-only update requires universe metadata and an unprotected name');
  }
  const updated = {
    ...body,
    displayName: naming.preferredName,
    universeMetadata: { ...body.universeMetadata, naming: structuredClone(naming) },
  };
  assertUniverseMetadata(updated);
  return updated;
}

function initialSeedDiscovery(bodyType) {
  if (['star', 'black-hole', 'planet', 'dwarf-planet', 'moon', 'tno'].includes(bodyType)) {
    return { state: 'active', observability: { visibility: 'visible', scanState: 'scanned' } };
  }
  if (['asteroid', 'comet'].includes(bodyType)) {
    return { state: 'unscanned', observability: { visibility: 'visible', scanState: 'unscanned' } };
  }
  throw new Error(`Unsupported discovery bodyType: ${bodyType}`);
}

module.exports = {
  MUTABLE_BODY_FIELDS,
  assertStableSeedIdentity,
  assertUniverseTransition,
  mergeCelestialSeed,
  seedMongoUpdate,
  renameCelestialSeed,
  initialSeedDiscovery,
};
