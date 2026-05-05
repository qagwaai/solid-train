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
 * Ship location schema for barycentric body-relative position
 */
const shipLocationSchema = new mongoose.Schema({
  positionKm: {
    type: tripleSchema,
    required: true
  }
}, { _id: false });

/**
 * ShipKinematics schema for position and velocity data
 */
const shipKinematicsSchema = new mongoose.Schema({
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
 * Inventory reference schema for ship-contained items
 */
const inventoryItemReferenceSchema = new mongoose.Schema({
  itemId: {
    type: String,
    required: true
  },
  itemType: {
    type: String,
    required: true
  }
}, { _id: false });

/**
 * Item container schema for contained global items
 */
const itemContainerSchema = new mongoose.Schema({
  containerType: {
    type: String,
    enum: ['ship', 'market'],
    required: true
  },
  containerId: {
    type: String,
    required: true
  }
}, { _id: false });

/**
 * Global item schema for inventory and deployed space items
 */
const itemSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  itemType: {
    type: String,
    required: true,
    index: true
  },
  displayName: {
    type: String,
    required: true
  },
  state: {
    type: String,
    enum: ['contained', 'deployed', 'destroyed'],
    required: true,
    default: 'contained',
    index: true
  },
  damageStatus: {
    type: String,
    enum: ['intact', 'damaged', 'disabled', 'destroyed'],
    required: true,
    default: 'intact'
  },
  container: {
    type: itemContainerSchema,
    default: null
  },
  owningPlayerId: {
    type: String,
    required: true,
    index: true
  },
  owningCharacterId: {
    type: String,
    required: true,
    index: true
  },
  kinematics: {
    type: shipKinematicsSchema,
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
  destroyedAt: {
    type: String,
    default: null
  },
  destroyedReason: {
    type: String,
    default: null
  },
  launchable: {
    type: Boolean,
    required: true,
    default: true
  },
  quantity: {
    type: Number,
    required: true,
    default: 1,
    min: 1
  }
}, {
  collection: 'items'
});

itemSchema.index({
  'container.containerType': 1,
  'container.containerId': 1
});

/**
 * Damage system (subsystem) schema for a ship damage profile entry
 */
const damageSystemSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true
  },
  label: {
    type: String,
    required: true
  },
  severity: {
    type: String,
    enum: ['minor', 'major', 'critical'],
    required: true
  },
  summary: {
    type: String,
    required: true
  },
  repairPriority: {
    type: Number,
    required: true
  }
}, { _id: false });

/**
 * Damage profile schema for ship-level structural damage summary
 */
const damageProfileSchema = new mongoose.Schema({
  overallStatus: {
    type: String,
    enum: ['intact', 'damaged', 'disabled', 'destroyed'],
    required: true
  },
  summary: {
    type: String,
    required: true
  },
  origin: {
    type: String,
    enum: ['cold-boot-scripted', 'combat', 'wear', 'unknown'],
    required: true
  },
  updatedAt: {
    type: String,
    required: true
  },
  systems: {
    type: [damageSystemSchema],
    default: []
  }
}, { _id: false });

/**
 * Ship schema for a character's ships
 */
const shipSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  shipName: {
    type: String,
    required: true
  },
  status: {
    type: String,
    default: null
  },
  model: {
    type: String,
    required: true,
    default: 'Scavenger Pod'
  },
  tier: {
    type: Number,
    required: true,
    default: 1,
    min: 1,
    max: 10
  },
  createdAt: {
    type: String,
    required: true
  },
  inventory: {
    type: [inventoryItemReferenceSchema],
    default: []
  },
  location: {
    type: shipLocationSchema,
    default: null
  },
  kinematics: {
    type: shipKinematicsSchema,
    default: null
  },
  launchable: {
    type: Boolean,
    required: true,
    default: true
  },
  damageProfile: {
    type: damageProfileSchema,
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

// Supports fast bounding-cube prefilter for spherical distance queries.
celestialBodySchema.index({
  solarSystemId: 1,
  'location.positionKm.x': 1,
  'location.positionKm.y': 1,
  'location.positionKm.z': 1
});

celestialBodySchema.index({
  createdByCharacterId: 1,
  missionId: 1,
  sourceScanId: 1
});

/**
 * Character schema - embedded within Player
 */
const creditLedgerEntrySchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['put', 'take'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  timestamp: {
    type: String,
    required: true
  },
  referenceId: {
    type: String,
    default: null
  }
}, { _id: false });

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
  ships: [shipSchema],
  missions: [missionSchema],
  creditLedger: [creditLedgerEntrySchema]
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
  preferredLocale: {
    type: String,
    enum: ['en', 'it'],
    required: true,
    default: 'en'
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
const Item = mongoose.model('Item', itemSchema);

module.exports = {
  CelestialBody,
  celestialBodySchema,
  asteroidMaterialProfileSchema,
  celestialBodyKinematicsSchema,
  celestialBodyLocationSchema,
  Item,
  itemSchema,
  itemContainerSchema,
  inventoryItemReferenceSchema,
  Player,
  playerSchema,
  characterSchema,
  creditLedgerEntrySchema,
  shipSchema,
  shipKinematicsSchema,
  missionSchema
};
