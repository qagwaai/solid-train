'use strict';

function createSolarSystemModelArtifacts({ mongoose }) {
  const positionPcSchema = new mongoose.Schema(
    {
      x: { type: Number, required: true, default: 0 },
      y: { type: Number, required: true, default: 0 },
      z: { type: Number, required: true, default: 0 },
    },
    { _id: false }
  );

  const primaryStarSummarySchema = new mongoose.Schema(
    {
      hygId: { type: String, default: null },
      properName: { type: String, default: null },
      spectralClass: { type: String, default: null },
      spectralType: { type: String, default: null },
      colorHex: { type: String, default: null },
      colorIndexBv: { type: Number, default: null },
      luminositySolar: { type: Number, default: null },
      massSolar: { type: Number, default: null },
      radiusSolar: { type: Number, default: null },
      absoluteMagnitude: { type: Number, default: null },
    },
    { _id: false }
  );

  const solarSystemSchema = new mongoose.Schema(
    {
      id: { type: String, required: true, unique: true, index: true },
      displayName: { type: String, required: true },
      hygSystemId: { type: String, default: null, index: true },
      source: {
        type: String,
        enum: ['curated', 'procedural'],
        required: true,
        default: 'procedural',
        index: true,
      },
      isMultiStar: { type: Boolean, default: false },
      starCount: { type: Number, default: 1 },
      positionPc: { type: positionPcSchema, default: () => ({ x: 0, y: 0, z: 0 }) },
      distanceParsec: { type: Number, default: null, index: true },
      primaryStar: { type: primaryStarSummarySchema, default: null },
      generationSeed: { type: Number, default: null },
      seedVersion: { type: String, default: null },
      seededAt: { type: String, default: null },
    },
    {
      collection: 'solar_systems',
      timestamps: true,
    }
  );

  const SolarSystem = mongoose.model('SolarSystem', solarSystemSchema);

  return { SolarSystem, solarSystemSchema };
}

module.exports = {
  createSolarSystemModelArtifacts,
};
