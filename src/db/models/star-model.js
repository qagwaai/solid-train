'use strict';

function createStarModelArtifacts({ mongoose }) {
  const positionPcSchema = new mongoose.Schema(
    {
      x: { type: Number, required: true, default: 0 },
      y: { type: Number, required: true, default: 0 },
      z: { type: Number, required: true, default: 0 },
    },
    { _id: false }
  );

  const starSchema = new mongoose.Schema(
    {
      hygId: { type: String, required: true, unique: true, index: true },
      hipId: { type: String, default: null, index: true },
      hdId: { type: String, default: null, index: true },
      properName: { type: String, default: null, index: true },
      raHours: { type: Number, default: null },
      decDeg: { type: Number, default: null },
      distanceParsec: { type: Number, default: null, index: true },
      apparentMagnitude: { type: Number, default: null },
      absoluteMagnitude: { type: Number, default: null },
      spectralType: { type: String, default: null },
      spectralClass: { type: String, default: null, index: true },
      spectralSubclass: { type: Number, default: null },
      colorIndexBv: { type: Number, default: null },
      colorHex: { type: String, default: '#ffffff' },
      luminositySolar: { type: Number, default: null },
      massSolar: { type: Number, default: null },
      radiusSolar: { type: Number, default: null },
      radiusKm: { type: Number, default: null },
      massKg: { type: Number, default: null },
      positionPc: { type: positionPcSchema, default: () => ({ x: 0, y: 0, z: 0 }) },
      systemId: { type: String, required: true, index: true },
      systemRole: { type: String, default: 'primary' },
      sourceCatalog: { type: String, default: 'hyg' },
    },
    {
      collection: 'stars',
      timestamps: true,
    }
  );

  const Star = mongoose.model('Star', starSchema);

  return { Star, starSchema };
}

module.exports = {
  createStarModelArtifacts,
};
