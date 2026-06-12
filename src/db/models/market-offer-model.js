'use strict';

const mongoose = require('mongoose');

const marketOfferOwnershipSchema = new mongoose.Schema({
  ownerType: {
    type: String,
    enum: ['player-character', 'npc-pirate', 'unowned', 'unknown'],
    required: true,
  },
  playerId: { type: String, default: null },
  characterId: { type: String, default: null },
  npcId: { type: String, default: null },
  factionId: { type: String, default: null },
}, { _id: false });

const marketOfferActorSchema = new mongoose.Schema({
  playerId: { type: String, required: true },
  characterId: { type: String, required: true },
}, { _id: false });

const tradeHistoryEntrySchema = new mongoose.Schema({
  at: { type: Date, required: true },
  offerId: { type: String, required: true },
  listingOwner: { type: marketOfferOwnershipSchema, required: true },
  offerorOwner: { type: marketOfferOwnershipSchema, required: true },
  acceptorCharacterId: { type: String, required: true },
}, { _id: false });

const marketOfferSchema = new mongoose.Schema({
  offerId: { type: String, required: true, unique: true, index: true },
  listingId: { type: String, required: true, index: true },
  offerorOwner: { type: marketOfferOwnershipSchema, required: true },
  createdBy: { type: marketOfferActorSchema, required: true },
  offerPrice: { type: Number, required: true },
  quantity: { type: Number, required: true },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'expired'],
    default: 'pending',
    index: true,
  },
  createdAt: { type: Date, default: Date.now, index: true },
  acceptedAt: { type: Date, default: null },
  tradeHistory: { type: tradeHistoryEntrySchema, default: null },
});

const MarketOffer = mongoose.model('MarketOffer', marketOfferSchema);

module.exports = {
  MarketOffer,
  marketOfferOwnershipSchema,
  marketOfferActorSchema,
  tradeHistoryEntrySchema,
};
