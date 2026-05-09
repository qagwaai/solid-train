'use strict';

/**
 * Curated catalog for the Alpha Centauri system.
 *
 * Alpha Centauri is a triple-star system:
 *   - Alpha Centauri A (G2V), HIP 71683
 *   - Alpha Centauri B (K1V), HIP 71681  (orbits A; semi-major axis ~23 AU,
 *     orbital period ~79.91 yr, eccentricity ~0.5179)
 *   - Proxima Centauri (M5.5Ve), HIP 70890  (very wide orbit ~8700 AU around
 *     the AB barycenter, period ~547,000 yr)
 *
 * Confirmed / strongly-suspected planets included:
 *   - Proxima b: ~1.07 M_earth, 0.04856 AU, 11.186 d, in habitable zone of Proxima.
 *   - Proxima c: ~7 M_earth, ~1.49 AU, ~5.28 yr, super-Earth/mini-Neptune candidate.
 *   - Proxima d: ~0.26 M_earth, ~0.029 AU, 5.122 d, sub-Earth candidate.
 *
 * (Alpha Cen A b "Candidate 1" remains tentative; not included here.)
 *
 * Output is the same shape as src/model/sol-system-catalog.js entries so the
 * existing seed pipeline (computeAbsolutePositionKm, buildCelestialBodyDocument)
 * can consume it.
 */

const { AU_KM, J2000_EPOCH } = require('./sol-system-catalog');
const { SOLAR_MASS_KG, SOLAR_RADIUS_KM } = require('./hyg-star-catalog');

const SECONDS_PER_DAY = 86400;
const SECONDS_PER_YEAR = 365.25 * SECONDS_PER_DAY;

function days(value) {
  return value * SECONDS_PER_DAY;
}

function years(value) {
  return value * SECONDS_PER_YEAR;
}

function au(value) {
  return value * AU_KM;
}

const ALPHA_CEN_A = {
  id: 'alpha-centauri-star-primary',
  hygId: '71456',
  hipId: '71683',
  displayName: 'Alpha Centauri A',
  bodyType: 'star',
  parentBodyId: null,
  orbit: null,
  physical: {
    massKg: 1.0788 * SOLAR_MASS_KG,
    meanRadiusKm: 1.2175 * SOLAR_RADIUS_KM,
    equatorialRadiusKm: 1.2175 * SOLAR_RADIUS_KM,
    rotationPeriodSec: days(22),
    axialTiltDeg: 0,
    surfaceGravityMps2: 274,
    meanTemperatureK: 5790,
    compositionTags: ['hydrogen', 'helium', 'plasma'],
  },
  atmosphere: { hasAtmosphere: true, surfacePressurePa: null, primaryComponents: ['hydrogen', 'helium'] },
  discovery: {
    discoveredBy: 'Jacques de Mailly / Nicolas Louis de Lacaille',
    discoveredYear: 1689,
    discoveryNotes: 'Resolved as a binary in 1689; nearest sun-like star system.',
  },
  magnitudes: {
    absoluteMagnitudeH: 4.38,
    apparentMagnitudeMin: -0.01,
    apparentMagnitudeMax: -0.01,
  },
  visualization: { colorHex: '#fff2c0', spectralClass: 'G', textureKey: 'star-g' },
};

const ALPHA_CEN_B = {
  id: 'alpha-centauri-star-secondary',
  hygId: '71460',
  hipId: '71681',
  displayName: 'Alpha Centauri B',
  bodyType: 'star',
  parentBodyId: 'alpha-centauri-star-primary',
  orbit: {
    semiMajorAxisKm: au(23.52),
    eccentricity: 0.5179,
    inclinationDeg: 79.205,
    longitudeOfAscendingNodeDeg: 204.85,
    argumentOfPeriapsisDeg: 232.0,
    meanAnomalyAtEpochDeg: 0,
    orbitalPeriodSec: years(79.91),
    epoch: J2000_EPOCH,
  },
  physical: {
    massKg: 0.9092 * SOLAR_MASS_KG,
    meanRadiusKm: 0.8591 * SOLAR_RADIUS_KM,
    equatorialRadiusKm: 0.8591 * SOLAR_RADIUS_KM,
    rotationPeriodSec: days(41),
    axialTiltDeg: 0,
    surfaceGravityMps2: 274,
    meanTemperatureK: 5260,
    compositionTags: ['hydrogen', 'helium', 'plasma'],
  },
  atmosphere: { hasAtmosphere: true, surfacePressurePa: null, primaryComponents: ['hydrogen', 'helium'] },
  discovery: { discoveredBy: 'Jacques de Mailly', discoveredYear: 1689, discoveryNotes: null },
  magnitudes: { absoluteMagnitudeH: 5.71, apparentMagnitudeMin: 1.35, apparentMagnitudeMax: 1.35 },
  visualization: { colorHex: '#ffd07a', spectralClass: 'K', textureKey: 'star-k' },
};

const PROXIMA = {
  id: 'alpha-centauri-star-tertiary',
  hygId: '70890',
  hipId: '70890',
  displayName: 'Proxima Centauri',
  bodyType: 'star',
  parentBodyId: 'alpha-centauri-star-primary',
  orbit: {
    semiMajorAxisKm: au(8700),
    eccentricity: 0.5,
    inclinationDeg: 107.6,
    longitudeOfAscendingNodeDeg: 126.0,
    argumentOfPeriapsisDeg: 72.3,
    meanAnomalyAtEpochDeg: 0,
    orbitalPeriodSec: years(547000),
    epoch: J2000_EPOCH,
  },
  physical: {
    massKg: 0.1221 * SOLAR_MASS_KG,
    meanRadiusKm: 0.1542 * SOLAR_RADIUS_KM,
    equatorialRadiusKm: 0.1542 * SOLAR_RADIUS_KM,
    rotationPeriodSec: days(82.6),
    axialTiltDeg: 0,
    surfaceGravityMps2: 274,
    meanTemperatureK: 3042,
    compositionTags: ['hydrogen', 'helium', 'plasma', 'flare-star'],
  },
  atmosphere: { hasAtmosphere: true, surfacePressurePa: null, primaryComponents: ['hydrogen', 'helium'] },
  discovery: {
    discoveredBy: 'Robert Innes',
    discoveredYear: 1915,
    discoveryNotes: 'Closest known star to the Sun.',
  },
  magnitudes: { absoluteMagnitudeH: 15.6, apparentMagnitudeMin: 11.13, apparentMagnitudeMax: 11.13 },
  visualization: { colorHex: '#ff7a55', spectralClass: 'M', textureKey: 'star-m' },
};

const EARTH_MASS_KG = 5.97237e24;
const EARTH_RADIUS_KM = 6371;

const PROXIMA_B = {
  id: 'alpha-centauri-proxima-b',
  catalogId: 'alpha-centauri-proxima-b',
  displayName: 'Proxima Centauri b',
  bodyType: 'planet',
  parentBodyId: 'alpha-centauri-star-tertiary',
  planetType: 'rocky',
  orbit: {
    semiMajorAxisKm: au(0.04856),
    eccentricity: 0.109,
    inclinationDeg: 0,
    longitudeOfAscendingNodeDeg: 0,
    argumentOfPeriapsisDeg: 310,
    meanAnomalyAtEpochDeg: 0,
    orbitalPeriodSec: days(11.1868),
    epoch: J2000_EPOCH,
  },
  physical: {
    massKg: 1.07 * EARTH_MASS_KG,
    meanRadiusKm: 1.08 * EARTH_RADIUS_KM,
    rotationPeriodSec: days(11.1868), // tidally locked
    axialTiltDeg: 0,
    surfaceGravityMps2: 9.31,
    meanTemperatureK: 234,
    compositionTags: ['silicate', 'iron-core'],
  },
  atmosphere: { hasAtmosphere: false, surfacePressurePa: null, primaryComponents: [] },
  discovery: {
    discoveredBy: 'Pale Red Dot collaboration',
    discoveredYear: 2016,
    discoveryNotes: 'In Proxima\'s habitable zone; tidally locked candidate.',
  },
  magnitudes: { absoluteMagnitudeH: null, apparentMagnitudeMin: null, apparentMagnitudeMax: null },
  visualization: { colorHex: '#9b7b5a', textureKey: 'planet-rocky' },
};

const PROXIMA_C = {
  id: 'alpha-centauri-proxima-c',
  catalogId: 'alpha-centauri-proxima-c',
  displayName: 'Proxima Centauri c',
  bodyType: 'planet',
  parentBodyId: 'alpha-centauri-star-tertiary',
  planetType: 'ice-giant',
  orbit: {
    semiMajorAxisKm: au(1.489),
    eccentricity: 0.04,
    inclinationDeg: 0,
    longitudeOfAscendingNodeDeg: 0,
    argumentOfPeriapsisDeg: 0,
    meanAnomalyAtEpochDeg: 0,
    orbitalPeriodSec: years(5.28),
    epoch: J2000_EPOCH,
  },
  physical: {
    massKg: 7 * EARTH_MASS_KG,
    meanRadiusKm: 1.5 * EARTH_RADIUS_KM,
    rotationPeriodSec: days(20),
    axialTiltDeg: 5,
    surfaceGravityMps2: 12.5,
    meanTemperatureK: 39,
    compositionTags: ['ice', 'silicate'],
  },
  atmosphere: { hasAtmosphere: true, surfacePressurePa: null, primaryComponents: ['hydrogen', 'methane'] },
  discovery: {
    discoveredBy: 'Damasso et al.',
    discoveredYear: 2019,
    discoveryNotes: 'Super-Earth / mini-Neptune candidate beyond the snow line.',
  },
  magnitudes: { absoluteMagnitudeH: null, apparentMagnitudeMin: null, apparentMagnitudeMax: null },
  visualization: { colorHex: '#7fbedc', textureKey: 'planet-ice-giant' },
};

const PROXIMA_D = {
  id: 'alpha-centauri-proxima-d',
  catalogId: 'alpha-centauri-proxima-d',
  displayName: 'Proxima Centauri d',
  bodyType: 'planet',
  parentBodyId: 'alpha-centauri-star-tertiary',
  planetType: 'rocky',
  orbit: {
    semiMajorAxisKm: au(0.02885),
    eccentricity: 0.04,
    inclinationDeg: 0,
    longitudeOfAscendingNodeDeg: 0,
    argumentOfPeriapsisDeg: 0,
    meanAnomalyAtEpochDeg: 90,
    orbitalPeriodSec: days(5.122),
    epoch: J2000_EPOCH,
  },
  physical: {
    massKg: 0.26 * EARTH_MASS_KG,
    meanRadiusKm: 0.65 * EARTH_RADIUS_KM,
    rotationPeriodSec: days(5.122),
    axialTiltDeg: 0,
    surfaceGravityMps2: 6.1,
    meanTemperatureK: 360,
    compositionTags: ['silicate'],
  },
  atmosphere: { hasAtmosphere: false, surfacePressurePa: null, primaryComponents: [] },
  discovery: {
    discoveredBy: 'Faria et al.',
    discoveredYear: 2022,
    discoveryNotes: 'Sub-Earth candidate, very close orbit.',
  },
  magnitudes: { absoluteMagnitudeH: null, apparentMagnitudeMin: null, apparentMagnitudeMax: null },
  visualization: { colorHex: '#c84a2c', textureKey: 'planet-lava' },
};

const ALPHA_CENTAURI_CATALOG = [ALPHA_CEN_A, ALPHA_CEN_B, PROXIMA, PROXIMA_B, PROXIMA_C, PROXIMA_D];

module.exports = {
  ALPHA_CENTAURI_CATALOG,
  ALPHA_CEN_A,
  ALPHA_CEN_B,
  PROXIMA,
  PROXIMA_B,
  PROXIMA_C,
  PROXIMA_D,
};
