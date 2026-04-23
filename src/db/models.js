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
  distanceUnit: {
    type: String,
    enum: ['km'],
    default: 'km'
  },
  velocityUnit: {
    type: String,
    enum: ['km/s'],
    default: 'km/s'
  },
  epochMs: {
    type: Number,
    required: true
  }
}, { _id: false });

/**
 * Drone location schema for barycentric body-relative position
 */
const droneLocationSchema = new mongoose.Schema({
  positionKm: {
    type: tripleSchema,
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
  location: {
    type: droneLocationSchema,
    default: null
  },
  kinematics: {
    type: droneKinematicsSchema,
    default: null
  }
}, { _id: false });

/**
 * Mission progress schema for a character mission entry
 */
const missionSchema = new mongoose.Schema({
  missionId: {
    type: String,
    required: true
  },
  status: {
    type: String,
    required: true
  },
  startedAt: {
    type: String
  },
  inProgressAt: {
    type: String
  },
  failedAt: {
    type: String
  },
  completedAt: {
    type: String
  },
  updatedAt: {
    type: String
  },
  failureReason: {
    type: String
  },
  statusDetail: {
    type: String
  }
}, { _id: false });

/**
 * Celestial body location schema
 */
const celestialBodyLocationSchema = new mongoose.Schema({
  positionKm: {
    type: tripleSchema,
    required: true
  }
}, { _id: false });

/**
 * Celestial body kinematics schema
 */
const celestialBodyKinematicsSchema = new mongoose.Schema({
  velocityKmPerSec: {
    type: tripleSchema,
    required: true
  },
  angularVelocityRadPerSec: {
    type: tripleSchema,
    required: true
  },
  estimatedMassKg: {
    type: Number,
    required: true
  },
  estimatedDiameterM: {
    type: Number,
    required: true
  }
}, { _id: false });

/**
 * Celestial body material profile schema
 */
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

/**
 * Celestial body schema - root document in the cb collection
 */
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
  solarSystemId: {
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
  createdAt: {
    type: String,
    required: true
  },
  updatedAt: {
    type: String,
    required: true
  },
  location: {
    type: celestialBodyLocationSchema,
    required: true
  },
  kinematics: {
    type: celestialBodyKinematicsSchema,
    required: true
  },
  composition: {
    type: asteroidMaterialProfileSchema,
    required: true
  }
}, {
  collection: 'cb'
});

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
  drones: [droneSchema],
  missions: [missionSchema]
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
const CelestialBody = mongoose.model('CelestialBody', celestialBodySchema);

module.exports = {
  CelestialBody,
  celestialBodySchema,
  asteroidMaterialProfileSchema,
  celestialBodyKinematicsSchema,
  celestialBodyLocationSchema,
  Player,
  playerSchema,
  characterSchema,
  droneSchema,
  missionSchema
};
