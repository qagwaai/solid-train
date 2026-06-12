'use strict';

const mongoose = require('mongoose');

function createMarketListingModelArtifacts({
  mongooseInstance = mongoose,
} = {}) {
  const marketListingOwnershipSchema = new mongooseInstance.Schema(
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

  const marketListingActorSchema = new mongooseInstance.Schema(
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

  const marketListingSchema = new mongooseInstance.Schema(
    {
      id: {
        type: String,
        required: true,
        index: true,
      },
      marketId: {
        type: String,
        required: true,
        index: true,
      },
      solarSystemId: {
        type: String,
        required: true,
        index: true,
      },
      owner: {
        type: marketListingOwnershipSchema,
        required: true,
      },
      itemId: {
        type: String,
        required: true,
        index: true,
      },
      quantity: {
        type: Number,
        required: true,
        min: 1,
      },
      listingPrice: {
        type: Number,
        required: true,
        min: 0,
      },
      status: {
        type: String,
        enum: ['active', 'expired', 'sold', 'cancelled'],
        default: 'active',
      },
      createdAt: {
        type: Date,
        required: true,
        index: true,
      },
      expiresAt: {
        type: Date,
        required: true,
        index: true,
      },
      createdBy: {
        type: marketListingActorSchema,
        required: true,
      },
    },
    {
      collection: 'market_listings',
      timestamps: true,
    }
  );

  const MarketListing = mongooseInstance.model('MarketListing', marketListingSchema);

  return {
    MarketListing,
    marketListingSchema,
    marketListingOwnershipSchema,
    marketListingActorSchema,
  };
}

module.exports = {
  createMarketListingModelArtifacts,
};
