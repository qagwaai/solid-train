'use strict';

function createMarketModelArtifacts({ mongoose, spatialStateSchema }) {
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

  const Market = mongoose.model('Market', marketSchema);

  return {
    Market,
    marketSchema,
    marketInventoryEntrySchema,
    marketLedgerEntrySchema,
    marketOrbitSchema
  };
}

module.exports = {
  createMarketModelArtifacts
};
