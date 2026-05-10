'use strict';

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
    },
    { _id: false }
  );

  const orbitalElementsSchema = new mongoose.Schema(
    {
      semiMajorAxisKm: { type: Number, required: true, min: 0 },
      eccentricity: { type: Number, required: true, min: 0, max: 0.999 },
      inclinationDeg: { type: Number, required: true, default: 0 },
      longitudeOfAscendingNodeDeg: { type: Number, required: true, default: 0 },
      argumentOfPeriapsisDeg: { type: Number, required: true, default: 0 },
      meanAnomalyAtEpochDeg: { type: Number, required: true, default: 0 },
      orbitalPeriodSec: { type: Number, required: true, min: 1 },
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
        required: true,
      },
      state: {
        type: String,
        enum: ['unscanned', 'active', 'destroyed'],
        required: true,
        default: 'active',
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
      bodyType: {
        type: String,
        enum: ['star', 'planet', 'dwarf-planet', 'moon', 'asteroid', 'tno', 'comet', null],
        default: null,
        index: true,
      },
      displayName: {
        type: String,
        default: null,
      },
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
