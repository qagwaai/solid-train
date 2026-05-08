'use strict';

function createGameStateModelArtifacts({ mongoose }) {
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

  const GameStateDocument = mongoose.model('GameStateDocument', gameStateDocumentSchema);

  return {
    GameStateDocument,
    gameStateDocumentSchema
  };
}

module.exports = {
  createGameStateModelArtifacts
};
