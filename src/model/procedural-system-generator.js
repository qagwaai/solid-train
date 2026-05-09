'use strict';

/**
 * Procedural solar system body generator.
 *
 * Produces a deterministic set of celestial bodies (a star + planets, optionally
 * moons) for an HYG star system. Determinism is keyed by the HYG id (or any
 * provided seed), so the same system always generates the same bodies.
 *
 * Generation rules (game-grade, not physical):
 *   - Number of planets driven by spectral class.
 *   - Habitable-zone center scaled by sqrt(luminosity).
 *   - Semi-major axes use a Titius-Bode-like geometric progression jittered
 *     by the seeded RNG.
 *   - Planet types (rocky / gas / ice) chosen from per-class distributions.
 */

const { SOLAR_MASS_KG, SOLAR_RADIUS_KM } = require('./hyg-star-catalog');

const AU_KM = 149_597_870.7;
const SECONDS_PER_DAY = 86400;
const G_GRAV = 6.6743e-11; // m^3 kg^-1 s^-2
const J2000_EPOCH = '2000-01-01T12:00:00.000Z';

const PROCEDURAL_SEED_VERSION = '2026-05-procedural-v1';

/**
 * mulberry32 - small fast deterministic PRNG. Seed must be a uint32.
 */
function createSeededRandom(seed) {
  let state = (Number(seed) || 1) >>> 0;
  if (state === 0) state = 0x9e3779b9;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStringToSeed(value) {
  let hash = 2166136261 >>> 0;
  for (const ch of String(value || '')) {
    hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619);
  }
  return hash >>> 0;
}

function pickRange(rng, lo, hi) {
  return lo + (hi - lo) * rng();
}

function pickInt(rng, lo, hi) {
  return Math.floor(lo + (hi - lo + 1) * rng());
}

function spectralClassPlanetCount(spectralClass, rng) {
  const ranges = {
    O: [0, 2],
    B: [0, 3],
    A: [1, 4],
    F: [2, 6],
    G: [3, 8],
    K: [3, 7],
    M: [1, 5],
    L: [0, 2],
    T: [0, 1],
    Y: [0, 1],
  };
  const [lo, hi] = ranges[spectralClass] || ranges.G;
  return pickInt(rng, lo, hi);
}

/**
 * Habitable zone center in AU using L_sol scaling: ~sqrt(L) * 1 AU.
 */
function habitableZoneAu(luminositySolar) {
  const lum = Number.isFinite(luminositySolar) && luminositySolar > 0 ? luminositySolar : 1;
  return Math.sqrt(lum);
}

function classifyPlanet(rng, semiMajorAxisAu, hzCenterAu) {
  const ratio = semiMajorAxisAu / Math.max(0.01, hzCenterAu);
  if (ratio < 0.4) return rng() < 0.7 ? 'rocky' : 'lava';
  if (ratio < 1.5) return rng() < 0.8 ? 'rocky' : 'ocean';
  if (ratio < 4) return rng() < 0.5 ? 'gas-giant' : 'rocky';
  return rng() < 0.6 ? 'ice-giant' : 'gas-giant';
}

function planetPhysical(planetType, rng) {
  switch (planetType) {
    case 'lava':
      return {
        massKg: pickRange(rng, 1e23, 6e24),
        meanRadiusKm: pickRange(rng, 1500, 7000),
        meanTemperatureK: pickRange(rng, 700, 1500),
        compositionTags: ['silicate', 'lava', 'iron-core'],
        textureColor: '#c84a2c',
      };
    case 'ocean':
      return {
        massKg: pickRange(rng, 5e23, 8e24),
        meanRadiusKm: pickRange(rng, 4000, 8500),
        meanTemperatureK: pickRange(rng, 250, 320),
        compositionTags: ['water', 'silicate'],
        textureColor: '#3a7ad6',
      };
    case 'gas-giant':
      return {
        massKg: pickRange(rng, 5e26, 3e27),
        meanRadiusKm: pickRange(rng, 40000, 75000),
        meanTemperatureK: pickRange(rng, 110, 200),
        compositionTags: ['hydrogen', 'helium', 'gas-giant'],
        textureColor: '#d2a679',
      };
    case 'ice-giant':
      return {
        massKg: pickRange(rng, 5e25, 1.2e26),
        meanRadiusKm: pickRange(rng, 18000, 28000),
        meanTemperatureK: pickRange(rng, 50, 90),
        compositionTags: ['hydrogen', 'methane', 'ice-giant'],
        textureColor: '#7fbedc',
      };
    case 'rocky':
    default:
      return {
        massKg: pickRange(rng, 1e23, 8e24),
        meanRadiusKm: pickRange(rng, 1800, 7500),
        meanTemperatureK: pickRange(rng, 180, 320),
        compositionTags: ['silicate', 'iron-core'],
        textureColor: '#9b7b5a',
      };
  }
}

function orbitalPeriodSecFromAu(semiMajorAxisAu, starMassKg) {
  const a = semiMajorAxisAu * AU_KM * 1000;
  const mu = G_GRAV * starMassKg;
  if (mu <= 0) return SECONDS_PER_DAY * 365.25;
  return 2 * Math.PI * Math.sqrt((a * a * a) / mu);
}

/**
 * Compose celestial body documents for a star system from HYG stars + procedural planets.
 *
 * @param {Object} options
 * @param {string} options.solarSystemId - canonical lowercase id used in spatial.solarSystemId
 * @param {Array<Object>} options.stars - HYG star records belonging to the system
 * @param {string} options.asOfTimestamp
 * @param {number} [options.seed] - optional explicit seed (defaults to first star's hygId)
 * @returns {{ stars: Array, planets: Array }}
 */
function generateSystemBodies(options) {
  const solarSystemId = String(options.solarSystemId || '').toLowerCase();
  const asOfTimestamp = options.asOfTimestamp || J2000_EPOCH;
  const stars = Array.isArray(options.stars) ? options.stars : [];
  if (stars.length === 0 || !solarSystemId) {
    return { stars: [], planets: [] };
  }

  const primary = stars[0];
  const seedSource =
    options.seed !== undefined && options.seed !== null
      ? options.seed
      : Number(primary.hygId) || hashStringToSeed(primary.hygId || solarSystemId);
  const rng = createSeededRandom(seedSource);

  const starBodies = stars.map((star, index) => {
    const starId = `${solarSystemId}-star-${star.systemRole || `s${index}`}`;
    return {
      id: starId,
      hygId: star.hygId || null,
      catalogId: starId,
      bodyType: 'star',
      displayName:
        star.properName || `${primary.properName || solarSystemId} ${star.systemRole || ''}`.trim(),
      parentBodyId: index === 0 ? null : `${solarSystemId}-star-primary`,
      // Non-primary stars: place at a wide stable separation. Real binary
      // orbits are out-of-scope for this iteration; we use a large
      // constant offset so the UI can render multiple stars.
      orbit:
        index === 0
          ? null
          : {
              semiMajorAxisKm: AU_KM * (index === 1 ? 23 : 8700), // α Cen B ~23 AU; Proxima ~8700 AU
              eccentricity: index === 1 ? 0.5179 : 0.5,
              inclinationDeg: 79.2,
              longitudeOfAscendingNodeDeg: 204.85,
              argumentOfPeriapsisDeg: 232.0,
              meanAnomalyAtEpochDeg: 0,
              orbitalPeriodSec: orbitalPeriodSecFromAu(
                index === 1 ? 23 : 8700,
                (primary.massKg || SOLAR_MASS_KG) + (star.massKg || SOLAR_MASS_KG)
              ),
              epoch: J2000_EPOCH,
            },
      physical: {
        massKg: star.massKg || SOLAR_MASS_KG,
        meanRadiusKm: star.radiusKm || SOLAR_RADIUS_KM,
        equatorialRadiusKm: star.radiusKm || SOLAR_RADIUS_KM,
        rotationPeriodSec: SECONDS_PER_DAY * 25,
        axialTiltDeg: 0,
        surfaceGravityMps2: 274,
        meanTemperatureK: 5778,
        compositionTags: ['hydrogen', 'helium', 'plasma'],
      },
      atmosphere: {
        hasAtmosphere: true,
        surfacePressurePa: null,
        primaryComponents: ['hydrogen', 'helium'],
      },
      discovery: {
        discoveredBy: 'HYG catalog',
        discoveredYear: null,
        discoveryNotes: star.spectralType || null,
      },
      magnitudes: {
        absoluteMagnitudeH: star.absoluteMagnitude ?? null,
        apparentMagnitudeMin: star.apparentMagnitude ?? null,
        apparentMagnitudeMax: star.apparentMagnitude ?? null,
      },
      visualization: {
        colorHex: star.colorHex || '#ffffff',
        spectralClass: star.spectralClass,
        textureKey: `star-${(star.spectralClass || 'g').toLowerCase()}`,
      },
    };
  });

  const planetCount = spectralClassPlanetCount(primary.spectralClass, rng);
  const hzCenter = habitableZoneAu(primary.luminositySolar);
  const planets = [];
  // Titius-Bode-like progression: a_n = base * factor^n with jitter.
  const base = Math.max(0.05, hzCenter * pickRange(rng, 0.3, 0.5));
  const factor = pickRange(rng, 1.6, 2.1);

  for (let i = 0; i < planetCount; i += 1) {
    const a = base * Math.pow(factor, i) * pickRange(rng, 0.85, 1.15);
    const planetType = classifyPlanet(rng, a, hzCenter);
    const phys = planetPhysical(planetType, rng);
    const eccentricity = pickRange(rng, 0, 0.15);
    const inclination = pickRange(rng, 0, 5);
    const periodSec = orbitalPeriodSecFromAu(a, primary.massKg || SOLAR_MASS_KG);
    const planetId = `${solarSystemId}-planet-${i + 1}`;
    planets.push({
      id: planetId,
      catalogId: planetId,
      bodyType: 'planet',
      displayName: `${primary.properName || solarSystemId} ${romanNumeral(i + 1)}`,
      parentBodyId: starBodies[0].id,
      planetType,
      orbit: {
        semiMajorAxisKm: a * AU_KM,
        eccentricity,
        inclinationDeg: inclination,
        longitudeOfAscendingNodeDeg: pickRange(rng, 0, 360),
        argumentOfPeriapsisDeg: pickRange(rng, 0, 360),
        meanAnomalyAtEpochDeg: pickRange(rng, 0, 360),
        orbitalPeriodSec: periodSec,
        epoch: J2000_EPOCH,
      },
      physical: {
        massKg: phys.massKg,
        meanRadiusKm: phys.meanRadiusKm,
        rotationPeriodSec: SECONDS_PER_DAY * pickRange(rng, 0.4, 50),
        axialTiltDeg: pickRange(rng, 0, 30),
        surfaceGravityMps2:
          (G_GRAV * phys.massKg) / Math.pow(phys.meanRadiusKm * 1000, 2) || null,
        meanTemperatureK: phys.meanTemperatureK,
        compositionTags: phys.compositionTags,
      },
      atmosphere: {
        hasAtmosphere: planetType !== 'lava',
        surfacePressurePa: null,
        primaryComponents: phys.compositionTags,
      },
      discovery: {
        discoveredBy: 'procedural',
        discoveredYear: null,
        discoveryNotes: `Generated for system ${solarSystemId}`,
      },
      magnitudes: {
        absoluteMagnitudeH: null,
        apparentMagnitudeMin: null,
        apparentMagnitudeMax: null,
      },
      visualization: {
        colorHex: phys.textureColor,
        textureKey: `planet-${planetType}`,
      },
    });
  }

  return {
    stars: starBodies,
    planets,
    asOfTimestamp,
    seed: seedSource >>> 0,
    seedVersion: PROCEDURAL_SEED_VERSION,
    habitableZoneCenterAu: hzCenter,
  };
}

function romanNumeral(n) {
  const map = [
    ['M', 1000],
    ['CM', 900],
    ['D', 500],
    ['CD', 400],
    ['C', 100],
    ['XC', 90],
    ['L', 50],
    ['XL', 40],
    ['X', 10],
    ['IX', 9],
    ['V', 5],
    ['IV', 4],
    ['I', 1],
  ];
  let value = n;
  let out = '';
  for (const [sym, val] of map) {
    while (value >= val) {
      out += sym;
      value -= val;
    }
  }
  return out;
}

module.exports = {
  AU_KM,
  G_GRAV,
  J2000_EPOCH,
  PROCEDURAL_SEED_VERSION,
  createSeededRandom,
  hashStringToSeed,
  generateSystemBodies,
  habitableZoneAu,
  spectralClassPlanetCount,
};
