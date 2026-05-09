'use strict';

const { SOL_SYSTEM_CATALOG, J2000_EPOCH } = require('./sol-system-catalog');

const SOLAR_SYSTEM_CELESTIAL_SEED_VERSION = '2026-05-sol-catalog-v1';
const SOLAR_SYSTEM_CELESTIAL_SEED_STATE_KEY = 'solar-system-celestial-seed-state';

const CATALOG_SOURCE_SCAN_ID = 'catalog';
const CATALOG_CHARACTER_ID = 'system-catalog';

const SOL_CATALOG_BY_ID = new Map(SOL_SYSTEM_CATALOG.map((entry) => [entry.id, entry]));

/**
 * Solve Kepler's equation M = E - e * sin(E) for E using Newton-Raphson.
 */
function solveEccentricAnomaly(meanAnomalyRad, eccentricity) {
  let E = meanAnomalyRad;
  for (let iteration = 0; iteration < 12; iteration += 1) {
    const f = E - eccentricity * Math.sin(E) - meanAnomalyRad;
    const fp = 1 - eccentricity * Math.cos(E);
    if (Math.abs(fp) < 1e-12) break;
    const delta = f / fp;
    E -= delta;
    if (Math.abs(delta) < 1e-10) break;
  }
  return E;
}

/**
 * Compute parent-relative position (km) from Keplerian elements at the given timestamp.
 * Returns {x, y, z} in the parent's reference plane (ecliptic for heliocentric orbits).
 */
function computeRelativePositionKm(orbit, asOfMs) {
  if (!orbit) {
    return { x: 0, y: 0, z: 0 };
  }
  const epochMs = Date.parse(orbit.epoch || J2000_EPOCH);
  const periodSec = Math.max(1, Number(orbit.orbitalPeriodSec) || 1);
  const dtSec = (asOfMs - (Number.isFinite(epochMs) ? epochMs : Date.parse(J2000_EPOCH))) / 1000;
  const meanMotion = (2 * Math.PI) / periodSec;
  const M0 = ((Number(orbit.meanAnomalyAtEpochDeg) || 0) * Math.PI) / 180;
  const TWO_PI = Math.PI * 2;
  let M = M0 + meanMotion * dtSec;
  M = ((M % TWO_PI) + TWO_PI) % TWO_PI;

  const eccentricity = Math.min(0.999, Math.max(0, Number(orbit.eccentricity) || 0));
  const a = Math.max(0, Number(orbit.semiMajorAxisKm) || 0);

  const E = solveEccentricAnomaly(M, eccentricity);
  const xp = a * (Math.cos(E) - eccentricity);
  const yp = a * Math.sqrt(Math.max(0, 1 - eccentricity * eccentricity)) * Math.sin(E);

  const w = ((Number(orbit.argumentOfPeriapsisDeg) || 0) * Math.PI) / 180;
  const inc = ((Number(orbit.inclinationDeg) || 0) * Math.PI) / 180;
  const omega = ((Number(orbit.longitudeOfAscendingNodeDeg) || 0) * Math.PI) / 180;

  const cosO = Math.cos(omega);
  const sinO = Math.sin(omega);
  const cosI = Math.cos(inc);
  const sinI = Math.sin(inc);
  const cosW = Math.cos(w);
  const sinW = Math.sin(w);

  const x = (cosO * cosW - sinO * sinW * cosI) * xp + (-cosO * sinW - sinO * cosW * cosI) * yp;
  const y = (sinO * cosW + cosO * sinW * cosI) * xp + (-sinO * sinW + cosO * cosW * cosI) * yp;
  const z = sinW * sinI * xp + cosW * sinI * yp;

  return { x, y, z };
}

/**
 * Walk parent chain to compute heliocentric position by recursively summing relative positions.
 * Roots (no parent) anchor at origin.
 */
function computeAbsolutePositionKm(catalogEntry, asOfMs, cache) {
  if (!catalogEntry) {
    return { x: 0, y: 0, z: 0 };
  }
  if (cache.has(catalogEntry.id)) {
    return cache.get(catalogEntry.id);
  }

  const parent = catalogEntry.parentBodyId
    ? SOL_CATALOG_BY_ID.get(catalogEntry.parentBodyId)
    : null;
  // Sun and similar root bodies sit at the system barycenter (origin).
  if (!parent || !catalogEntry.orbit) {
    const origin = { x: 0, y: 0, z: 0 };
    cache.set(catalogEntry.id, origin);
    return origin;
  }

  const parentPos = computeAbsolutePositionKm(parent, asOfMs, cache);
  const relative = computeRelativePositionKm(catalogEntry.orbit, asOfMs);
  const position = {
    x: parentPos.x + relative.x,
    y: parentPos.y + relative.y,
    z: parentPos.z + relative.z,
  };
  cache.set(catalogEntry.id, position);
  return position;
}

/**
 * Convert a catalog entry into a celestial-body document compatible with the
 * Mongoose CelestialBody schema. Provides minimal default composition so the
 * required-by-schema field is satisfied for non-asteroid bodies.
 */
function buildCelestialBodyDocument(catalogEntry, asOfMs, asOfTimestamp, cache) {
  const positionKm = computeAbsolutePositionKm(catalogEntry, asOfMs, cache);
  const composition = inferCatalogComposition(catalogEntry);

  return {
    id: catalogEntry.id,
    catalogId: catalogEntry.id,
    sourceScanId: CATALOG_SOURCE_SCAN_ID,
    createdByCharacterId: CATALOG_CHARACTER_ID,
    missionId: null,
    missionInstanceId: null,
    createdAt: asOfTimestamp,
    updatedAt: asOfTimestamp,
    spatial: {
      solarSystemId: 'sol',
      frame: 'barycentric',
      positionKm,
      epochMs: asOfMs,
    },
    motion: null,
    physical: catalogEntry.physical
      ? {
          estimatedMassKg: Number.isFinite(catalogEntry.physical.massKg)
            ? catalogEntry.physical.massKg
            : 0,
          estimatedDiameterM: Number.isFinite(catalogEntry.physical.meanRadiusKm)
            ? catalogEntry.physical.meanRadiusKm * 2 * 1000
            : 0,
        }
      : null,
    observability: {
      visibility: 'visible',
      scanState: 'scanned',
    },
    composition,
    state: 'active',
    destroyedAt: null,
    destroyedReason: null,
    debrisSeed: null,
    debris: [],
    // Catalog-only fields (passed through normalizers and persisted via schema extensions).
    bodyType: catalogEntry.bodyType,
    displayName: catalogEntry.displayName,
    parentBodyId: catalogEntry.parentBodyId || null,
    orbitalElements: catalogEntry.orbit ? { ...catalogEntry.orbit } : null,
    physicalCatalog: catalogEntry.physical || null,
    atmosphere: catalogEntry.atmosphere || null,
    discovery: catalogEntry.discovery || null,
    magnitudes: catalogEntry.magnitudes || null,
    isCatalogBody: true,
  };
}

/**
 * Pick a default composition value that satisfies the required asteroid-style
 * composition schema for non-asteroid bodies.
 */
function inferCatalogComposition(catalogEntry) {
  const tags = catalogEntry?.physical?.compositionTags || [];
  const primary = tags[0] || 'unknown';
  const textureColor =
    catalogEntry.bodyType === 'star'
      ? '#ffd86b'
      : catalogEntry.bodyType === 'planet'
        ? '#8aa6c4'
        : catalogEntry.bodyType === 'moon'
          ? '#c8c8c8'
          : '#9a9a9a';
  return {
    rarity: 'Common',
    material: typeof primary === 'string' ? primary : 'unknown',
    textureColor,
  };
}

/**
 * Build the seeded celestial body document set for the given solar system.
 * Currently only `sol` has a defined catalog; others return [].
 */
function buildSeededCelestialBodiesForSolarSystem(solarSystemId, asOfTimestamp) {
  const normalizedSystemId =
    typeof solarSystemId === 'string' ? solarSystemId.trim().toLowerCase() : '';
  if (normalizedSystemId !== 'sol') {
    return [];
  }

  const timestamp =
    typeof asOfTimestamp === 'string' && asOfTimestamp.trim() ? asOfTimestamp.trim() : J2000_EPOCH;
  const asOfMs = Date.parse(timestamp);
  const safeAsOfMs = Number.isFinite(asOfMs) ? asOfMs : Date.parse(J2000_EPOCH);
  const positionCache = new Map();

  return SOL_SYSTEM_CATALOG.map((entry) =>
    buildCelestialBodyDocument(entry, safeAsOfMs, timestamp, positionCache)
  );
}

module.exports = {
  SOLAR_SYSTEM_CELESTIAL_SEED_VERSION,
  SOLAR_SYSTEM_CELESTIAL_SEED_STATE_KEY,
  buildSeededCelestialBodiesForSolarSystem,
  computeRelativePositionKm,
  computeAbsolutePositionKm,
};
