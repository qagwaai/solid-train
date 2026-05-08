'use strict';

function createSharedPrimitiveSchemas({ mongoose }) {
  const tripleSchema = new mongoose.Schema(
    {
      x: {
        type: Number,
        required: true,
      },
      y: {
        type: Number,
        required: true,
      },
      z: {
        type: Number,
        required: true,
      },
    },
    { _id: false }
  );

  const shipKinematicsSchema = new mongoose.Schema(
    {
      position: {
        type: tripleSchema,
        required: true,
      },
      velocity: {
        type: tripleSchema,
        required: true,
      },
      reference: {
        solarSystemId: {
          type: String,
          required: true,
        },
        referenceKind: {
          type: String,
          enum: ['barycentric', 'body-centered'],
          required: true,
        },
        referenceBodyId: {
          type: String,
          default: null,
        },
        distanceUnit: {
          type: String,
          enum: ['km'],
          default: 'km',
        },
        velocityUnit: {
          type: String,
          enum: ['km/s'],
          default: 'km/s',
        },
        epochMs: {
          type: Number,
          required: true,
        },
      },
    },
    { _id: false }
  );

  const motionStateSchema = new mongoose.Schema(
    {
      velocityKmPerSec: {
        type: tripleSchema,
        required: true,
      },
      angularVelocityRadPerSec: {
        type: tripleSchema,
        default: null,
      },
    },
    { _id: false }
  );

  const spatialStateSchema = new mongoose.Schema(
    {
      solarSystemId: {
        type: String,
        required: true,
      },
      frame: {
        type: String,
        enum: ['barycentric'],
        default: 'barycentric',
        required: true,
      },
      positionKm: {
        type: tripleSchema,
        required: true,
      },
      epochMs: {
        type: Number,
        required: true,
      },
    },
    { _id: false }
  );

  return {
    tripleSchema,
    shipKinematicsSchema,
    motionStateSchema,
    spatialStateSchema,
  };
}

module.exports = {
  createSharedPrimitiveSchemas,
};
