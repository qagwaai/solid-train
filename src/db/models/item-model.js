'use strict';

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
        enum: ['ship', 'market'],
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
      state: {
        type: String,
        enum: ['contained', 'deployed', 'destroyed'],
        required: true,
        default: 'contained',
        index: true,
      },
      damageStatus: {
        type: String,
        enum: ['intact', 'damaged', 'disabled', 'destroyed'],
        required: true,
        default: 'intact',
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
