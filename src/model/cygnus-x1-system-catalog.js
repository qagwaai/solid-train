'use strict';

/**
 * Curated Cygnus X-1 system bodies.
 *
 * HYG 97987 / HIP 98298 / HD 226868 identifies the visible stellar companion
 * and the system's catalog anchor. It is not a catalog record for the black hole.
 * These bodies deliberately have no orbitalElements: orientation and orbital
 * phase are not authored from the available source values.
 */

const { SOLAR_MASS_KG } = require('./hyg-star-catalog');
const SOLAR_RADIUS_KM = 695700;

const CYGNUS_X1_BLACK_HOLE = {
  id: 'cygnus-x1-black-hole',
  catalogId: 'cygnus-x1-black-hole',
  catalogIdentity: { namespace: 'cygnus-x1', key: 'black-hole' },
  displayName: 'Cygnus X-1',
  bodyType: 'black-hole',
  surfaceArchetype: 'black-hole',
  parentBodyId: null,
  orbit: null,
  physical: {
    massKg: 21.2 * SOLAR_MASS_KG,
    massSolar: 21.2,
    massUncertaintySolar: 2.2,
    compositionTags: ['black-hole'],
  },
  blackHoleProperties: {
    massSolar: 21.2,
    massUncertaintySolar: 2.2,
    distanceParsec: 2220,
    distanceUncertaintyParsec: 180,
    orbitalPeriodDays: 5.599829,
    relativeBinarySemimajorAxisAU: 0.244,
    eccentricity: 0.0189,
    inclinationDeg: 27.51,
    schwarzschildReferenceRadiusKm: 62.6,
    // Spin is not supplied, so the Kerr event-horizon radius is not inferred.
    eventHorizonRadiusKm: null,
    // The apparent/physical disk boundary is variable and not a body radius.
    visualAccretionDiskOuterRadiusKm: null,
    sourceReferences: [
      'Miller-Jones et al. 2021, Science 372, 1046, doi:10.1126/science.abb3363',
      'Orosz et al. 2011, ApJ 742, 84, doi:10.1088/0004-637X/742/2/84',
      'arXiv:2411.12507, wind-fed accretion context',
    ],
  },
  atmosphere: null,
  discovery: {
    discoveredBy: 'Uhuru X-ray astronomy mission',
    discoveredYear: 1964,
    discoveryNotes: 'Stellar-mass black hole in the Cygnus X-1 X-ray binary.',
  },
  magnitudes: null,
  visualization: { colorHex: '#111827', textureKey: 'black-hole' },
};

const CYGNUS_X1_HD226868 = {
  id: 'cygnus-x1-hd226868',
  catalogId: 'cygnus-x1-hd226868',
  catalogIdentity: { namespace: 'cygnus-x1', key: 'hd226868' },
  displayName: 'HD 226868',
  bodyType: 'star',
  surfaceArchetype: 'star',
  hygId: '97987',
  hipId: '98298',
  hdId: '226868',
  spectralClass: 'O',
  luminositySolar: null,
  parentBodyId: 'cygnus-x1-black-hole',
  orbit: null,
  physical: {
    massKg: 40.6 * SOLAR_MASS_KG,
    massSolar: 40.6,
    massUncertaintySolar: 7.7,
    meanRadiusKm: 22.3 * SOLAR_RADIUS_KM,
    meanTemperatureK: 31138,
    compositionTags: ['hydrogen', 'helium', 'plasma'],
    sourceReferences: [
      'Miller-Jones et al. 2021, Science 372, 1046, doi:10.1126/science.abb3363',
    ],
  },
  atmosphere: {
    hasAtmosphere: true,
    surfacePressurePa: null,
    primaryComponents: ['hydrogen', 'helium'],
  },
  discovery: {
    discoveredBy: null,
    discoveredYear: null,
    discoveryNotes: 'Visible stellar companion and HYG/Hipparcos/HD system anchor.',
  },
  magnitudes: null,
  visualization: { colorHex: '#9ab7ff', spectralClass: 'O', textureKey: 'star' },
};

const CYGNUS_X1_CATALOG = [CYGNUS_X1_BLACK_HOLE, CYGNUS_X1_HD226868];

module.exports = {
  CYGNUS_X1_CATALOG,
  CYGNUS_X1_BLACK_HOLE,
  CYGNUS_X1_HD226868,
};
