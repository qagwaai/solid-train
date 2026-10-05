'use strict';
const { hasValidBodyClassification } = require('../../model/celestial-body-upsert');

function createCelestialModelArtifacts({
  mongoose,
  spatialStateSchema,
  motionStateSchema,
  physicalStateSchema,
  observabilityStateSchema,
}) {
  const asteroidMaterialProfileSchema = new mongoose.Schema(
    {
      rarity: {
        type: String,
        enum: ['Common', 'Uncommon', 'Rare', 'Exotic'],
        required: true,
      },
      material: {
        type: String,
        required: true,
      },
      textureColor: {
        type: String,
        required: true,
      },
    },
    { _id: false }
  );

  const celestialBodyDebrisMaterialSchema = new mongoose.Schema(
    {
      material: {
        type: String,
        required: true,
      },
      rarity: {
        type: String,
        enum: ['Common', 'Uncommon', 'Rare', 'Exotic'],
        required: true,
      },
      quantity: {
        type: Number,
        required: true,
        min: 1,
      },
      itemType: {
        type: String,
        required: true,
      },
      externalObjectDescriptor: {
        type: new mongoose.Schema(
          {
            descriptorId: {
              type: String,
              required: true,
            },
            schemaVersion: {
              type: String,
              enum: ['sw-13-m0-v1'],
              required: true,
            },
            domain: {
              type: String,
              enum: ['debris', 'ships', 'gates', 'stations', 'asteroids'],
              required: true,
            },
            objectFamily: {
              type: String,
              required: true,
            },
            roleCue: {
              type: String,
              enum: [
                'salvage',
                'industrial',
                'trade',
                'military',
                'navigation',
                'infrastructure',
                'hazard',
                'civilian',
                'neutral',
              ],
              required: true,
            },
            factionCue: {
              type: String,
              enum: [
                'neutral',
                'independent',
                'consortium',
                'frontier-union',
                'imperial-remnant',
                'pirate-clan',
                'unknown',
              ],
              required: true,
            },
            fallbackTier: {
              type: String,
              enum: ['hero', 'standard', 'minimal'],
              required: true,
            },
            displayLabel: {
              type: String,
              required: true,
            },
            silhouetteProfile: {
              type: String,
              enum: [
                'fragmented',
                'needle',
                'broad',
                'modular',
                'ring',
                'spire',
                'clustered',
                'irregular',
              ],
              required: true,
            },
            materialProfile: {
              type: String,
              enum: ['scrap', 'alloy', 'composite', 'infrastructure', 'rocky', 'metallic', 'icy'],
              required: true,
            },
            emissiveProfile: {
              type: String,
              enum: ['none', 'low', 'medium', 'high', 'navigation'],
              required: true,
            },
          },
          { _id: false }
        ),
        default: null,
      },
    },
    { _id: false }
  );

  const orbitalElementsSchema = new mongoose.Schema(
    {
      semiMajorAxisKm: { type: Number, required: true, min: 0 },
      eccentricity: { type: Number, required: true, min: 0, max: 0.999 },
      inclinationDeg: { type: Number, required: true },
      longitudeOfAscendingNodeDeg: { type: Number, required: true },
      argumentOfPeriapsisDeg: { type: Number, required: true },
      meanAnomalyAtEpochDeg: { type: Number, required: true },
      orbitalPeriodSec: {
        type: Number,
        required: true,
        validate: (value) => Number.isFinite(value) && Math.abs(value) >= 1,
      },
      epoch: { type: String, required: true },
      // Present on moons / sub-satellites only. Identifies the parent non-star
      // body whose position is the origin for semiMajorAxisKm. Absent for bodies
      // that orbit a star directly.
      anchorBodyId: { type: String, default: null },
    },
    { _id: false }
  );

  const catalogPhysicalSchema = new mongoose.Schema(
    {
      massKg: { type: Number, default: null },
      meanRadiusKm: { type: Number, default: null },
      equatorialRadiusKm: { type: Number, default: null },
      estimatedDiameterM: { type: Number, default: null },
      estimatedMassKg: { type: Number, default: null },
      radiusKm: { type: Number, default: null },
      rotationPeriodSec: { type: Number, default: null },
      axialTiltDeg: { type: Number, default: null },
      surfaceGravityMps2: { type: Number, default: null },
      meanTemperatureK: { type: Number, default: null },
      compositionTags: { type: [String], default: [] },
    },
    { _id: false }
  );

  const atmosphereSchema = new mongoose.Schema(
    {
      hasAtmosphere: { type: Boolean, required: true, default: false },
      surfacePressurePa: { type: Number, default: null },
      primaryComponents: { type: [String], default: [] },
    },
    { _id: false }
  );

  const discoverySchema = new mongoose.Schema(
    {
      discoveredBy: { type: String, default: null },
      discoveredYear: { type: Number, default: null },
      discoveryNotes: { type: String, default: null },
    },
    { _id: false }
  );

  const magnitudesSchema = new mongoose.Schema(
    {
      absoluteMagnitudeH: { type: Number, default: null },
      apparentMagnitudeMin: { type: Number, default: null },
      apparentMagnitudeMax: { type: Number, default: null },
    },
    { _id: false }
  );

  const celestialBodySchema = new mongoose.Schema(
    {
      id: {
        type: String,
        required: true,
        unique: true,
        index: true,
      },
      catalogId: {
        type: String,
        required: true,
        index: true,
      },
      sourceScanId: {
        type: String,
        required: true,
        index: true,
      },
      createdByCharacterId: {
        type: String,
        required: true,
        index: true,
      },
      missionId: {
        type: String,
        default: null,
        index: true,
      },
      missionInstanceId: {
        type: String,
        default: null,
      },
      createdAt: {
        type: String,
        required: true,
      },
      updatedAt: {
        type: String,
        required: true,
      },
      spatial: {
        type: spatialStateSchema,
        required: true,
      },
      motion: {
        type: motionStateSchema,
        default: null,
      },
      physical: {
        type: physicalStateSchema,
        default: null,
      },
      observability: {
        type: observabilityStateSchema,
        required: true,
      },
      composition: {
        type: asteroidMaterialProfileSchema,
        required: function () {
          const update = typeof this.getUpdate === 'function' ? this.getUpdate() : null;
          const source = update ? (update.$set || update) : this;
          return source.state !== 'unscanned';
        },
      },
      externalObjectDescriptor: {
        type: new mongoose.Schema(
          {
            descriptorId: {
              type: String,
              required: true,
            },
            schemaVersion: {
              type: String,
              enum: ['sw-13-m0-v1'],
              required: true,
            },
            domain: {
              type: String,
              enum: ['debris', 'ships', 'gates', 'stations', 'asteroids'],
              required: true,
            },
            objectFamily: {
              type: String,
              required: true,
            },
            roleCue: {
              type: String,
              enum: [
                'salvage',
                'industrial',
                'trade',
                'military',
                'navigation',
                'infrastructure',
                'hazard',
                'civilian',
                'neutral',
              ],
              required: true,
            },
            factionCue: {
              type: String,
              enum: [
                'neutral',
                'independent',
                'consortium',
                'frontier-union',
                'imperial-remnant',
                'pirate-clan',
                'unknown',
              ],
              required: true,
            },
            fallbackTier: {
              type: String,
              enum: ['hero', 'standard', 'minimal'],
              required: true,
            },
            displayLabel: {
              type: String,
              required: true,
            },
            silhouetteProfile: {
              type: String,
              enum: [
                'fragmented',
                'needle',
                'broad',
                'modular',
                'ring',
                'spire',
                'clustered',
                'irregular',
              ],
              required: true,
            },
            materialProfile: {
              type: String,
              enum: ['scrap', 'alloy', 'composite', 'infrastructure', 'rocky', 'metallic', 'icy'],
              required: true,
            },
            emissiveProfile: {
              type: String,
              enum: ['none', 'low', 'medium', 'high', 'navigation'],
              required: true,
            },
          },
          { _id: false }
        ),
        default: null,
      },
      state: {
        type: String,
        enum: ['unscanned', 'active', 'destroyed'],
        required: true,
        index: true,
      },
      destroyedAt: {
        type: String,
        default: null,
      },
      destroyedReason: {
        type: String,
        default: null,
      },
      debrisSeed: {
        type: Number,
        default: null,
      },
      debris: {
        type: [celestialBodyDebrisMaterialSchema],
        default: [],
      },
      surfaceArchetype: {
        type: String,
        enum: [
          'rocky',
          'lava',
          'ocean',
          'gas-giant',
          'ice-giant',
          'star',
          'rocky-moon',
          'icy-moon',
          'asteroid',
        ],
        required: true,
        validate: function () {
          const update = typeof this.getUpdate === 'function' ? this.getUpdate() : null;
          return hasValidBodyClassification(update ? (update.$set || update) : this);
        },
      },
      bodyType: {
        type: String,
        enum: ['star', 'planet', 'dwarf-planet', 'moon', 'asteroid', 'tno', 'comet'],
        required: true,
        index: true,
      },
      displayName: {
        type: String,
        default: null,
      },
      spectralClass: { type: String, default: null },
      luminositySolar: { type: Number, min: 0, default: null },
      parentBodyId: {
        type: String,
        default: null,
        index: true,
      },
      orbitalElements: {
        type: orbitalElementsSchema,
        default: null,
      },
      physicalCatalog: {
        type: catalogPhysicalSchema,
        default: null,
      },
      atmosphere: {
        type: atmosphereSchema,
        default: null,
      },
      discovery: {
        type: discoverySchema,
        default: null,
      },
      magnitudes: {
        type: magnitudesSchema,
        default: null,
      },
      isCatalogBody: {
        type: Boolean,
        default: false,
        index: true,
      },
      planetType: {
        type: String,
        default: null,
      },
      hygId: {
        type: String,
        default: null,
        index: true,
      },
      visualization: {
        type: new mongoose.Schema(
          {
            colorHex: { type: String, default: null },
            spectralClass: { type: String, default: null },
            textureKey: { type: String, default: null },
          },
          { _id: false }
        ),
        default: null,
      },
      clusterId: {
        type: String,
        default: null,
        index: true,
      },
      clusterCenterKm: {
        type: new mongoose.Schema(
          {
            x: { type: Number, required: true },
            y: { type: Number, required: true },
            z: { type: Number, required: true },
          },
          { _id: false }
        ),
        default: null,
      },
      localOffsetKm: {
        type: new mongoose.Schema(
          {
            x: { type: Number, required: true },
            y: { type: Number, required: true },
            z: { type: Number, required: true },
          },
          { _id: false }
        ),
        default: null,
      },
      distanceFromClusterCenterKm: {
        type: Number,
        default: null,
      },
    },
    {
      collection: 'cb',
    }
  );

  celestialBodySchema.index({
    'spatial.solarSystemId': 1,
    'spatial.positionKm.x': 1,
    'spatial.positionKm.y': 1,
    'spatial.positionKm.z': 1,
  });

  celestialBodySchema.index({
    createdByCharacterId: 1,
    missionId: 1,
    sourceScanId: 1,
  });

  const CelestialBody = mongoose.model('CelestialBody', celestialBodySchema);

  return {
    CelestialBody,
    celestialBodySchema,
    asteroidMaterialProfileSchema,
    celestialBodyDebrisMaterialSchema,
  };
}

module.exports = {
  createCelestialModelArtifacts,
};
