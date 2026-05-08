'use strict';

function createJumpGateModelArtifacts({ mongoose }) {
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

  return {
    JumpGate,
    jumpGateSchema
  };
}

module.exports = {
  createJumpGateModelArtifacts
};
