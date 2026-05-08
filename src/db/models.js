'use strict';

const mongoose = require('mongoose');
const { createPlayerModelArtifacts } = require('./models/player-model');
const { createSharedPrimitiveSchemas } = require('./models/shared-primitives');
const { createItemModelArtifacts } = require('./models/item-model');
const { createMarketModelArtifacts } = require('./models/market-model');
const { createGameStateModelArtifacts } = require('./models/game-state-model');
const { createShipModelArtifacts } = require('./models/ship-model');
const { createCelestialModelArtifacts } = require('./models/celestial-model');
const { createJumpGateModelArtifacts } = require('./models/jump-gate-model');

const {
  tripleSchema,
  shipKinematicsSchema,
  motionStateSchema,
  spatialStateSchema
} = createSharedPrimitiveSchemas({ mongoose });

const {
  Item,
  itemSchema,
  itemContainerSchema,
  inventoryItemReferenceSchema
} = createItemModelArtifacts({
  mongoose,
  shipKinematicsSchema,
  motionStateSchema,
  spatialStateSchema
});

/**
 * Physical state schema for mass and diameter
 */
const physicalStateSchema = new mongoose.Schema({
  estimatedMassKg: {
    type: Number,
    default: null
  },
  estimatedDiameterM: {
    type: Number,
    default: null
  }
}, { _id: false });

/**
 * Observability state schema for visibility and scan state
 */
const observabilityStateSchema = new mongoose.Schema({
  visibility: {
    type: String,
    enum: ['visible', 'not-visible', 'cloaked'],
    required: true
  },
  scanState: {
    type: String,
    enum: ['unscanned', 'scanned'],
    required: true
  }
}, { _id: false });
const {
  driveProfileSchema,
  shipSchema,
  missionSchema
} = createShipModelArtifacts({
  mongoose,
  inventoryItemReferenceSchema,
  spatialStateSchema,
  motionStateSchema
});

const {
  CelestialBody,
  celestialBodySchema,
  asteroidMaterialProfileSchema
} = createCelestialModelArtifacts({
  mongoose,
  spatialStateSchema,
  motionStateSchema,
  physicalStateSchema,
  observabilityStateSchema
});

const {
  Market,
  marketSchema,
  marketInventoryEntrySchema,
  marketLedgerEntrySchema,
  marketOrbitSchema
} = createMarketModelArtifacts({
  mongoose,
  spatialStateSchema
});

const {
  GameStateDocument,
  gameStateDocumentSchema
} = createGameStateModelArtifacts({ mongoose });

const {
  Player,
  playerSchema,
  characterSchema,
  creditLedgerEntrySchema
} = createPlayerModelArtifacts({
  mongoose,
  shipSchema,
  missionSchema
});
const {
  JumpGate,
  jumpGateSchema
} = createJumpGateModelArtifacts({ mongoose });

module.exports = {
  CelestialBody,
  celestialBodySchema,
  asteroidMaterialProfileSchema,
  Item,
  itemSchema,
  itemContainerSchema,
  inventoryItemReferenceSchema,
  JumpGate,
  jumpGateSchema,
  Market,
  marketSchema,
  marketInventoryEntrySchema,
  marketLedgerEntrySchema,
  marketOrbitSchema,
  GameStateDocument,
  gameStateDocumentSchema,
  Player,
  playerSchema,
  characterSchema,
  creditLedgerEntrySchema,
  driveProfileSchema,
  shipSchema,
  shipKinematicsSchema,
  missionSchema
};
