'use strict';

const mongoose = require('mongoose');

/**
 * Triple schema for 3D coordinate representation
 */
const tripleSchema = new mongoose.Schema({
  x: {
    type: Number,
    required: true
  },
  y: {
    type: Number,
    required: true
  },
  z: {
    type: Number,
    required: true
  }
}, { _id: false });

/**
 * SpatialReference schema for coordinate reference frames
 */
const spatialReferenceSchema = new mongoose.Schema({
  solarSystemId: {
    type: String,
    required: true
  },
  referenceKind: {
    type: String,
    enum: ['barycentric', 'body-centered'],
    required: true
  },
  referenceBodyId: {
    type: String,
    default: null
  },
  epochMs: {
    type: Number,
    required: true
  }
}, { _id: false });

/**
 * DroneKinematics schema for position and velocity data
 */
const droneKinematicsSchema = new mongoose.Schema({
  position: {
    type: tripleSchema,
    required: true
  },
  velocity: {
    type: tripleSchema,
    required: true
  },
  reference: {
    type: spatialReferenceSchema,
    required: true
  }
}, { _id: false });

/**
 * Drone schema for a character's drones
 */
const droneSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  droneName: {
    type: String,
    required: true
  },
  createdAt: {
    type: String,
    required: true
  },
  kinematics: {
    type: droneKinematicsSchema,
    default: null
  }
}, { _id: false });

/**
 * Character schema - embedded within Player
 */
const characterSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  characterName: {
    type: String,
    required: true
  },
  createdAt: {
    type: String,
    required: true
  },
  drones: [droneSchema]
}, { _id: false });

/**
 * Player schema - root document for MongoDB
 */
const playerSchema = new mongoose.Schema({
  playerId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  playerName: {
    type: String,
    required: true
  },
  playerNameNormalized: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    index: true
  },
  email: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: true
  },
  sessionKey: {
    type: String,
    default: null
  },
  socketId: {
    type: String,
    default: null
  },
  characters: [characterSchema],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

/**
 * Update the updatedAt timestamp before saving
 */
playerSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

/**
 * Player model
 */
const Player = mongoose.model('Player', playerSchema);

module.exports = {
  Player,
  playerSchema,
  characterSchema,
  droneSchema
};
