'use strict';

function createPlayerModelArtifacts({ mongoose, shipSchema, missionSchema }) {
  const creditLedgerEntrySchema = new mongoose.Schema(
    {
      type: {
        type: String,
        enum: ['put', 'take'],
        required: true,
      },
      amount: {
        type: Number,
        required: true,
      },
      description: {
        type: String,
        required: true,
      },
      timestamp: {
        type: String,
        required: true,
      },
      referenceId: {
        type: String,
        default: null,
      },
    },
    { _id: false }
  );

  const characterSchema = new mongoose.Schema(
    {
      id: {
        type: String,
        required: true,
      },
      characterName: {
        type: String,
        required: true,
      },
      createdAt: {
        type: String,
        required: true,
      },
      ships: [shipSchema],
      missions: [missionSchema],
      creditLedger: [creditLedgerEntrySchema],
    },
    { _id: false }
  );

  const playerSchema = new mongoose.Schema({
    playerId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    playerName: {
      type: String,
      required: true,
    },
    playerNameNormalized: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    preferredLocale: {
      type: String,
      enum: ['en', 'it'],
      required: true,
      default: 'en',
    },
    sessionKey: {
      type: String,
      default: null,
    },
    socketId: {
      type: String,
      default: null,
    },
    characters: [characterSchema],
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  });

  playerSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
  });

  const Player = mongoose.model('Player', playerSchema);

  return {
    Player,
    playerSchema,
    characterSchema,
    creditLedgerEntrySchema,
  };
}

module.exports = {
  createPlayerModelArtifacts,
};
