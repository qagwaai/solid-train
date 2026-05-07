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
 * Motion state schema for velocity and angular velocity
 */
const motionStateSchema = new mongoose.Schema({
  velocityKmPerSec: {
    type: tripleSchema,
    required: true
  },
  angularVelocityRadPerSec: {
    type: tripleSchema,
    default: null
  }
}, { _id: false });

/**
 * Spatial state schema (required on all in-world entities)
 */
const spatialStateSchema = new mongoose.Schema({
  solarSystemId: {
    type: String,
    required: true
  },
  frame: {
    type: String,
    enum: ['barycentric'],
    default: 'barycentric',
    required: true
  },
  positionKm: {
    type: tripleSchema,
    required: true
  },
  epochMs: {
    type: Number,
    required: true
  }
}, { _id: false });

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



/**
 * Drive profile schema for a ship's propulsion profile
 */
const driveProfileSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  rangeAu: {
    type: Number,
    required: true,
    min: 0
  },
  cruiseSpeedAuPerHour: {
    type: Number,
    required: true,
    min: 0
  },
  fuelCostPerAu: {
    type: Number,
    required: true,
    min: 0
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
  spatial: {
    type: spatialStateSchema,
    required: true
  },
  motion: {
    type: motionStateSchema,
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
  },
  driveProfile: {
    type: driveProfileSchema,
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
  spatial: {
    type: spatialStateSchema,
    required: true
  },
  motion: {
    type: motionStateSchema,
    default: null
  },
  physical: {
    type: physicalStateSchema,
    default: null
  },
  observability: {
    type: observabilityStateSchema,
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
  'spatial.solarSystemId': 1,
  'spatial.positionKm.x': 1,
  'spatial.positionKm.y': 1,
  'spatial.positionKm.z': 1
});

celestialBodySchema.index({
  createdByCharacterId: 1,
  missionId: 1,
  sourceScanId: 1
});

/**
 * Market inventory entry schema for finite stock + time-based restock.
 */
const marketInventoryEntrySchema = new mongoose.Schema({
  itemId: {
    type: String,
    required: true,
    index: true
  },
  stock: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  maxStock: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  restockPerInterval: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  marketCanBuy: {
    type: Boolean,
    required: true,
    default: true
  },
  marketCanSell: {
    type: Boolean,
    required: true,
    default: true
  }
}, { _id: false });

/**
 * Market ledger schema for append-only market transactions.
 */
const marketLedgerEntrySchema = new mongoose.Schema({
  transactionId: {
    type: String,
    required: true,
    index: true
  },
  requestId: {
    type: String,
    default: null,
    index: true
  },
  characterId: {
    type: String,
    required: true,
    index: true
  },
  itemId: {
    type: String,
    required: true,
    index: true
  },
  direction: {
    type: String,
    enum: ['buy', 'sell', 'reversal'],
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 1
  },
  totalPrice: {
    type: Number,
    required: true,
    min: 1
  },
  timestamp: {
    type: String,
    required: true,
    index: true
  },
  reversalOfTransactionId: {
    type: String,
    default: null
  }
}, { _id: false });

const marketOrbitSchema = new mongoose.Schema({
  anchorBodyId: {
    type: String,
    required: true
  },
  anchorBodyName: {
    type: String,
    required: true
  },
  orbitType: {
    type: String,
    enum: ['elliptical', 'circular'],
    required: true,
    default: 'elliptical'
  },
  semiMajorAxisKm: {
    type: Number,
    required: true,
    min: 0
  },
  eccentricity: {
    type: Number,
    required: true,
    min: 0,
    max: 0.99
  },
  inclinationDeg: {
    type: Number,
    required: true,
    default: 0
  },
  longitudeOfAscendingNodeDeg: {
    type: Number,
    required: true,
    default: 0
  },
  argumentOfPeriapsisDeg: {
    type: Number,
    required: true,
    default: 0
  },
  meanAnomalyAtEpochDeg: {
    type: Number,
    required: true,
    default: 0
  },
  orbitalPeriodSec: {
    type: Number,
    required: true,
    min: 1
  },
  epoch: {
    type: String,
    required: true
  }
}, { _id: false });

/**
 * Market schema for market metadata, pricing controls, inventory, and ledger.
 */
const marketSchema = new mongoose.Schema({
  marketId: {
    type: String,
    required: true
  },
  solarSystemId: {
    type: String,
    required: true,
    index: true
  },
  marketName: {
    type: String,
    required: true
  },
  siteType: {
    type: String,
    enum: ['station', 'surface-settlement', 'free-floating'],
    required: true
  },
  siteName: {
    type: String,
    required: true
  },
  spatial: {
    type: spatialStateSchema,
    required: true
  },
  trajectory: {
    kind: {
      type: String,
      enum: ['static', 'orbital-elements'],
      default: null
    },
    orbit: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    _id: false
  },
  isStarterMarket: {
    type: Boolean,
    required: true,
    default: false
  },
  priceMultiplier: {
    type: Number,
    required: true,
    default: 1
  },
  driftPercentPerHour: {
    type: Number,
    required: true,
    default: 0
  },
  restockIntervalMinutes: {
    type: Number,
    required: true,
    default: 60
  },
  lastRestockAt: {
    type: String,
    required: true
  },
  inventory: {
    type: [marketInventoryEntrySchema],
    default: []
  },
  ledger: {
    type: [marketLedgerEntrySchema],
    default: []
  }
}, {
  collection: 'markets'
});

marketSchema.index({ marketId: 1, solarSystemId: 1 }, { unique: true });

const gameStateDocumentSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
    default: {}
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  collection: 'game_state'
});

gameStateDocumentSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
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
const Market = mongoose.model('Market', marketSchema);
const GameStateDocument = mongoose.model('GameStateDocument', gameStateDocumentSchema);

/**
 * Jump gate schema for inter-system routing
 */
const jumpGateSchema = new mongoose.Schema({
  gateId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  sourceSystemId: {
    type: String,
    required: true,
    index: true
  },
  destSystemId: {
    type: String,
    required: true,
    index: true
  },
  traversalCostAu: {
    type: Number,
    required: true,
    min: 0
  },
  traversalTimeHours: {
    type: Number,
    required: true,
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  collection: 'jump_gates'
});

const JumpGate = mongoose.model('JumpGate', jumpGateSchema);

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
