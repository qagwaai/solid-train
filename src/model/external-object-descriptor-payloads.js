'use strict';

const {
  EXTERNAL_OBJECT_SCHEMA_VERSION,
  EXTERNAL_OBJECT_DOMAIN,
  EXTERNAL_OBJECT_FAMILY_BY_DOMAIN,
} = require('./external-object-descriptor');

const DEBRIS_DESCRIPTOR_SEED = Object.freeze({
  'salvage-fragment': Object.freeze({
    roleCue: 'salvage',
    factionCue: 'neutral',
    fallbackTier: 'standard',
    displayLabel: 'Salvage Fragment',
    silhouetteProfile: 'fragmented',
    materialProfile: 'scrap',
    emissiveProfile: 'low',
  }),
  'wreckage-panel': Object.freeze({
    roleCue: 'hazard',
    factionCue: 'unknown',
    fallbackTier: 'standard',
    displayLabel: 'Wreckage Panel',
    silhouetteProfile: 'broad',
    materialProfile: 'alloy',
    emissiveProfile: 'none',
  }),
  'cargo-canister': Object.freeze({
    roleCue: 'trade',
    factionCue: 'independent',
    fallbackTier: 'standard',
    displayLabel: 'Cargo Canister',
    silhouetteProfile: 'modular',
    materialProfile: 'composite',
    emissiveProfile: 'low',
  }),
  'field-shard': Object.freeze({
    roleCue: 'salvage',
    factionCue: 'unknown',
    fallbackTier: 'minimal',
    displayLabel: 'Field Shard',
    silhouetteProfile: 'irregular',
    materialProfile: 'metallic',
    emissiveProfile: 'none',
  }),
});

const ASTEROID_DESCRIPTOR_SEED = Object.freeze({
  'rocky-irregular': Object.freeze({
    roleCue: 'hazard',
    factionCue: 'neutral',
    fallbackTier: 'standard',
    displayLabel: 'Rocky Irregular Asteroid',
    silhouetteProfile: 'irregular',
    materialProfile: 'rocky',
    emissiveProfile: 'none',
  }),
  'metallic-cluster': Object.freeze({
    roleCue: 'industrial',
    factionCue: 'neutral',
    fallbackTier: 'standard',
    displayLabel: 'Metallic Cluster Asteroid',
    silhouetteProfile: 'clustered',
    materialProfile: 'metallic',
    emissiveProfile: 'low',
  }),
  'icy-body': Object.freeze({
    roleCue: 'hazard',
    factionCue: 'neutral',
    fallbackTier: 'minimal',
    displayLabel: 'Icy Body Asteroid',
    silhouetteProfile: 'broad',
    materialProfile: 'icy',
    emissiveProfile: 'low',
  }),
  'cinematic-hero': Object.freeze({
    roleCue: 'hazard',
    factionCue: 'unknown',
    fallbackTier: 'hero',
    displayLabel: 'Cinematic Hero Asteroid',
    silhouetteProfile: 'spire',
    materialProfile: 'rocky',
    emissiveProfile: 'medium',
  }),
});

const ASTEROID_STYLE_BAND_BY_FAMILY = Object.freeze({
  'rocky-irregular': 'rocky-baseline',
  'metallic-cluster': 'resource-rich',
  'icy-body': 'icy-contrast',
  'cinematic-hero': 'hero-cinematic',
});

function compareByDescriptorId(left, right) {
  return left.descriptorId.localeCompare(right.descriptorId);
}

function buildDescriptor(domain, family, seed) {
  return {
    descriptorId: `${domain}-${family}`,
    schemaVersion: EXTERNAL_OBJECT_SCHEMA_VERSION,
    domain,
    objectFamily: family,
    roleCue: seed.roleCue,
    factionCue: seed.factionCue,
    fallbackTier: seed.fallbackTier,
    displayLabel: seed.displayLabel,
    silhouetteProfile: seed.silhouetteProfile,
    materialProfile: seed.materialProfile,
    emissiveProfile: seed.emissiveProfile,
  };
}

function createDebrisDescriptorPayloads() {
  const families = EXTERNAL_OBJECT_FAMILY_BY_DOMAIN[EXTERNAL_OBJECT_DOMAIN.DEBRIS];

  return Object.freeze(
    families
      .map((family) => buildDescriptor(EXTERNAL_OBJECT_DOMAIN.DEBRIS, family, DEBRIS_DESCRIPTOR_SEED[family]))
      .sort(compareByDescriptorId)
  );
}

function createAsteroidDescriptorPayloads() {
  const families = EXTERNAL_OBJECT_FAMILY_BY_DOMAIN[EXTERNAL_OBJECT_DOMAIN.ASTEROIDS];

  return Object.freeze(
    families
      .map((family) =>
        buildDescriptor(EXTERNAL_OBJECT_DOMAIN.ASTEROIDS, family, ASTEROID_DESCRIPTOR_SEED[family])
      )
      .sort(compareByDescriptorId)
  );
}

function createDebrisAndAsteroidDescriptorPayload() {
  return Object.freeze({
    schemaVersion: EXTERNAL_OBJECT_SCHEMA_VERSION,
    descriptors: Object.freeze([
      ...createDebrisDescriptorPayloads(),
      ...createAsteroidDescriptorPayloads(),
    ].sort(compareByDescriptorId)),
  });
}

module.exports = {
  DEBRIS_DESCRIPTOR_SEED,
  ASTEROID_DESCRIPTOR_SEED,
  ASTEROID_STYLE_BAND_BY_FAMILY,
  createDebrisDescriptorPayloads,
  createAsteroidDescriptorPayloads,
  createDebrisAndAsteroidDescriptorPayload,
};
