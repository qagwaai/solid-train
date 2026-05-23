'use strict';

const {
  ITEM_STATE,
  ITEM_DAMAGE_STATUS,
  ITEM_CONTAINER_TYPE_VALUES,
  ITEM_STATE_VALUES,
  ITEM_DAMAGE_STATUS_VALUES,
} = require('../../model/canonical-items');

function createItemModelArtifacts({
  mongoose,
  shipKinematicsSchema,
  motionStateSchema,
  spatialStateSchema,
}) {
  const inventoryItemReferenceSchema = new mongoose.Schema(
    {
      itemId: {
        type: String,
        required: true,
      },
      itemType: {
        type: String,
        required: true,
      },
    },
    { _id: false }
  );

  const itemContainerSchema = new mongoose.Schema(
    {
      containerType: {
        type: String,
        enum: ITEM_CONTAINER_TYPE_VALUES,
        required: true,
      },
      containerId: {
        type: String,
        required: true,
      },
    },
    { _id: false }
  );

  const itemSchema = new mongoose.Schema(
    {
      id: {
        type: String,
        required: true,
        unique: true,
        index: true,
      },
      itemType: {
        type: String,
        required: true,
        index: true,
      },
      displayName: {
        type: String,
        required: true,
      },
      tier: {
        type: Number,
        min: 1,
        max: 20,
        default: null,
      },
      state: {
        type: String,
        enum: ITEM_STATE_VALUES,
        required: true,
        default: ITEM_STATE.CONTAINED,
        index: true,
      },
      damageStatus: {
        type: String,
        enum: ITEM_DAMAGE_STATUS_VALUES,
        required: true,
        default: ITEM_DAMAGE_STATUS.INTACT,
      },
      container: {
        type: itemContainerSchema,
        default: null,
      },
      owningPlayerId: {
        type: String,
        required: true,
        index: true,
      },
      owningCharacterId: {
        type: String,
        required: true,
        index: true,
      },
      spatial: {
        type: spatialStateSchema,
        default: null,
      },
      motion: {
        type: motionStateSchema,
        default: null,
      },
      kinematics: {
        type: shipKinematicsSchema,
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
      destroyedAt: {
        type: String,
        default: null,
      },
      destroyedReason: {
        type: String,
        default: null,
      },
      launchable: {
        type: Boolean,
        required: true,
        default: true,
      },
      quantity: {
        type: Number,
        required: true,
        default: 1,
        min: 1,
      },
    },
    {
      collection: 'items',
    }
  );

  itemSchema.index({
    'container.containerType': 1,
    'container.containerId': 1,
  });

  itemSchema.index({
    'spatial.solarSystemId': 1,
    'spatial.positionKm.x': 1,
    'spatial.positionKm.y': 1,
    'spatial.positionKm.z': 1,
  });

  const Item = mongoose.model('Item', itemSchema);

  return {
    Item,
    itemSchema,
    itemContainerSchema,
    inventoryItemReferenceSchema,
  };
}

module.exports = {
  createItemModelArtifacts,
};
