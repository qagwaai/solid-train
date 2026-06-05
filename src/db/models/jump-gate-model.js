'use strict';

function createJumpGateModelArtifacts({ mongoose }) {
  const jumpGateSchema = new mongoose.Schema(
    {
      gateId: {
        type: String,
        required: true,
        unique: true,
        index: true,
      },
      sourceSystemId: {
        type: String,
        required: true,
        index: true,
      },
      destSystemId: {
        type: String,
        required: true,
        index: true,
      },
      traversalCostAu: {
        type: Number,
        required: true,
        min: 0,
      },
      traversalTimeHours: {
        type: Number,
        required: true,
        min: 0,
      },
      spatial: {
        type: new mongoose.Schema(
          {
            solarSystemId: {
              type: String,
              required: true,
            },
            frame: {
              type: String,
              enum: ['barycentric'],
              required: true,
            },
            positionKm: {
              type: new mongoose.Schema(
                {
                  x: { type: Number, required: true },
                  y: { type: Number, required: true },
                  z: { type: Number, required: true },
                },
                { _id: false }
              ),
              required: true,
            },
            epochMs: {
              type: Number,
              required: true,
            },
          },
          { _id: false }
        ),
        default: null,
      },
      isActive: {
        type: Boolean,
        default: true,
      },
    },
    {
      collection: 'jump_gates',
    }
  );

  const JumpGate = mongoose.model('JumpGate', jumpGateSchema);

  return {
    JumpGate,
    jumpGateSchema,
  };
}

module.exports = {
  createJumpGateModelArtifacts,
};
