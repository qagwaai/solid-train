'use strict';

const { ITEM_DAMAGE_STATUS_VALUES } = require('../../model/canonical-items');

function createShipModelArtifacts({
  mongoose,
  inventoryItemReferenceSchema,
  spatialStateSchema,
  motionStateSchema,
}) {
  const damageSystemSchema = new mongoose.Schema(
    {
      code: {
        type: String,
        required: true,
      },
      label: {
        type: String,
        required: true,
      },
      severity: {
        type: String,
        enum: ['minor', 'major', 'critical'],
        required: true,
      },
      summary: {
        type: String,
        required: true,
      },
      repairPriority: {
        type: Number,
        required: true,
      },
    },
    { _id: false }
  );

  const damageProfileSchema = new mongoose.Schema(
    {
      overallStatus: {
        type: String,
        enum: ITEM_DAMAGE_STATUS_VALUES,
        required: true,
      },
      summary: {
        type: String,
        required: true,
      },
      origin: {
        type: String,
        enum: ['cold-boot-scripted', 'combat', 'wear', 'unknown'],
        required: true,
      },
      updatedAt: {
        type: String,
        required: true,
      },
      systems: {
        type: [damageSystemSchema],
        default: [],
      },
    },
    { _id: false }
  );

  const driveProfileSchema = new mongoose.Schema(
    {
      id: {
        type: String,
        required: true,
      },
      name: {
        type: String,
        required: true,
      },
      rangeAu: {
        type: Number,
        required: true,
        min: 0,
      },
      cruiseSpeedAuPerHour: {
        type: Number,
        required: true,
        min: 0,
      },
      fuelCostPerAu: {
        type: Number,
        required: true,
        min: 0,
      },
    },
    { _id: false }
  );

  const shipOwnershipSchema = new mongoose.Schema(
    {
      ownerType: {
        type: String,
        enum: ['player-character', 'npc-pirate', 'unowned', 'unknown'],
        required: true,
      },
      playerId: {
        type: String,
        default: null,
      },
      characterId: {
        type: String,
        default: null,
      },
      npcId: {
        type: String,
        default: null,
      },
      factionId: {
        type: String,
        default: null,
      },
    },
    { _id: false }
  );

  const ownershipActorSchema = new mongoose.Schema(
    {
      ownerType: {
        type: String,
        enum: ['player-character'],
        required: true,
      },
      playerId: {
        type: String,
        default: null,
      },
      characterId: {
        type: String,
        default: null,
      },
    },
    { _id: false }
  );

  const ownershipTransferEntrySchema = new mongoose.Schema(
    {
      at: {
        type: String,
        required: true,
      },
      reason: {
        type: String,
        required: true,
      },
      fromOwner: {
        type: shipOwnershipSchema,
        required: true,
      },
      toOwner: {
        type: shipOwnershipSchema,
        required: true,
      },
      actor: {
        type: ownershipActorSchema,
        required: true,
      },
    },
    { _id: false }
  );

  const shipSchema = new mongoose.Schema(
    {
      id: {
        type: String,
        required: true,
      },
      shipName: {
        type: String,
        required: true,
      },
      status: {
        type: String,
        default: null,
      },
      model: {
        type: String,
        required: true,
        default: 'Scavenger Pod',
      },
      tier: {
        type: Number,
        required: true,
        default: 1,
        min: 1,
        max: 10,
      },
      createdAt: {
        type: String,
        required: true,
      },
      inventory: {
        type: [inventoryItemReferenceSchema],
        default: [],
      },
      spatial: {
        type: spatialStateSchema,
        required: true,
      },
      motion: {
        type: motionStateSchema,
        default: null,
      },
      launchable: {
        type: Boolean,
        required: true,
        default: true,
      },
      damageProfile: {
        type: damageProfileSchema,
        default: null,
      },
      driveProfile: {
        type: driveProfileSchema,
        default: null,
      },
      ownership: {
        type: shipOwnershipSchema,
        default: null,
      },
      ownershipHistory: {
        type: [ownershipTransferEntrySchema],
        default: [],
      },
      navigationPlacement: {
        type: new mongoose.Schema(
          {
            version: { type: Number, enum: [1], required: true },
            status: { type: String, enum: ['committed'], required: true },
            lineageId: { type: String, required: true },
            shipId: { type: String, required: true },
            coordinateBasisId: {
              type: String,
              enum: ['stellar:sol:catalog-cartesian:v1'],
              required: true,
            },
            evaluationModelId: {
              type: String,
              enum: ['sol-catalog-kepler-position-v1'],
              required: true,
            },
            placementRule: {
              type: String,
              enum: ['station-docked-zero-offset-v1', 'starter-belt-sol-xy-v1'],
              required: true,
            },
            transactionId: { type: String },
            sourceMarketId: { type: String },
            sourceHostBodyId: { type: String },
            sourceModelRevision: { type: String, match: /^[a-f0-9]{64}$/ },
            shipRevision: { type: String, match: /^[a-f0-9]{64}$/, required: true },
            epochMs: { type: Number, min: 946684800000, max: 4102444799999, required: true },
            issuedAt: { type: String, required: true },
          },
          { _id: false }
        ),
        default: undefined,
      },
    },
    { _id: false }
  );

  const shipRecordSchema = new mongoose.Schema(
    {
      id: {
        type: String,
        required: true,
        unique: true,
        index: true,
      },
      shipName: {
        type: String,
        required: true,
      },
      status: {
        type: String,
        default: null,
      },
      model: {
        type: String,
        required: true,
        default: 'Scavenger Pod',
      },
      tier: {
        type: Number,
        required: true,
        default: 1,
        min: 1,
        max: 10,
      },
      createdAt: {
        type: String,
        required: true,
      },
      inventory: {
        type: [inventoryItemReferenceSchema],
        default: [],
      },
      spatial: {
        type: spatialStateSchema,
        required: true,
      },
      motion: {
        type: motionStateSchema,
        default: null,
      },
      launchable: {
        type: Boolean,
        required: true,
        default: true,
      },
      damageProfile: {
        type: damageProfileSchema,
        default: null,
      },
      driveProfile: {
        type: driveProfileSchema,
        default: null,
      },
      ownership: {
        type: shipOwnershipSchema,
        required: true,
      },
      ownershipHistory: {
        type: [ownershipTransferEntrySchema],
        default: [],
      },
    },
    {
      collection: 'ships',
      timestamps: true,
    }
  );

  const missionSchema = new mongoose.Schema(
    {
      missionId: {
        type: String,
        required: true,
      },
      status: {
        type: String,
        required: true,
        enum: ['available', 'active', 'completed'],
      },
      startedAt: {
        type: String,
      },
      inProgressAt: {
        type: String,
      },
      failedAt: {
        type: String,
      },
      completedAt: {
        type: String,
      },
      updatedAt: {
        type: String,
      },
      failureReason: {
        type: String,
      },
      statusDetail: {
        type: String,
      },
    },
    { _id: false }
  );

  return {
    damageSystemSchema,
    damageProfileSchema,
    driveProfileSchema,
    shipOwnershipSchema,
    shipSchema,
    shipRecordSchema,
    missionSchema,
  };
}

module.exports = {
  createShipModelArtifacts,
};
