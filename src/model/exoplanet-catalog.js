'use strict';

/**
 * Runtime access to the NASA Exoplanet Archive catalog (EX-5.1–5.4).
 *
 * Loads the committed snapshots in data/ lazily, resolves star physics with the
 * same functions the importer uses (D47), and exposes:
 *   - system records and generated bodies (with game display names applied),
 *   - a per-system seed hash so reseeding happens only when that system's
 *     source records change (D48),
 *   - star-catalog entries in the HYG star shape (D50, D54),
 *   - solar-system registry records (D51).
 */

const { createHash } = require('node:crypto');
const path = require('node:path');

const {
  CATALOG_SEED_VERSION,
  STAR_COLORS,
  completeStarFacts,
  generateCatalogSystemBodies,
} = require('./exoplanet-system-generator');
const { systemStarFacts } = require('./exoplanet-star-facts');
const { spectralSubclass } = require('./hyg-star-catalog');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const SOLAR_MASS_KG = 1.98847e30;
const SOLAR_RADIUS_KM = 695700;
const STAR_CATALOG_SOURCE = 'exoplanet-catalog';

let cache = null;

function readSnapshot(name) {
  return require(path.join(DATA_DIR, name));
}

function load() {
  if (cache) {
    return cache;
  }
  const systemsFile = readSnapshot('exoplanet-systems.json');
  const hosts = readSnapshot('exoplanet-hosts.json').records;
  const hyg = readSnapshot('exoplanet-hyg-stars.json').records;
  const planets = readSnapshot('exoplanet-planets.json').records;
  const names = readSnapshot('exoplanet-names.json');
  const references = readSnapshot('exoplanet-references.json');
  const defaultHost = hosts.find((host) => host.resolvedDistance?.source === 'default');
  cache = {
    snapshotDate: systemsFile.snapshotDate,
    references: references.records,
    adsUrlTemplate: references.adsUrlTemplate,
    systems: systemsFile.records,
    systemsById: new Map(systemsFile.records.map((system) => [system.id, system])),
    hostsById: new Map(hosts.map((host) => [host.id, host])),
    hygByAtHygId: new Map(hyg.map((record) => [record.atHygId, record])),
    planetsById: new Map(planets.map((planet) => [planet.id, planet])),
    names: {
      systems: names.systems || {},
      stars: names.stars || {},
      planets: names.planets || {},
    },
    defaultDistance: defaultHost ? defaultHost.resolvedDistance.distancePc : null,
    starFactsBySystem: new Map(),
    seedHashBySystem: new Map(),
    starEntries: null,
    registryRecords: null,
  };
  return cache;
}

function getExoplanetSystems() {
  return load().systems;
}

function getExoplanetSystemById(systemId) {
  return load().systemsById.get(systemId) || null;
}

/** Source proper names attached to any component of an exoplanet system. */
function getExoplanetSystemProperNames(systemId) {
  const data = load();
  const system = data.systemsById.get(systemId);
  if (!system) return [];
  return [
    system.properName,
    ...system.stars.map((star) => data.hygByAtHygId.get(star.atHygId)?.properName || null),
  ].filter((name) => typeof name === 'string' && name.trim());
}

/** Pinned source digest used to validate naming eligibility decisions. */
function getExoplanetSystemEvidence(systemId) {
  const data = load();
  const system = data.systemsById.get(systemId);
  if (!system) return null;
  const hosts = system.stars.map((star) => data.hostsById.get(star.hostId) || null);
  const hygRecords = system.stars.map((star) => data.hygByAtHygId.get(star.atHygId) || null);
  const digest = createHash('sha256')
    .update(JSON.stringify({ system, hosts, hygRecords }))
    .digest('hex');
  return { digest, snapshot: `exoplanet-snapshot-${data.snapshotDate}` };
}

function getExoplanetNames() {
  return load().names;
}

/** Snapshot date of the exoplanet catalog files (YYYY-MM-DD). */
function getExoplanetSnapshotDate() {
  return load().snapshotDate;
}

/**
 * Literature references for one archive planet (A2, D19), discovery reference
 * first. ADS bibcodes become ADS abstract links; absolute URLs pass through.
 * Labels are plain text.
 */
function planetReferences(planet) {
  const data = load();
  const references = [];
  for (const index of planet?.refs || []) {
    const record = data.references[index];
    if (!record) {
      continue;
    }
    const [key, label] = record;
    const url = /^https?:\/\//i.test(key)
      ? key
      : data.adsUrlTemplate.replace('{bibcode}', encodeURIComponent(key));
    references.push({ label: label || key, url });
  }
  return references;
}

function getSystemStarFacts(system) {
  const data = load();
  if (!data.starFactsBySystem.has(system.id)) {
    data.starFactsBySystem.set(
      system.id,
      systemStarFacts(system, {
        hostsById: data.hostsById,
        hygByAtHygId: data.hygByAtHygId,
        defaultDistance: data.defaultDistance,
      })
    );
  }
  return data.starFactsBySystem.get(system.id);
}

function systemPlanetIds(system) {
  return [
    ...system.stars.flatMap((star) => star.planetIds || []),
    ...(system.circumbinaryPlanets || []).flatMap((group) => group.planetIds),
  ];
}

/**
 * Hash of every source record that feeds one system's bodies: the system
 * record, its hosts and AT-HYG records, its planets, and body display names.
 * System naming is presentation-only and intentionally excluded from this hash.
 */
function getExoplanetSystemSeedHash(systemId) {
  const data = load();
  if (data.seedHashBySystem.has(systemId)) {
    return data.seedHashBySystem.get(systemId);
  }
  const system = data.systemsById.get(systemId);
  if (!system) {
    return null;
  }
  const planetIds = systemPlanetIds(system);
  const planets = planetIds.map((planetId) => data.planetsById.get(planetId) || null);
  const hosts = system.stars.map((star) => data.hostsById.get(star.hostId) || null);
  const hygRecords = system.stars.map((star) => data.hygByAtHygId.get(star.atHygId) || null);
  const names = {
    stars: system.stars.map((star) => data.names.stars[star.starId] || null),
    planets: planetIds.map((planetId) => data.names.planets[planetId] || null),
  };
  const hash = createHash('sha256')
    .update(
      JSON.stringify({
        generator: CATALOG_SEED_VERSION,
        defaultDistance: data.defaultDistance,
        system,
        hosts,
        hygRecords,
        planets,
        references: planets.map(planetReferences),
        names,
      })
    )
    .digest('hex')
    .slice(0, 12);
  data.seedHashBySystem.set(systemId, hash);
  return hash;
}

/**
 * Generated star and planet catalog entries for one system, with game names
 * from data/exoplanet-names.json applied to displayName (D53).
 */
function generateExoplanetSystemBodies(systemId, asOfTimestamp) {
  const data = load();
  const system = data.systemsById.get(systemId);
  if (!system) {
    return null;
  }
  const result = generateCatalogSystemBodies({
    system,
    starFacts: getSystemStarFacts(system),
    planetsById: data.planetsById,
    asOfTimestamp,
  });
  for (const star of result.stars) {
    star.displayName = data.names.stars[star.id] || star.displayName;
  }
  for (const planet of result.planets) {
    planet.displayName = data.names.planets[planet.id] || planet.displayName;
    const references = planetReferences(data.planetsById.get(planet.id));
    if (references.length) {
      planet.discovery = { ...planet.discovery, references };
    }
  }
  return result;
}

const round = (value, digits) => (Number.isFinite(value) ? Number(value.toFixed(digits)) : null);

function equatorialFromPosition(position) {
  if (!position) {
    return { raDeg: null, decDeg: null };
  }
  const radius = Math.hypot(position.x, position.y, position.z);
  if (!(radius > 0)) {
    return { raDeg: null, decDeg: null };
  }
  const raDeg = ((Math.atan2(position.y, position.x) * 180) / Math.PI + 360) % 360;
  const decDeg = (Math.asin(position.z / radius) * 180) / Math.PI;
  return { raDeg, decDeg };
}

function systemDisplayName(system, primaryFacts) {
  const names = load().names;
  return (
    names.systems[system.id] ||
    primaryFacts?.properName ||
    system.catalogName ||
    primaryFacts?.catalogName ||
    system.id
  );
}

/** One star entry in the HYG star-catalog shape (star-list/star-get). */
function buildStarEntry(system, star, facts) {
  const names = load().names;
  const completed = completeStarFacts(facts);
  const position = facts.positionPc || star.positionPc || null;
  const equatorial =
    Number.isFinite(facts.raDeg) && Number.isFinite(facts.decDeg)
      ? { raDeg: facts.raDeg, decDeg: facts.decDeg }
      : equatorialFromPosition(position);
  const distancePc = Number.isFinite(facts.distancePc) ? facts.distancePc : null;
  const vMag = Number.isFinite(facts.vMag) ? facts.vMag : null;
  const ids = facts.ids || {};
  const massKg = completed.massSolar * SOLAR_MASS_KG;
  const radiusKm = completed.radiusSolar * SOLAR_RADIUS_KM;
  return {
    starId: star.starId,
    hygId: facts.hygId || ids.hygId || null,
    catalogSource: STAR_CATALOG_SOURCE,
    catalogName: facts.catalogName || star.catalogName || null,
    approximate:
      star.source === 'synthesized' ||
      Boolean(facts.distanceApproximate) ||
      completed.approximate.length > 0,
    hipId: ids.hipId || null,
    hdId: ids.hdId || null,
    properName: names.stars[star.starId] || facts.properName || null,
    raHours: round(equatorial.raDeg === null ? null : equatorial.raDeg / 15, 6),
    decDeg: round(equatorial.decDeg, 5),
    distanceParsec: distancePc,
    apparentMagnitude: vMag,
    absoluteMagnitude:
      vMag !== null && distancePc ? round(vMag - 5 * Math.log10(distancePc / 10), 3) : null,
    spectralType: facts.spectralType || null,
    spectralClass: completed.spectralClass,
    spectralSubclass: spectralSubclass(facts.spectralType),
    colorIndexBv: null,
    colorHex: STAR_COLORS[completed.spectralClass] || '#ffffff',
    luminositySolar: round(completed.luminosity, 6),
    massSolar: round(completed.massSolar, 4),
    radiusSolar: round(completed.radiusSolar, 4),
    radiusKm: round(radiusKm, 1),
    massKg,
    positionPc: position ? { x: position.x, y: position.y, z: position.z } : { x: 0, y: 0, z: 0 },
    systemId: system.id,
    systemRole: star.role || 'primary',
  };
}

function systemStarEntries(system) {
  const facts = getSystemStarFacts(system);
  return system.stars.map((star) =>
    buildStarEntry(
      system,
      star,
      star.source === 'synthesized' ? star : facts.get(star.starId) || {}
    )
  );
}

/**
 * Star entries for every exoplanet-catalog star (real and synthesized, D50).
 * Stars of existing game systems are skipped: the HYG fixture already lists them.
 */
function getExoplanetStarEntries() {
  const data = load();
  if (!data.starEntries) {
    data.starEntries = data.systems
      .filter((system) => !system.existing)
      .flatMap((system) => systemStarEntries(system));
  }
  return data.starEntries;
}

function primaryStarSummary(entry) {
  return {
    hygId: entry.hygId,
    starId: entry.starId,
    spectralClass: entry.spectralClass,
    spectralType: entry.spectralType,
    colorHex: entry.colorHex,
    colorIndexBv: entry.colorIndexBv,
    luminositySolar: entry.luminositySolar,
    massSolar: entry.massSolar,
    radiusSolar: entry.radiusSolar,
    absoluteMagnitude: entry.absoluteMagnitude,
    properName: entry.properName,
  };
}

/** Registry records for new (non-existing) exoplanet-catalog systems. */
function getExoplanetRegistryRecords() {
  const data = load();
  if (!data.registryRecords) {
    const starEntries = getExoplanetStarEntries();
    const entriesBySystem = new Map();
    for (const entry of starEntries) {
      if (!entriesBySystem.has(entry.systemId)) {
        entriesBySystem.set(entry.systemId, []);
      }
      entriesBySystem.get(entry.systemId).push(entry);
    }
    data.registryRecords = data.systems
      .filter((system) => !system.existing)
      .map((system) => {
        const entries = entriesBySystem.get(system.id) || [];
        const primaryFacts = getSystemStarFacts(system).get(system.stars[0].starId);
        const primaryHost = data.hostsById.get(system.stars[0].hostId);
        const distanceApproximate =
          Boolean(primaryFacts?.distanceApproximate) ||
          Boolean(primaryHost?.resolvedDistance?.approximate);
        return {
          id: system.id,
          displayName: systemDisplayName(system, primaryFacts),
          catalogName: system.catalogName || null,
          hygSystemId: null,
          source: 'exoplanet-catalog',
          isMultiStar: system.stars.length > 1,
          positionPc: system.positionPc,
          distanceParsec: system.distancePc,
          distanceApproximate,
          catalogSnapshotDate: data.snapshotDate,
          primaryStar: entries[0] ? primaryStarSummary(entries[0]) : null,
          starCount: system.stars.length,
          declaredStarCount: system.declaredStarCount,
          planetCount: systemPlanetIds(system).length,
          moonCount: 0,
          asteroidCount: 0,
          generationSeed: null,
        };
      });
  }
  return data.registryRecords;
}

/** Planet count the catalog adds to an existing game system (D45). */
function getExistingSystemCatalogPlanetIds(systemId) {
  const system = getExoplanetSystemById(systemId);
  return system && system.existing ? systemPlanetIds(system) : [];
}

function clearExoplanetCatalogCache() {
  cache = null;
}

module.exports = {
  STAR_CATALOG_SOURCE,
  clearExoplanetCatalogCache,
  generateExoplanetSystemBodies,
  getExistingSystemCatalogPlanetIds,
  getExoplanetNames,
  getExoplanetRegistryRecords,
  getExoplanetSnapshotDate,
  getExoplanetStarEntries,
  getExoplanetSystemById,
  getExoplanetSystemEvidence,
  getExoplanetSystemProperNames,
  getExoplanetSystemSeedHash,
  getExoplanetSystems,
  getSystemStarFacts,
};
