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

const SHIP_DESCRIPTOR_SEED = Object.freeze({
  scout: Object.freeze({
    roleCue: 'navigation',
    factionCue: 'independent',
    fallbackTier: 'minimal',
    displayLabel: 'Scout Hull',
    silhouetteProfile: 'needle',
    materialProfile: 'alloy',
    emissiveProfile: 'low',
  }),
  hauler: Object.freeze({
    roleCue: 'trade',
    factionCue: 'consortium',
    fallbackTier: 'standard',
    displayLabel: 'Hauler Hull',
    silhouetteProfile: 'broad',
    materialProfile: 'composite',
    emissiveProfile: 'low',
  }),
  frigate: Object.freeze({
    roleCue: 'military',
    factionCue: 'frontier-union',
    fallbackTier: 'hero',
    displayLabel: 'Frigate Hull',
    silhouetteProfile: 'spire',
    materialProfile: 'alloy',
    emissiveProfile: 'medium',
  }),
  interceptor: Object.freeze({
    roleCue: 'military',
    factionCue: 'imperial-remnant',
    fallbackTier: 'hero',
    displayLabel: 'Interceptor Hull',
    silhouetteProfile: 'needle',
    materialProfile: 'metallic',
    emissiveProfile: 'high',
  }),
  industrial: Object.freeze({
    roleCue: 'industrial',
    factionCue: 'consortium',
    fallbackTier: 'standard',
    displayLabel: 'Industrial Hull',
    silhouetteProfile: 'modular',
    materialProfile: 'infrastructure',
    emissiveProfile: 'navigation',
  }),
});

const STATION_DESCRIPTOR_SEED = Object.freeze({
  'trade-hub': Object.freeze({
    roleCue: 'trade',
    factionCue: 'consortium',
    fallbackTier: 'hero',
    displayLabel: 'Trade Hub Station',
    silhouetteProfile: 'ring',
    materialProfile: 'infrastructure',
    emissiveProfile: 'navigation',
  }),
  refinery: Object.freeze({
    roleCue: 'industrial',
    factionCue: 'frontier-union',
    fallbackTier: 'standard',
    displayLabel: 'Refinery Station',
    silhouetteProfile: 'modular',
    materialProfile: 'infrastructure',
    emissiveProfile: 'medium',
  }),
  'naval-outpost': Object.freeze({
    roleCue: 'military',
    factionCue: 'imperial-remnant',
    fallbackTier: 'hero',
    displayLabel: 'Naval Outpost Station',
    silhouetteProfile: 'spire',
    materialProfile: 'alloy',
    emissiveProfile: 'high',
  }),
  'research-platform': Object.freeze({
    roleCue: 'civilian',
    factionCue: 'independent',
    fallbackTier: 'minimal',
    displayLabel: 'Research Platform Station',
    silhouetteProfile: 'clustered',
    materialProfile: 'composite',
    emissiveProfile: 'low',
  }),
});

const GATE_DESCRIPTOR_SEED = Object.freeze({
  'ring-gate': Object.freeze({
    roleCue: 'navigation',
    factionCue: 'consortium',
    fallbackTier: 'hero',
    displayLabel: 'Ring Gate Landmark',
    silhouetteProfile: 'ring',
    materialProfile: 'infrastructure',
    emissiveProfile: 'navigation',
  }),
  'segmented-arch': Object.freeze({
    roleCue: 'navigation',
    factionCue: 'frontier-union',
    fallbackTier: 'standard',
    displayLabel: 'Segmented Arch Gate Landmark',
    silhouetteProfile: 'spire',
    materialProfile: 'alloy',
    emissiveProfile: 'medium',
  }),
  'relay-spindle': Object.freeze({
    roleCue: 'infrastructure',
    factionCue: 'independent',
    fallbackTier: 'minimal',
    displayLabel: 'Relay Spindle Gate Landmark',
    silhouetteProfile: 'needle',
    materialProfile: 'infrastructure',
    emissiveProfile: 'low',
  }),
});

const GATE_APPROACH_METADATA_BY_FAMILY = Object.freeze({
  'ring-gate': Object.freeze({
    approachCue: 'direct-centerline',
    landmarkFraming: 'full-ring',
    navBeaconCue: 'continuous',
    hazardCue: 'low',
    warningEscalation: 'none',
    recommendedStandOffKm: 1400,
    approachWindowKm: Object.freeze({
      min: 1000,
      max: 2200,
    }),
  }),
  'segmented-arch': Object.freeze({
    approachCue: 'offset-spiral',
    landmarkFraming: 'segmented-arch',
    navBeaconCue: 'pulse',
    hazardCue: 'medium',
    warningEscalation: 'required',
    recommendedStandOffKm: 1200,
    approachWindowKm: Object.freeze({
      min: 800,
      max: 1800,
    }),
  }),
  'relay-spindle': Object.freeze({
    approachCue: 'vector-handoff',
    landmarkFraming: 'spindle-column',
    navBeaconCue: 'triplet',
    hazardCue: 'medium',
    warningEscalation: 'required',
    recommendedStandOffKm: 900,
    approachWindowKm: Object.freeze({
      min: 600,
      max: 1500,
    }),
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

function createShipDescriptorPayloads() {
  const families = EXTERNAL_OBJECT_FAMILY_BY_DOMAIN[EXTERNAL_OBJECT_DOMAIN.SHIPS];

  return Object.freeze(
    families
      .map((family) => buildDescriptor(EXTERNAL_OBJECT_DOMAIN.SHIPS, family, SHIP_DESCRIPTOR_SEED[family]))
      .sort(compareByDescriptorId)
  );
}

function createStationDescriptorPayloads() {
  const families = EXTERNAL_OBJECT_FAMILY_BY_DOMAIN[EXTERNAL_OBJECT_DOMAIN.STATIONS];

  return Object.freeze(
    families
      .map((family) =>
        buildDescriptor(EXTERNAL_OBJECT_DOMAIN.STATIONS, family, STATION_DESCRIPTOR_SEED[family])
      )
      .sort(compareByDescriptorId)
  );
}

function createGateDescriptorPayloads() {
  const families = EXTERNAL_OBJECT_FAMILY_BY_DOMAIN[EXTERNAL_OBJECT_DOMAIN.GATES];

  return Object.freeze(
    families
      .map((family) => buildDescriptor(EXTERNAL_OBJECT_DOMAIN.GATES, family, GATE_DESCRIPTOR_SEED[family]))
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

function createShipAndStationDescriptorPayload() {
  return Object.freeze({
    schemaVersion: EXTERNAL_OBJECT_SCHEMA_VERSION,
    descriptors: Object.freeze([
      ...createShipDescriptorPayloads(),
      ...createStationDescriptorPayloads(),
    ].sort(compareByDescriptorId)),
  });
}

function createGateLandmarkDescriptorPayload() {
  const descriptors = createGateDescriptorPayloads();

  return Object.freeze({
    schemaVersion: EXTERNAL_OBJECT_SCHEMA_VERSION,
    gates: Object.freeze(
      descriptors
        .map((descriptor) => ({
          descriptor,
          approachMetadata: {
            ...GATE_APPROACH_METADATA_BY_FAMILY[descriptor.objectFamily],
          },
        }))
        .sort((left, right) => left.descriptor.descriptorId.localeCompare(right.descriptor.descriptorId))
    ),
  });
}

module.exports = {
  DEBRIS_DESCRIPTOR_SEED,
  ASTEROID_DESCRIPTOR_SEED,
  SHIP_DESCRIPTOR_SEED,
  STATION_DESCRIPTOR_SEED,
  GATE_DESCRIPTOR_SEED,
  GATE_APPROACH_METADATA_BY_FAMILY,
  ASTEROID_STYLE_BAND_BY_FAMILY,
  createDebrisDescriptorPayloads,
  createAsteroidDescriptorPayloads,
  createShipDescriptorPayloads,
  createStationDescriptorPayloads,
  createGateDescriptorPayloads,
  createDebrisAndAsteroidDescriptorPayload,
  createShipAndStationDescriptorPayload,
  createGateLandmarkDescriptorPayload,
};
