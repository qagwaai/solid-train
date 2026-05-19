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
    },
    { _id: false }
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
    shipSchema,
    missionSchema,
  };
}

module.exports = {
  createShipModelArtifacts,
};
