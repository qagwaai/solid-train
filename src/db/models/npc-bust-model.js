'use strict';

function createNpcBustModelArtifacts({ mongoose }) {
  const npcBustDescriptorSchema = new mongoose.Schema(
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

  const npcBustSchema = new mongoose.Schema({
    npcId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    deterministicSeed: {
      type: String,
      required: true,
    },
    descriptor: {
      type: npcBustDescriptorSchema,
      required: true,
    },
    appliedOverrides: {
      type: [String],
      default: [],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  });

  npcBustSchema.pre('save', function () {
    this.updatedAt = new Date();
  });

  const NpcBust = mongoose.model('NpcBust', npcBustSchema);

  return {
    NpcBust,
    npcBustSchema,
    npcBustDescriptorSchema,
  };
}

module.exports = {
  createNpcBustModelArtifacts,
};
