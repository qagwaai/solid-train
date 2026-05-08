'use strict';

function createCelestialModelArtifacts({
  mongoose,
  spatialStateSchema,
  motionStateSchema,
  physicalStateSchema,
  observabilityStateSchema
}) {
  const asteroidMaterialProfileSchema = new mongoose.Schema({
    rarity: {
      type: String,
      enum: ['Common', 'Uncommon', 'Rare', 'Exotic'],
      required: true
    },
    material: {
      type: String,
      required: true
    },
    textureColor: {
      type: String,
      required: true
    }
  }, { _id: false });

  const celestialBodyDebrisMaterialSchema = new mongoose.Schema({
    material: {
      type: String,
      required: true
    },
    rarity: {
      type: String,
      enum: ['Common', 'Uncommon', 'Rare', 'Exotic'],
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    itemType: {
      type: String,
      required: true
    }
  }, { _id: false });

  const celestialBodySchema = new mongoose.Schema({
    id: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    catalogId: {
      type: String,
      required: true,
      index: true
    },
    sourceScanId: {
      type: String,
      required: true,
      index: true
    },
    createdByCharacterId: {
      type: String,
      required: true,
      index: true
    },
    missionId: {
      type: String,
      default: null,
      index: true
    },
    missionInstanceId: {
      type: String,
      default: null
    },
    createdAt: {
      type: String,
      required: true
    },
    updatedAt: {
      type: String,
      required: true
    },
    spatial: {
      type: spatialStateSchema,
      required: true
    },
    motion: {
      type: motionStateSchema,
      default: null
    },
    physical: {
      type: physicalStateSchema,
      default: null
    },
    observability: {
      type: observabilityStateSchema,
      required: true
    },
    composition: {
      type: asteroidMaterialProfileSchema,
      required: true
    },
    state: {
      type: String,
      enum: ['unscanned', 'active', 'destroyed'],
      required: true,
      default: 'active',
      index: true
    },
    destroyedAt: {
      type: String,
      default: null
    },
    destroyedReason: {
      type: String,
      default: null
    },
    debrisSeed: {
      type: Number,
      default: null
    },
    debris: {
      type: [celestialBodyDebrisMaterialSchema],
      default: []
    }
  }, {
    collection: 'cb'
  });

  celestialBodySchema.index({
    'spatial.solarSystemId': 1,
    'spatial.positionKm.x': 1,
    'spatial.positionKm.y': 1,
    'spatial.positionKm.z': 1
  });

  celestialBodySchema.index({
    createdByCharacterId: 1,
    missionId: 1,
    sourceScanId: 1
  });

  const CelestialBody = mongoose.model('CelestialBody', celestialBodySchema);

  return {
    CelestialBody,
    celestialBodySchema,
    asteroidMaterialProfileSchema,
    celestialBodyDebrisMaterialSchema
  };
}

module.exports = {
  createCelestialModelArtifacts
};
