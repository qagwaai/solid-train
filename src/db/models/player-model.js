'use strict';

function createPlayerModelArtifacts({ mongoose, shipSchema, missionSchema }) {
  const characterBustSchema = new mongoose.Schema(
    {
      schemaVersion: {
        type: String,
        enum: ['sw-15-m1-v1'],
        required: true,
      },
      presetVersion: {
        type: String,
        required: true,
      },
      faceShape: {
        type: String,
        required: true,
      },
      skinTone: {
        type: String,
        required: true,
      },
      hairStyle: {
        type: String,
        required: true,
      },
      hairColor: {
        type: String,
        required: true,
      },
      eyeStyle: {
        type: String,
        required: true,
      },
      eyeColor: {
        type: String,
        required: true,
      },
      expressionPreset: {
        type: String,
        required: true,
      },
      apparelAccent: {
        type: String,
        required: true,
      },
      facialHair: {
        type: String,
        required: true,
      },
      scar: {
        type: String,
        required: true,
      },
      tattoo: {
        type: String,
        required: true,
      },
    },
    {
      _id: false,
      strict: true,
    }
  );

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
      bust: {
        type: characterBustSchema,
        default: null,
      },
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

  playerSchema.pre('save', function () {
    this.updatedAt = new Date();
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
