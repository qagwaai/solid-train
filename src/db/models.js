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
const { createStarModelArtifacts } = require('./models/star-model');
const { createSolarSystemModelArtifacts } = require('./models/solar-system-model');
const { createNpcBustModelArtifacts } = require('./models/npc-bust-model');

const { shipKinematicsSchema, motionStateSchema, spatialStateSchema } =
  createSharedPrimitiveSchemas({ mongoose });

const { Item, itemSchema, itemContainerSchema, inventoryItemReferenceSchema } =
  createItemModelArtifacts({
    mongoose,
    shipKinematicsSchema,
    motionStateSchema,
    spatialStateSchema,
  });

/**
 * Physical state schema for mass and diameter
 */
const physicalStateSchema = new mongoose.Schema(
  {
    estimatedMassKg: {
      type: Number,
      default: null,
    },
    estimatedDiameterM: {
      type: Number,
      default: null,
    },
  },
  { _id: false }
);

/**
 * Observability state schema for visibility and scan state
 */
const observabilityStateSchema = new mongoose.Schema(
  {
    visibility: {
      type: String,
      enum: ['visible', 'not-visible', 'cloaked'],
      required: true,
    },
    scanState: {
      type: String,
      enum: ['unscanned', 'scanned'],
      required: true,
    },
  },
  { _id: false }
);
const { driveProfileSchema, shipOwnershipSchema, shipSchema, shipRecordSchema, missionSchema } =
  createShipModelArtifacts({
    mongoose,
    inventoryItemReferenceSchema,
    spatialStateSchema,
    motionStateSchema,
  });
const ShipRecord = mongoose.model('ShipRecord', shipRecordSchema);

const { CelestialBody, celestialBodySchema, asteroidMaterialProfileSchema } =
  createCelestialModelArtifacts({
    mongoose,
    spatialStateSchema,
    motionStateSchema,
    physicalStateSchema,
    observabilityStateSchema,
  });

const {
  Market,
  marketSchema,
  marketInventoryEntrySchema,
  marketLedgerEntrySchema,
  marketOrbitSchema,
} = createMarketModelArtifacts({
  mongoose,
  spatialStateSchema,
});

const { GameStateDocument, gameStateDocumentSchema } = createGameStateModelArtifacts({ mongoose });

const { Player, playerSchema, characterSchema, creditLedgerEntrySchema } =
  createPlayerModelArtifacts({
    mongoose,
    shipSchema,
    missionSchema,
  });
const { JumpGate, jumpGateSchema } = createJumpGateModelArtifacts({ mongoose });
const { Star, starSchema } = createStarModelArtifacts({ mongoose });
const { SolarSystem, solarSystemSchema } = createSolarSystemModelArtifacts({ mongoose });
const { NpcBust, npcBustSchema, npcBustDescriptorSchema } = createNpcBustModelArtifacts({
  mongoose,
});

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
  Star,
  starSchema,
  NpcBust,
  npcBustSchema,
  npcBustDescriptorSchema,
  SolarSystem,
  solarSystemSchema,
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
  shipOwnershipSchema,
  shipSchema,
  ShipRecord,
  shipKinematicsSchema,
  missionSchema,
};
