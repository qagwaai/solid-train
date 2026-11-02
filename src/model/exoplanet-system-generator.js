'use strict';

/**
 * Catalog-constrained body generator for exoplanet systems (Phase 4, D38–D44).
 *
 * Builds celestial body entries (stars and planets, never moons) for one
 * system from `data/exoplanet-systems.json` plus resolved star facts and the
 * archive planet records. Catalog values pass through unchanged; every value
 * that had to be estimated or seeded is listed in the body's
 * `approximateFields` so clients can decide how to present it (D40).
 *
 * Seeds are per body and per purpose (`hash("<bodyId>:<purpose>")`), so a
 * value that later arrives from the catalog never shifts any other seeded
 * value. The procedural generator is reused for its RNG and helpers only; its
 * own output and PROCEDURAL_SEED_VERSION are untouched (D44).
 */

const { SOLAR_MASS_KG, SOLAR_RADIUS_KM } = require('./hyg-star-catalog');
const {
  AU_KM,
  G_GRAV,
  J2000_EPOCH,
  classifyPlanet,
  createSeededRandom,
  habitableZoneAu,
  hashStringToSeed,
  orbitalPeriodSecFromAu,
  planetPhysical,
} = require('./procedural-system-generator');

const CATALOG_SEED_VERSION = '2026-11-exoplanet-v1';
const CATALOG_SOURCE = 'exoplanet-catalog';

const EARTH_MASS_KG = 5.9722e24;
const EARTH_RADIUS_KM = 6371.0;
const EARTH_DENSITY_GCM3 = 5.514;
const JUPITER_MASS_EARTH = 317.828;
const SUPER_JUPITER_MASS_EARTH = 13 * JUPITER_MASS_EARTH;
const HOT_TEQ_K = 1000;
const TEMPERATE_TEQ_K = [200, 350];
const DENSE_SUB_NEPTUNE_GCM3 = 3.5;
const ZERO_ALBEDO_TEQ_K = 278.6;
const SUN_TEFF_K = 5772;
const J2000_JD = 2451545.0;
const SECONDS_PER_DAY = 86400;
const ARCSEC_PER_RAD = 206264.806;
const TIDAL_LOCK_AU = 0.1;
const SEEDED_INCLINATION_MAX_DEG = 3;
const ARCHIVE_ESTIMATED_MASS = new Set(['Msini', 'Msin(i)/sin(i)', 'M-R relationship']);

/** Planet archetypes added by D38 on top of the original five. */
const CATALOG_PLANET_ARCHETYPES = Object.freeze([
  'super-earth',
  'sub-neptune',
  'hot-neptune',
  'hot-jupiter',
  'super-jupiter',
]);
const PLANET_ARCHETYPES = Object.freeze([
  'rocky',
  'lava',
  'ocean',
  'gas-giant',
  'ice-giant',
  ...CATALOG_PLANET_ARCHETYPES,
]);

const ARCHETYPE_STYLE = Object.freeze({
  rocky: { tags: ['silicate', 'iron-core'], colorHex: '#9b7b5a', giant: false },
  lava: { tags: ['silicate', 'lava', 'iron-core'], colorHex: '#c84a2c', giant: false },
  ocean: { tags: ['water', 'silicate'], colorHex: '#3a7ad6', giant: false },
  'super-earth': {
    tags: ['silicate', 'iron-core', 'super-earth'],
    colorHex: '#8c6f55',
    giant: false,
  },
  'sub-neptune': {
    tags: ['hydrogen', 'helium', 'water', 'sub-neptune'],
    colorHex: '#8fb8c9',
    giant: true,
  },
  'hot-neptune': { tags: ['hydrogen', 'helium', 'hot-neptune'], colorHex: '#c9a27f', giant: true },
  'ice-giant': { tags: ['hydrogen', 'methane', 'ice-giant'], colorHex: '#7fbedc', giant: true },
  'gas-giant': { tags: ['hydrogen', 'helium', 'gas-giant'], colorHex: '#d2a679', giant: true },
  'hot-jupiter': { tags: ['hydrogen', 'helium', 'hot-jupiter'], colorHex: '#b5523b', giant: true },
  'super-jupiter': {
    tags: ['hydrogen', 'helium', 'super-jupiter'],
    colorHex: '#a8785a',
    giant: true,
  },
});

/** D42: chance of procedural rings per archetype; never at Teq ≥ 1000 K. */
const RING_CHANCE = Object.freeze({
  'gas-giant': 0.3,
  'super-jupiter': 0.3,
  'ice-giant': 0.2,
  'sub-neptune': 0.2,
});
const RING_COLORS = ['#d8c8a8', '#bfb6a3', '#a9a9b8', '#c9b48f', '#8f9fae'];

const STAR_COLORS = Object.freeze({
  O: '#9bb0ff',
  B: '#aabfff',
  A: '#cad7ff',
  F: '#f8f7ff',
  G: '#fff4ea',
  K: '#ffd2a1',
  M: '#ffcc6f',
  L: '#ff9a5a',
  T: '#d9704a',
  Y: '#a8553a',
});

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const positive = (value) => (isNumber(value) && value > 0 ? value : null);
const mod360 = (degrees) => ((degrees % 360) + 360) % 360;
const toRad = (degrees) => (degrees * Math.PI) / 180;
const toDeg = (radians) => (radians * 180) / Math.PI;

function seededRandom(bodyId, purpose) {
  return createSeededRandom(hashStringToSeed(`${bodyId}:${purpose}`));
}

function pickRange(rng, lo, hi) {
  return lo + (hi - lo) * rng();
}

function logUniform(rng, lo, hi) {
  return Math.exp(Math.log(lo) + (Math.log(hi) - Math.log(lo)) * rng());
}

/** Chen and Kipping (2017) mass–radius power laws, R⊕ from M⊕. */
function estimateRadiusEarth(massEarth) {
  const mass = positive(massEarth);
  if (mass === null) {
    return null;
  }
  if (mass < 2.04) {
    return mass ** 0.279;
  }
  const neptunian = (value) => 0.80811 * value ** 0.589;
  if (mass < 131.6) {
    return neptunian(mass);
  }
  return neptunian(131.6) * (mass / 131.6) ** -0.044;
}

/** Zero-albedo equilibrium temperature from insolation in Earth units. */
function teqFromInsolation(insolationEarth) {
  const insolation = positive(insolationEarth);
  return insolation === null ? null : ZERO_ALBEDO_TEQ_K * insolation ** 0.25;
}

function densityGcm3(massEarth, radiusEarth) {
  const mass = positive(massEarth);
  const radius = positive(radiusEarth);
  return mass === null || radius === null ? null : (EARTH_DENSITY_GCM3 * mass) / radius ** 3;
}

/**
 * D39 archetype rules. Returns null when there is no radius, so the caller
 * falls back to the seeded procedural class.
 */
function classifyCatalogPlanet({ radiusEarth, massEarth, teqK, density }) {
  if (positive(massEarth) !== null && massEarth > SUPER_JUPITER_MASS_EARTH) {
    return 'super-jupiter';
  }
  const radius = positive(radiusEarth);
  if (radius === null) {
    return null;
  }
  const hot = isNumber(teqK) && teqK >= HOT_TEQ_K;
  if (radius < 1.25) {
    return hot ? 'lava' : 'rocky';
  }
  if (radius < 2) {
    return hot ? 'lava' : 'super-earth';
  }
  if (radius < 4) {
    if (hot) {
      return 'hot-neptune';
    }
    if (isNumber(density) && density >= DENSE_SUB_NEPTUNE_GCM3) {
      const temperate = isNumber(teqK) && teqK >= TEMPERATE_TEQ_K[0] && teqK <= TEMPERATE_TEQ_K[1];
      return temperate ? 'ocean' : 'super-earth';
    }
    return 'sub-neptune';
  }
  if (radius < 6) {
    return hot ? 'hot-neptune' : 'ice-giant';
  }
  return hot ? 'hot-jupiter' : 'gas-giant';
}

/** Simple main-sequence relations, shared with synthesized companions (D32). */
function mainSequenceFromMass(massSolar) {
  let luminosity;
  if (massSolar < 0.43) {
    luminosity = 0.23 * massSolar ** 2.3;
  } else if (massSolar < 2) {
    luminosity = massSolar ** 4;
  } else {
    luminosity = 1.4 * massSolar ** 3.5;
  }
  const radius = massSolar < 1 ? massSolar ** 0.8 : massSolar ** 0.57;
  const teff = SUN_TEFF_K * (luminosity / radius ** 2) ** 0.25;
  return { luminosity, radius, teff };
}

/** Inverse of mainSequenceFromMass's luminosity relation. */
function massFromLuminosity(luminosity) {
  if (luminosity < 0.23 * 0.43 ** 2.3) {
    return (luminosity / 0.23) ** (1 / 2.3);
  }
  if (luminosity < 16) {
    return luminosity ** 0.25;
  }
  return (luminosity / 1.4) ** (1 / 3.5);
}

function spectralClassForTeff(teff) {
  if (teff >= 30000) return 'O';
  if (teff >= 10000) return 'B';
  if (teff >= 7500) return 'A';
  if (teff >= 6000) return 'F';
  if (teff >= 5200) return 'G';
  if (teff >= 3700) return 'K';
  return 'M';
}

/**
 * Mean anomaly at J2000 (D41), from the periapsis time or else the transit
 * midpoint, where the true anomaly is 90° − ω. Returns null when neither time
 * (or the period) is known.
 */
function meanAnomalyAtJ2000({
  periodDays,
  periapsisTimeJd,
  transitMidpointJd,
  eccentricity = 0,
  argumentOfPeriapsisDeg = 90,
}) {
  const period = positive(periodDays);
  if (period === null) {
    return null;
  }
  if (isNumber(periapsisTimeJd)) {
    return mod360((360 * (J2000_JD - periapsisTimeJd)) / period);
  }
  if (!isNumber(transitMidpointJd)) {
    return null;
  }
  const e = isNumber(eccentricity) && eccentricity >= 0 && eccentricity < 1 ? eccentricity : 0;
  const trueAnomaly = toRad(90 - argumentOfPeriapsisDeg);
  const eccentricAnomaly =
    2 *
    Math.atan2(
      Math.sqrt(1 - e) * Math.sin(trueAnomaly / 2),
      Math.sqrt(1 + e) * Math.cos(trueAnomaly / 2)
    );
  const meanAtTransit = toDeg(eccentricAnomaly - e * Math.sin(eccentricAnomaly));
  return mod360(meanAtTransit + (360 * (J2000_JD - transitMidpointJd)) / period);
}

function median(values) {
  const sorted = values.filter(isNumber).sort((a, b) => a - b);
  if (!sorted.length) {
    return null;
  }
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function angularSeparationArcsec(a, b) {
  const [ra1, dec1, ra2, dec2] = [a.raDeg, a.decDeg, b.raDeg, b.decDeg].map(toRad);
  const sinDec = Math.sin((dec2 - dec1) / 2);
  const sinRa = Math.sin((ra2 - ra1) / 2);
  const h = sinDec ** 2 + Math.cos(dec1) * Math.cos(dec2) * sinRa ** 2;
  return 2 * Math.asin(Math.min(1, Math.sqrt(h))) * ARCSEC_PER_RAD;
}

/** AU = arcsec × pc for small angles. */
function projectedSeparationAu(star, primary) {
  const coordinates = [star.raDeg, star.decDeg, primary.raDeg, primary.decDeg];
  const distancePc = positive(primary.distancePc) ?? positive(star.distancePc);
  if (!coordinates.every(isNumber) || distancePc === null) {
    return null;
  }
  return positive(angularSeparationArcsec(star, primary) * distancePc);
}

/**
 * Completes a star's physics. Missing values come from main-sequence relations
 * and are reported as approximate field paths.
 */
function completeStarFacts(facts) {
  const approximate = [];
  let massSolar = positive(facts.massSolar);
  let radiusSolar = positive(facts.radiusSolar);
  let teffK = positive(facts.teffK);
  let luminosity = isNumber(facts.logLuminositySolar) ? 10 ** facts.logLuminositySolar : null;

  if (massSolar === null) {
    massSolar = luminosity !== null ? massFromLuminosity(luminosity) : 1;
    approximate.push('physical.massKg');
  }
  const mainSequence = mainSequenceFromMass(massSolar);
  if (luminosity === null) {
    luminosity =
      radiusSolar !== null && teffK !== null
        ? radiusSolar ** 2 * (teffK / SUN_TEFF_K) ** 4
        : mainSequence.luminosity;
    approximate.push('luminositySolar');
  }
  if (radiusSolar === null) {
    radiusSolar =
      teffK !== null ? Math.sqrt(luminosity) * (SUN_TEFF_K / teffK) ** 2 : mainSequence.radius;
    approximate.push('physical.meanRadiusKm');
  }
  if (teffK === null) {
    teffK = SUN_TEFF_K * (luminosity / radiusSolar ** 2) ** 0.25;
    approximate.push('physical.meanTemperatureK');
  }
  const typed = typeof facts.spectralType === 'string' ? facts.spectralType.trim()[0] : null;
  const spectralClass =
    typed && STAR_COLORS[typed.toUpperCase()] ? typed.toUpperCase() : spectralClassForTeff(teffK);
  return { massSolar, radiusSolar, teffK, luminosity, spectralClass, approximate };
}

function finalizeApproximate(fields) {
  return [...new Set(fields)].sort();
}

function buildStarBody(
  star,
  facts,
  { parentBodyId = null, orbit = null, orbitApproximate = false }
) {
  const completed = completeStarFacts(facts);
  const approximate = [...completed.approximate];
  if (star.source === 'synthesized' || facts.approximate) {
    approximate.push(
      'physical.massKg',
      'physical.meanRadiusKm',
      'physical.meanTemperatureK',
      'luminositySolar'
    );
  }
  if (orbit && orbitApproximate) {
    approximate.push('orbit');
  }
  approximate.push('physical.rotationPeriodSec');
  const rotationRng = seededRandom(star.starId, 'rotation');
  const massKg = completed.massSolar * SOLAR_MASS_KG;
  const radiusKm = completed.radiusSolar * SOLAR_RADIUS_KM;
  const distancePc = positive(facts.distancePc);
  const vMag = isNumber(facts.vMag) ? facts.vMag : null;
  return {
    id: star.starId,
    catalogId: star.starId,
    bodyType: 'star',
    catalogSource: CATALOG_SOURCE,
    catalogIds: compactObject({
      hostId: star.hostId || null,
      atHygId: star.atHygId || null,
      hygId: facts.hygId || (facts.ids && facts.ids.hygId) || null,
      hipId: (facts.ids && facts.ids.hipId) || null,
      hdId: (facts.ids && facts.ids.hdId) || null,
      gaiaDr3Id: (facts.ids && facts.ids.gaiaDr3Id) || null,
    }),
    hygId: facts.hygId || (facts.ids && facts.ids.hygId) || null,
    spectralClass: completed.spectralClass,
    luminositySolar: completed.luminosity,
    surfaceArchetype: 'star',
    displayName: facts.properName || facts.catalogName || star.starId,
    catalogName: facts.catalogName || null,
    systemRole: star.role || null,
    parentBodyId,
    orbit,
    physical: {
      massKg,
      meanRadiusKm: radiusKm,
      equatorialRadiusKm: radiusKm,
      rotationPeriodSec: SECONDS_PER_DAY * pickRange(rotationRng, 1, 50),
      axialTiltDeg: 0,
      surfaceGravityMps2: (G_GRAV * massKg) / (radiusKm * 1000) ** 2,
      meanTemperatureK: completed.teffK,
      compositionTags: ['hydrogen', 'helium', 'plasma'],
    },
    atmosphere: {
      hasAtmosphere: true,
      surfacePressurePa: null,
      primaryComponents: ['hydrogen', 'helium'],
    },
    discovery: {
      discoveredBy:
        star.source === 'synthesized'
          ? 'synthesized'
          : star.source === 'hyg-companion'
            ? 'AT-HYG catalog'
            : 'NASA Exoplanet Archive',
      discoveredYear: null,
      discoveryNotes: facts.spectralType || null,
    },
    magnitudes: {
      absoluteMagnitudeH:
        vMag !== null && distancePc !== null ? vMag - 5 * Math.log10(distancePc / 10) : null,
      apparentMagnitudeMin: vMag,
      apparentMagnitudeMax: vMag,
    },
    visualization: {
      colorHex: STAR_COLORS[completed.spectralClass] || '#ffffff',
      spectralClass: completed.spectralClass,
      textureKey: `star-${completed.spectralClass.toLowerCase()}`,
    },
    approximateFields: finalizeApproximate(approximate),
  };
}

function compactObject(record) {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== null));
}

function companionOrbit(bodyId, separationAu, massKg, { close = false } = {}) {
  const rng = seededRandom(bodyId, 'orbit');
  return {
    semiMajorAxisKm: separationAu * AU_KM,
    eccentricity: pickRange(rng, 0, close ? 0.2 : 0.5),
    inclinationDeg: pickRange(rng, 0, 10),
    longitudeOfAscendingNodeDeg: pickRange(rng, 0, 360),
    argumentOfPeriapsisDeg: pickRange(rng, 0, 360),
    meanAnomalyAtEpochDeg: pickRange(rng, 0, 360),
    orbitalPeriodSec: orbitalPeriodSecFromAu(separationAu, massKg),
    epoch: J2000_EPOCH,
  };
}

/**
 * D43: which star each non-primary star orbits, and at what separation.
 * Synthesized stars orbit their reference; a star referenced by a synthesized
 * primary orbits that primary at the synthesized separation; other real
 * companions orbit the primary at their projected separation.
 */
function starHierarchy(stars, factsById) {
  const primary = stars[0];
  const links = new Map();
  for (const star of stars.slice(1)) {
    if (star.source === 'synthesized' && star.separationFromStarId) {
      links.set(star.starId, {
        parentId: star.separationFromStarId,
        separationAu: star.separationAu,
        close: star.separationAu < 1,
        seeded: false,
      });
      continue;
    }
    if (primary.source === 'synthesized' && primary.separationFromStarId === star.starId) {
      links.set(star.starId, {
        parentId: primary.starId,
        separationAu: primary.separationAu,
        close: primary.separationAu < 1,
        seeded: false,
      });
      continue;
    }
    const projected = projectedSeparationAu(
      factsById.get(star.starId),
      factsById.get(primary.starId)
    );
    links.set(star.starId, {
      parentId: primary.starId,
      separationAu: projected ?? logUniform(seededRandom(star.starId, 'separation'), 100, 1000),
      close: false,
      seeded: projected === null,
    });
  }
  // A synthesized star whose reference is not the primary still has to reach
  // the primary; a reference that orbits back to it would be a cycle.
  for (const [starId, link] of links) {
    if (link.parentId !== primary.starId && links.get(link.parentId)?.parentId === starId) {
      link.parentId = primary.starId;
    }
  }
  return links;
}

function planetStyle(archetype) {
  return ARCHETYPE_STYLE[archetype] || ARCHETYPE_STYLE.rocky;
}

/** D42 procedural rings, or null. */
function catalogRings({ planetId, archetype, teqK, radiusKm, axialTiltDeg }) {
  const chance = RING_CHANCE[archetype];
  if (!chance || (isNumber(teqK) && teqK >= HOT_TEQ_K)) {
    return null;
  }
  const rng = seededRandom(planetId, 'rings');
  if (rng() >= chance) {
    return null;
  }
  const innerRadiusKm = radiusKm * pickRange(rng, 1.2, 1.6);
  return {
    innerRadiusKm,
    outerRadiusKm: innerRadiusKm * pickRange(rng, 1.5, 2.5),
    tiltDeg: axialTiltDeg,
    colorHex: RING_COLORS[Math.floor(rng() * RING_COLORS.length)],
    opacity: pickRange(rng, 0.3, 0.9),
    approximate: true,
  };
}

function buildPlanetBody(planet, anchor) {
  const id = planet.id;
  const approximate = [];
  const anchorMassKg = anchor.massKg;

  let semiMajorAxisAu = positive(planet.semiMajorAxisAu);
  let periodDays = positive(planet.orbitalPeriodDays);
  if (semiMajorAxisAu === null && periodDays !== null) {
    const periodSec = periodDays * SECONDS_PER_DAY;
    semiMajorAxisAu =
      Math.cbrt((G_GRAV * anchorMassKg * periodSec ** 2) / (4 * Math.PI ** 2)) / 1000 / AU_KM;
  }
  if (semiMajorAxisAu === null) {
    semiMajorAxisAu = logUniform(seededRandom(id, 'semi-major-axis'), 0.05, 5);
    approximate.push('orbit.semiMajorAxisKm');
  }
  if (periodDays === null) {
    periodDays = orbitalPeriodSecFromAu(semiMajorAxisAu, anchorMassKg) / SECONDS_PER_DAY;
    if (approximate.includes('orbit.semiMajorAxisKm')) {
      approximate.push('orbit.orbitalPeriodSec');
    }
  }

  let eccentricity = isNumber(planet.eccentricity) ? planet.eccentricity : null;
  if (eccentricity === null) {
    eccentricity = 0;
    approximate.push('orbit.eccentricity');
  }
  let argumentOfPeriapsisDeg = isNumber(planet.argumentOfPeriapsisDeg)
    ? planet.argumentOfPeriapsisDeg
    : null;
  if (argumentOfPeriapsisDeg === null) {
    argumentOfPeriapsisDeg = pickRange(seededRandom(id, 'periapsis'), 0, 360);
    approximate.push('orbit.argumentOfPeriapsisDeg');
  }
  let inclinationDeg;
  if (isNumber(planet.inclinationDeg) && isNumber(anchor.referenceInclinationDeg)) {
    inclinationDeg = Math.abs(planet.inclinationDeg - anchor.referenceInclinationDeg);
  } else {
    inclinationDeg = pickRange(seededRandom(id, 'inclination'), 0, SEEDED_INCLINATION_MAX_DEG);
    approximate.push('orbit.inclinationDeg');
  }
  const longitudeOfAscendingNodeDeg = pickRange(seededRandom(id, 'node'), 0, 360);
  approximate.push('orbit.longitudeOfAscendingNodeDeg');
  let meanAnomalyAtEpochDeg = meanAnomalyAtJ2000({
    periodDays,
    periapsisTimeJd: planet.periapsisTimeJd,
    transitMidpointJd: planet.transitMidpointJd,
    eccentricity,
    argumentOfPeriapsisDeg,
  });
  if (meanAnomalyAtEpochDeg === null) {
    meanAnomalyAtEpochDeg = pickRange(seededRandom(id, 'phase'), 0, 360);
    approximate.push('orbit.meanAnomalyAtEpochDeg');
  }

  let radiusEarth = positive(planet.radiusEarth);
  let massEarth = positive(planet.massEarth);
  if (massEarth !== null && ARCHIVE_ESTIMATED_MASS.has(planet.massProvenance)) {
    approximate.push('physical.massKg');
  }
  if (radiusEarth === null && massEarth !== null) {
    radiusEarth = estimateRadiusEarth(massEarth);
    approximate.push('physical.meanRadiusKm');
  }
  let teqK = positive(planet.equilibriumTempK);
  if (teqK === null) {
    teqK =
      teqFromInsolation(planet.insolationEarth) ??
      teqFromInsolation((anchor.luminositySolar ?? 1) / semiMajorAxisAu ** 2);
    approximate.push('physical.meanTemperatureK');
  }
  const density = positive(planet.densityGcm3) ?? densityGcm3(massEarth, radiusEarth);

  let archetype = classifyCatalogPlanet({ radiusEarth, massEarth, teqK, density });
  if (archetype === null) {
    const hz = habitableZoneAu(anchor.luminositySolar ?? 1);
    archetype = classifyPlanet(seededRandom(id, 'class'), semiMajorAxisAu, hz);
    approximate.push('surfaceArchetype', 'planetType');
  } else if (
    approximate.includes('physical.meanRadiusKm') ||
    approximate.includes('physical.meanTemperatureK')
  ) {
    approximate.push('surfaceArchetype', 'planetType');
  }
  if (massEarth === null || radiusEarth === null) {
    const fallback = planetPhysical(archetype, seededRandom(id, 'physical'));
    if (massEarth === null) {
      massEarth = fallback.massKg / EARTH_MASS_KG;
      approximate.push('physical.massKg');
    }
    if (radiusEarth === null) {
      radiusEarth = fallback.meanRadiusKm / EARTH_RADIUS_KM;
      approximate.push('physical.meanRadiusKm');
    }
  }

  const massKg = massEarth * EARTH_MASS_KG;
  const radiusKm = radiusEarth * EARTH_RADIUS_KM;
  const orbitalPeriodSec = periodDays * SECONDS_PER_DAY;
  const style = planetStyle(archetype);
  const locked = semiMajorAxisAu < TIDAL_LOCK_AU;
  const spinRng = seededRandom(id, 'rotation');
  const rotationPeriodSec = locked
    ? orbitalPeriodSec
    : SECONDS_PER_DAY * (style.giant ? pickRange(spinRng, 0.3, 1.5) : pickRange(spinRng, 0.4, 50));
  const axialTiltDeg = pickRange(seededRandom(id, 'tilt'), 0, locked ? 3 : 30);
  approximate.push(
    'physical.rotationPeriodSec',
    'physical.axialTiltDeg',
    'physical.compositionTags',
    'atmosphere'
  );
  if (approximate.includes('physical.massKg') || approximate.includes('physical.meanRadiusKm')) {
    approximate.push('physical.surfaceGravityMps2');
  }
  if (anchor.circumbinary) {
    approximate.push('parentBodyId', 'orbit');
  }
  const rings = catalogRings({ planetId: id, archetype, teqK, radiusKm, axialTiltDeg });
  if (rings) {
    approximate.push('rings');
  }

  return {
    id,
    catalogId: id,
    bodyType: 'planet',
    catalogSource: CATALOG_SOURCE,
    catalogIds: { planetId: id, hostId: planet.hostId },
    displayName: planet.name,
    catalogName: planet.name,
    parentBodyId: anchor.parentBodyId,
    planetType: archetype,
    surfaceArchetype: archetype,
    status: planet.status || 'confirmed',
    ...(planet.controversial ? { controversial: true } : {}),
    ...(anchor.circumbinary ? { circumbinary: true, circumbinaryStarIds: anchor.starIds } : {}),
    orbit: {
      semiMajorAxisKm: semiMajorAxisAu * AU_KM,
      eccentricity,
      inclinationDeg,
      longitudeOfAscendingNodeDeg,
      argumentOfPeriapsisDeg,
      meanAnomalyAtEpochDeg,
      orbitalPeriodSec,
      epoch: J2000_EPOCH,
    },
    physical: {
      massKg,
      meanRadiusKm: radiusKm,
      rotationPeriodSec,
      axialTiltDeg,
      surfaceGravityMps2: (G_GRAV * massKg) / (radiusKm * 1000) ** 2,
      meanTemperatureK: teqK,
      compositionTags: style.tags,
    },
    atmosphere: {
      hasAtmosphere: archetype !== 'lava',
      surfacePressurePa: null,
      primaryComponents: style.tags,
    },
    discovery: {
      discoveredBy: planet.discoveryFacility || 'NASA Exoplanet Archive',
      discoveredYear: planet.discoveryYear ?? null,
      discoveryNotes: planet.discoveryMethod || null,
    },
    magnitudes: {
      absoluteMagnitudeH: null,
      apparentMagnitudeMin: null,
      apparentMagnitudeMax: null,
    },
    visualization: { colorHex: style.colorHex, textureKey: `planet-${archetype}` },
    ...(rings ? { rings } : {}),
    approximateFields: finalizeApproximate(approximate),
  };
}

/**
 * Generates bodies for one exoplanet system.
 *
 * @param {Object} options
 * @param {Object} options.system - a record from data/exoplanet-systems.json
 * @param {Map<string, Object>} options.starFacts - starId → resolved physics for
 *   real stars (massSolar, radiusSolar, teffK, logLuminositySolar, spectralType,
 *   vMag, raDeg, decDeg, distancePc, catalogName, properName, ids)
 * @param {Map<string, Object>} options.planetsById - archive planet records
 * @param {string} [options.asOfTimestamp]
 * @returns {{ stars: Array, planets: Array, asOfTimestamp: string, seedVersion: string }}
 */
function generateCatalogSystemBodies({ system, starFacts, planetsById, asOfTimestamp }) {
  const factsById = new Map(
    system.stars.map((star) => [
      star.starId,
      star.source === 'synthesized' ? star : starFacts.get(star.starId) || {},
    ])
  );
  const completedById = new Map(
    system.stars.map((star) => [star.starId, completeStarFacts(factsById.get(star.starId))])
  );
  const massKgOf = (starId) => completedById.get(starId).massSolar * SOLAR_MASS_KG;

  let starBodies = [];
  if (!system.existing) {
    const links = starHierarchy(system.stars, factsById);
    starBodies = system.stars.map((star, index) => {
      if (index === 0) {
        return buildStarBody(star, factsById.get(star.starId), {});
      }
      const link = links.get(star.starId);
      return buildStarBody(star, factsById.get(star.starId), {
        parentBodyId: link.parentId,
        orbit: companionOrbit(
          star.starId,
          link.separationAu,
          massKgOf(link.parentId) + massKgOf(star.starId),
          {
            close: link.close,
          }
        ),
        orbitApproximate: true,
      });
    });
  }

  const anchors = [];
  for (const star of system.stars) {
    if (star.planetIds && star.planetIds.length) {
      anchors.push({
        key: star.starId,
        parentBodyId: star.starId,
        planetIds: star.planetIds,
        massKg: massKgOf(star.starId),
        luminositySolar: completedById.get(star.starId).luminosity,
        circumbinary: false,
      });
    }
  }
  for (const group of system.circumbinaryPlanets || []) {
    const pair = system.stars.filter((star) => group.starIds.includes(star.starId));
    const parent = [...pair].sort((a, b) => (a.letter || '').localeCompare(b.letter || ''))[0];
    anchors.push({
      key: `cb:${group.starIds.join('+')}`,
      parentBodyId: parent.starId,
      planetIds: group.planetIds,
      massKg: pair.reduce((sum, star) => sum + massKgOf(star.starId), 0),
      luminositySolar: pair.reduce(
        (sum, star) => sum + completedById.get(star.starId).luminosity,
        0
      ),
      circumbinary: true,
      starIds: [...group.starIds],
    });
  }

  const planets = [];
  for (const anchor of anchors) {
    const records = anchor.planetIds.map((planetId) => planetsById.get(planetId)).filter(Boolean);
    anchor.referenceInclinationDeg = median(records.map((planet) => planet.inclinationDeg));
    for (const planet of records) {
      planets.push(buildPlanetBody(planet, anchor));
    }
  }
  planets.sort((a, b) => a.id.localeCompare(b.id));

  return {
    stars: starBodies,
    planets,
    asOfTimestamp: asOfTimestamp || J2000_EPOCH,
    seedVersion: CATALOG_SEED_VERSION,
  };
}

module.exports = {
  CATALOG_PLANET_ARCHETYPES,
  CATALOG_SEED_VERSION,
  CATALOG_SOURCE,
  PLANET_ARCHETYPES,
  RING_CHANCE,
  STAR_COLORS,
  catalogRings,
  classifyCatalogPlanet,
  completeStarFacts,
  estimateRadiusEarth,
  generateCatalogSystemBodies,
  mainSequenceFromMass,
  meanAnomalyAtJ2000,
  projectedSeparationAu,
  spectralClassForTeff,
  teqFromInsolation,
};
