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
      starId: { type: String, default: null },
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
      // Derived NFC/case-normalized labels used only for literal substring search.
      searchTerms: { type: [String], default: [] },
      settlementName: { type: String, default: null },
      aliases: { type: [String], default: [] },
      hygSystemId: { type: String, default: null, index: true },
      catalogName: { type: String, default: null },
      source: {
        type: String,
        enum: ['curated', 'procedural', 'exoplanet-catalog'],
        required: true,
        default: 'procedural',
        index: true,
      },
      isMultiStar: { type: Boolean, default: false },
      starCount: { type: Number, default: 1 },
      declaredStarCount: { type: Number, default: null },
      planetCount: { type: Number, default: 0 },
      moonCount: { type: Number, default: 0 },
      asteroidCount: { type: Number, default: 0 },
      distanceApproximate: { type: Boolean, default: false },
      catalogSnapshotDate: { type: String, default: null },
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
