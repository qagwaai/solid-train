'use strict';

/**
 * Phase 3 of the exoplanet refresh: groups archive hosts, HYG companions, and
 * synthesized companions into solar systems (D32–D36). Pure functions only.
 */

const {
  COMPONENT_SUFFIX,
  equatorialToCartesian,
  hostComponentSuffix,
  resolveHostStar,
} = require('./exoplanet-crossmatch');
const { slugify } = require('../import-exoplanet-catalog-data');
const {
  createSeededRandom,
  hashStringToSeed,
} = require('../../src/model/procedural-system-generator');

const LETTERS = 'ABCDEFGHIJ';
const ROLES = ['primary', 'secondary', 'tertiary', 'quaternary', 'quinary', 'senary'];
const AU_PER_PC = 206264.806;
const SUN_TEFF_K = 5772;
const SUN_ABSOLUTE_V_MAG = 4.83;
const DEFAULT_REFERENCE_MASS = 1;
const MIN_STAR_MASS = 0.08;
const CIRCUMBINARY_SEPARATION_AU = [0.05, 0.5];
const WIDE_SEPARATION_AU = [10, 1000];
const WIDE_SEPARATION_PLANET_FACTOR = 5;
const CIRCUMBINARY_PLANET_FACTOR = 4;

function round(value, digits) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

function roundSignificant(value, digits = 5) {
  return Number.isFinite(value) && value !== 0 ? Number(value.toPrecision(digits)) : value;
}

function compact(record) {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== null && value !== undefined)
  );
}

function roleFor(index) {
  return ROLES[index] || `component-${index + 1}`;
}

/** Host name without its component suffix, such as `Kepler-444 A` → `Kepler-444`. */
function baseName(name) {
  return name.replace(COMPONENT_SUFFIX, '').trim() || name;
}

/** Preferred letter from a host suffix (D36): `Aa` → A, `AB` → A, `BC` → B, none → A. */
function preferredLetter(name) {
  const suffix = hostComponentSuffix(name);
  return suffix ? suffix[0].toUpperCase() : 'A';
}

function isCircumbinaryHostName(name) {
  const suffix = hostComponentSuffix(name);
  return Boolean(suffix && /^[A-C]{2,3}$/.test(suffix));
}

function createUnionFind(ids) {
  const parent = new Map(ids.map((id) => [id, id]));
  const find = (id) => {
    let root = id;
    while (parent.get(root) !== root) {
      root = parent.get(root);
    }
    let node = id;
    while (parent.get(node) !== root) {
      const next = parent.get(node);
      parent.set(node, root);
      node = next;
    }
    return root;
  };
  const union = (a, b) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) {
      // The smaller ID becomes the root, so grouping never depends on input order.
      if (rootA < rootB) {
        parent.set(rootB, rootA);
      } else {
        parent.set(rootA, rootB);
      }
    }
  };
  return { find, union };
}

/**
 * Groups host IDs into systems (D36). Returns arrays of host IDs, each sorted,
 * and the groups sorted by their first host ID.
 */
function groupHosts(hosts, hygStars = [], systemAssignments = []) {
  const ids = hosts.map((host) => host.id);
  const known = new Set(ids);
  const detached = new Set(
    systemAssignments.filter((entry) => entry.action === 'detach').map((entry) => entry.hostId)
  );
  const { find, union } = createUnionFind(ids);
  const unionByKey = (keyFor) => {
    const firstByKey = new Map();
    for (const host of hosts) {
      if (detached.has(host.id)) {
        continue;
      }
      const key = keyFor(host);
      if (!key) {
        continue;
      }
      if (firstByKey.has(key)) {
        union(firstByKey.get(key), host.id);
      } else {
        firstByKey.set(key, host.id);
      }
    }
  };

  unionByKey((host) => slugify(baseName(host.name)));
  unionByKey((host) => host.match && host.match.existingSystemId);
  const baseByHost = new Map();
  for (const star of hygStars) {
    const linked = star.hostIds.filter((id) => known.has(id) && !detached.has(id));
    for (const id of linked.slice(1)) {
      union(linked[0], id);
    }
    if (star.role === 'host' && star.hygBase) {
      for (const id of linked) {
        baseByHost.set(id, star.hygBase);
      }
    }
  }
  unionByKey((host) => baseByHost.get(host.id));
  for (const entry of systemAssignments) {
    if (entry.action !== 'join') {
      continue;
    }
    if (!known.has(entry.hostId) || !known.has(entry.withHostId)) {
      throw new Error(`systemAssignments join references an unknown host: ${entry.hostId}`);
    }
    union(entry.hostId, entry.withHostId);
  }

  const groups = new Map();
  for (const id of [...ids].sort()) {
    const root = find(id);
    if (!groups.has(root)) {
      groups.set(root, []);
    }
    groups.get(root).push(id);
  }
  return [...groups.values()].sort((a, b) => a[0].localeCompare(b[0]));
}

/** Adapts an `exoplanet-hyg-stars.json` record to the shape resolveHostStar expects. */
function catalogStarFromSlice(record) {
  return {
    atHygId: record.atHygId,
    hygId: record.hygId ?? null,
    proper: record.properName ?? null,
    distancePc: record.distancePc ?? null,
    x: record.xPc ?? null,
    y: record.yPc ?? null,
    z: record.zPc ?? null,
    raDeg: record.raDeg ?? null,
    decDeg: record.decDeg ?? null,
    vMag: record.vMag ?? null,
    spect: record.spectralType ?? null,
    gaia: record.gaiaDr3Id ?? null,
    hip: record.hipId ?? null,
    hd: record.hdId ?? null,
  };
}

function companionCatalogName(record) {
  if (record.properName) {
    return record.properName;
  }
  if (record.bayer && record.constellation) {
    return `${record.bayer} ${record.constellation}`;
  }
  if (record.flamsteed && record.constellation) {
    return `${record.flamsteed} ${record.constellation}`;
  }
  if (record.glName) {
    return record.glName;
  }
  if (record.hipId) {
    return `HIP ${record.hipId}`;
  }
  if (record.hdId) {
    return `HD ${record.hdId}`;
  }
  return record.gaiaDr3Id ? `Gaia DR3 ${record.gaiaDr3Id}` : `AT-HYG ${record.atHygId}`;
}

function existingRole(existingStarId) {
  const match = /-star-([a-z]+)$/.exec(existingStarId || '');
  return match ? match[1] : null;
}

// Real positions keep AT-HYG's 0.0001 pc precision; synthesized offsets of a
// few AU need 1e-6 pc to survive rounding.
function roundedPosition(position, digits = 4) {
  return position
    ? {
        x: round(position.x, digits),
        y: round(position.y, digits),
        z: round(position.z, digits),
      }
    : null;
}

function hostStar(host, catalogRecord, defaultDistance) {
  const resolved = resolveHostStar(
    host,
    catalogRecord ? catalogStarFromSlice(catalogRecord) : null,
    catalogRecord ? { lum: catalogRecord.luminositySolar, proper: catalogRecord.properName } : null,
    { defaultDistance }
  );
  const existingStarId = host.match && host.match.existingStarId;
  return {
    starId: existingStarId || `exo-star-${slugify(host.name)}`,
    preferredLetter: preferredLetter(host.name),
    existingRole: existingRole(existingStarId),
    source: 'archive-host',
    hostId: host.id,
    atHygId: catalogRecord ? catalogRecord.atHygId : null,
    hygId: catalogRecord ? (catalogRecord.hygId ?? null) : null,
    existing: Boolean(existingStarId),
    catalogName: host.name,
    properName: resolved.properName,
    raDeg: round(resolved.raDeg, 7),
    decDeg: round(resolved.decDeg, 7),
    distancePc: round(resolved.distancePc, 4),
    distanceSource: resolved.distanceSource,
    distanceApproximate: resolved.distanceApproximate || null,
    positionPc: roundedPosition(resolved.positionPc),
    spectralType: resolved.spectralType,
    teffK: resolved.teffK,
    massSolar: resolved.massSolar,
    radiusSolar: resolved.radiusSolar,
    logLuminositySolar: round(resolved.logLuminositySolar, 5),
    vMag: resolved.vMag,
    planetIds: [],
  };
}

function companionStar(record) {
  const hasPosition = record.xPc !== undefined && record.xPc !== null;
  let position = hasPosition ? { x: record.xPc, y: record.yPc, z: record.zPc } : null;
  if (!position && record.distancePc && record.raDeg !== undefined) {
    position = equatorialToCartesian(record.raDeg, record.decDeg, record.distancePc);
  }
  return {
    starId: record.existingStarId || `exo-star-athyg-${record.atHygId}`,
    preferredLetter: null,
    existingRole: existingRole(record.existingStarId),
    source: 'hyg-companion',
    atHygId: record.atHygId,
    hygId: record.hygId ?? null,
    existing: Boolean(record.existingStarId),
    catalogName: companionCatalogName(record),
    properName: record.properName ?? null,
    raDeg: record.raDeg ?? null,
    decDeg: record.decDeg ?? null,
    distancePc: record.distancePc ?? null,
    distanceSource: 'at-hyg',
    positionPc: roundedPosition(position),
    spectralType: record.spectralType ?? null,
    logLuminositySolar:
      record.luminositySolar > 0 ? round(Math.log10(record.luminositySolar), 5) : null,
    vMag: record.vMag ?? null,
    planetIds: [],
  };
}

function brightnessOrder(a, b) {
  const vA = Number.isFinite(a.vMag) ? a.vMag : Infinity;
  const vB = Number.isFinite(b.vMag) ? b.vMag : Infinity;
  if (vA !== vB) {
    return vA - vB;
  }
  const mA = Number.isFinite(a.massSolar) ? a.massSolar : -Infinity;
  const mB = Number.isFinite(b.massSolar) ? b.massSolar : -Infinity;
  if (mA !== mB) {
    return mB - mA;
  }
  return a.starId.localeCompare(b.starId);
}

/** Assigns component letters (D36) and returns the letters left for synthesis. */
function assignLetters(stars, letterCount) {
  const taken = new Set();
  const lettered = stars
    .filter((star) => star.preferredLetter)
    .sort(
      (a, b) =>
        a.preferredLetter.localeCompare(b.preferredLetter) || a.starId.localeCompare(b.starId)
    );
  for (const star of lettered) {
    if (!taken.has(star.preferredLetter)) {
      star.letter = star.preferredLetter;
      taken.add(star.letter);
    }
  }
  const pool = LETTERS.slice(0, Math.max(letterCount, stars.length)).split('');
  const free = () => pool.find((letter) => !taken.has(letter));
  for (const star of stars.filter((entry) => !entry.letter).sort(brightnessOrder)) {
    star.letter = free() || LETTERS[taken.size];
    taken.add(star.letter);
  }
  return pool.filter((letter) => !taken.has(letter));
}

/** Simple main-sequence relations for synthesized stars (D32). */
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

function spectralClassForTeff(teff) {
  if (teff >= 30000) return 'O';
  if (teff >= 10000) return 'B';
  if (teff >= 7500) return 'A';
  if (teff >= 6000) return 'F';
  if (teff >= 5200) return 'G';
  if (teff >= 3700) return 'K';
  return 'M';
}

function logUniform(rng, lo, hi) {
  return Math.exp(Math.log(lo) + (Math.log(hi) - Math.log(lo)) * rng());
}

function randomUnitVector(rng) {
  const z = 2 * rng() - 1;
  const theta = 2 * Math.PI * rng();
  const r = Math.sqrt(1 - z * z);
  return { x: r * Math.cos(theta), y: r * Math.sin(theta), z };
}

/**
 * Builds one synthesized companion (D32), seeded only by system ID and letter.
 * `reference` is the real star it is placed relative to.
 */
function synthesizeCompanion({ systemId, letter, reference, partnerOf, planetAxesAu }) {
  const rng = createSeededRandom(hashStringToSeed(`${systemId}:${letter}`));
  const referenceMass = reference.massSolar > 0 ? reference.massSolar : DEFAULT_REFERENCE_MASS;
  const before = letter < reference.letter;
  const ratio = before ? 1 + 0.5 * rng() : 0.1 + 0.8 * rng();
  const massSolar = Math.max(MIN_STAR_MASS, referenceMass * ratio);
  const { luminosity, radius, teff } = mainSequenceFromMass(massSolar);

  let separationAu;
  if (partnerOf) {
    const innermost = Math.min(...partnerOf.circumbinaryAxesAu.filter((axis) => axis > 0));
    const ceiling = Number.isFinite(innermost)
      ? Math.min(CIRCUMBINARY_SEPARATION_AU[1], innermost / CIRCUMBINARY_PLANET_FACTOR)
      : CIRCUMBINARY_SEPARATION_AU[1];
    const floor = Math.min(CIRCUMBINARY_SEPARATION_AU[0], ceiling / 2);
    separationAu = logUniform(rng, floor, ceiling);
  } else {
    const widest = Math.max(0, ...planetAxesAu.filter((axis) => axis > 0));
    const floor = Math.max(WIDE_SEPARATION_AU[0], widest * WIDE_SEPARATION_PLANET_FACTOR);
    const ceiling = Math.max(WIDE_SEPARATION_AU[1], floor * 10);
    separationAu = logUniform(rng, floor, ceiling);
  }
  const direction = randomUnitVector(rng);
  const offsetPc = separationAu / AU_PER_PC;
  const origin = reference.positionPc || { x: 0, y: 0, z: 0 };
  const distancePc = reference.distancePc;
  const absoluteV = SUN_ABSOLUTE_V_MAG - 2.5 * Math.log10(luminosity);
  const spectralClass = spectralClassForTeff(teff);
  return {
    starId: `${systemId}-star-${letter.toLowerCase()}`,
    letter,
    source: 'synthesized',
    approximate: true,
    catalogName: `${reference.catalogName ? baseName(reference.catalogName) : systemId} ${letter}`,
    distancePc: round(distancePc, 4),
    positionPc: roundedPosition(
      {
        x: origin.x + direction.x * offsetPc,
        y: origin.y + direction.y * offsetPc,
        z: origin.z + direction.z * offsetPc,
      },
      6
    ),
    separationAu: roundSignificant(separationAu, 4),
    separationFromStarId: reference.starId,
    spectralType: `${spectralClass} V`,
    teffK: Math.round(teff),
    massSolar: roundSignificant(massSolar, 4),
    radiusSolar: roundSignificant(radius, 4),
    logLuminositySolar: round(Math.log10(luminosity), 4),
    vMag: distancePc ? round(absoluteV + 5 * Math.log10(distancePc) - 5, 2) : null,
    planetIds: [],
  };
}

function partnerLetter(letter, letters) {
  const index = LETTERS.indexOf(letter);
  const next = LETTERS[index + 1];
  const previous = LETTERS[index - 1];
  if (letter === 'A') {
    return next;
  }
  return letters.includes(next) ? next : previous;
}

/**
 * Builds the system records. `planetsById` maps planet ID to the planet record
 * (needs `circumbinary` and `semiMajorAxisAu`).
 */
function buildSystems({
  hosts,
  hygStars = [],
  planetsById,
  systemAssignments = [],
  defaultDistance = null,
}) {
  const hostsById = new Map(hosts.map((host) => [host.id, host]));
  const hygByAtHygId = new Map(hygStars.map((record) => [record.atHygId, record]));
  const companionsByHost = new Map();
  for (const record of hygStars.filter((entry) => entry.role === 'companion')) {
    for (const hostId of record.hostIds) {
      if (!companionsByHost.has(hostId)) {
        companionsByHost.set(hostId, []);
      }
      companionsByHost.get(hostId).push(record);
    }
  }

  const groups = groupHosts(hosts, hygStars, systemAssignments);
  const drafts = groups.map((hostIds) => {
    const groupHosts = hostIds.map((id) => hostsById.get(id));
    const stars = groupHosts.map((host) => {
      const matched = host.match && host.match.decision === 'matched';
      return hostStar(host, matched ? hygByAtHygId.get(host.match.atHygId) : null, defaultDistance);
    });
    const seenCompanions = new Set();
    for (const host of groupHosts) {
      for (const record of companionsByHost.get(host.id) || []) {
        if (!seenCompanions.has(record.atHygId)) {
          seenCompanions.add(record.atHygId);
          stars.push(companionStar(record));
        }
      }
    }
    const existingSystemId =
      groupHosts.map((host) => host.match && host.match.existingSystemId).find(Boolean) || null;
    return { hostIds, groupHosts, stars, existingSystemId };
  });

  assignSystemIds(drafts);
  return drafts
    .map((draft) => finishSystem(draft, planetsById))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** D34: existing IDs win; slug collisions fall back to the primary host's full name. */
function assignSystemIds(drafts) {
  const primaryHost = (draft) =>
    [...draft.groupHosts].sort(
      (a, b) =>
        preferredLetter(a.name).localeCompare(preferredLetter(b.name)) || a.id.localeCompare(b.id)
    )[0];
  const bySlug = new Map();
  for (const draft of drafts) {
    draft.primaryHost = primaryHost(draft);
    if (draft.existingSystemId) {
      draft.id = draft.existingSystemId;
      continue;
    }
    const slug = `exo-${slugify(baseName(draft.primaryHost.name))}`;
    if (!bySlug.has(slug)) {
      bySlug.set(slug, []);
    }
    bySlug.get(slug).push(draft);
  }
  const used = new Set(drafts.filter((draft) => draft.id).map((draft) => draft.id));
  for (const [slug, colliding] of [...bySlug].sort(([a], [b]) => a.localeCompare(b))) {
    for (const draft of colliding) {
      draft.id = colliding.length === 1 ? slug : `exo-${slugify(draft.primaryHost.name)}`;
      draft.idCollision = colliding.length > 1;
      if (used.has(draft.id)) {
        throw new Error(`System ID collision cannot be resolved: ${draft.id}`);
      }
      used.add(draft.id);
    }
  }
}

function finishSystem(draft, planetsById) {
  const { id, groupHosts, stars, existingSystemId } = draft;
  const planetsByHost = new Map(
    groupHosts.map((host) => [host.id, (host.planetIds || []).map((pid) => planetsById.get(pid))])
  );
  const isCircumbinary = (host, planet) =>
    Boolean(planet && planet.circumbinary) || isCircumbinaryHostName(host.name);
  const hasCircumbinary = groupHosts.some((host) =>
    planetsByHost.get(host.id).some((planet) => isCircumbinary(host, planet))
  );
  const declaredStarCount = Math.max(
    stars.length,
    hasCircumbinary ? 2 : 1,
    ...groupHosts.map((host) => host.starCount || 1)
  );

  let synthesized = [];
  if (existingSystemId) {
    for (const star of stars) {
      star.role = star.existingRole;
    }
  } else {
    const freeLetters = assignLetters(stars, declaredStarCount);
    const missing = Math.max(0, declaredStarCount - stars.length);
    const byLetter = new Map(stars.map((star) => [star.letter, star]));
    const allLetters = [...stars.map((star) => star.letter), ...freeLetters.slice(0, missing)];
    synthesized = freeLetters.slice(0, missing).map((letter) => {
      const partnerHost = stars.find(
        (star) =>
          star.hostId &&
          partnerLetter(star.letter, allLetters) === letter &&
          planetsByHost.get(star.hostId).some((planet) =>
            isCircumbinary(
              draft.groupHosts.find((h) => h.id === star.hostId),
              planet
            )
          )
      );
      const reference = partnerHost || byLetter.get('A') || stars[0];
      return synthesizeCompanion({
        systemId: id,
        letter,
        reference,
        partnerOf: partnerHost
          ? {
              circumbinaryAxesAu: planetsByHost
                .get(partnerHost.hostId)
                .map((planet) => planet && planet.semiMajorAxisAu),
            }
          : null,
        planetAxesAu: groupHosts.flatMap((host) =>
          planetsByHost.get(host.id).map((planet) => planet && planet.semiMajorAxisAu)
        ),
      });
    });
    const ordered = [...stars, ...synthesized].sort((a, b) => a.letter.localeCompare(b.letter));
    ordered.forEach((star, index) => {
      star.role = roleFor(index);
    });
  }

  const allStars = [...stars, ...synthesized];
  const starsByLetter = new Map(allStars.map((star) => [star.letter, star]));
  const circumbinaryPlanets = [];
  for (const star of stars.filter((entry) => entry.hostId)) {
    const host = groupHosts.find((entry) => entry.id === star.hostId);
    const barycenter = [];
    for (const planet of planetsByHost.get(host.id)) {
      if (!planet) {
        continue;
      }
      if (isCircumbinary(host, planet) && !existingSystemId) {
        barycenter.push(planet.id);
      } else {
        star.planetIds.push(planet.id);
      }
    }
    if (barycenter.length) {
      const partner = starsByLetter.get(partnerLetter(star.letter, [...starsByLetter.keys()]));
      if (!partner) {
        star.planetIds.push(...barycenter);
        continue;
      }
      circumbinaryPlanets.push({
        planetIds: barycenter.sort(),
        starIds: [star.starId, partner.starId].sort(),
      });
    }
  }

  const roleOrder = (star) => {
    const index = ROLES.indexOf(star.role);
    return index === -1 ? ROLES.length : index;
  };
  const orderedStars = allStars.sort(
    (a, b) => roleOrder(a) - roleOrder(b) || a.starId.localeCompare(b.starId)
  );
  const primary = orderedStars[0];
  const system = {
    id,
    existing: existingSystemId ? true : null,
    catalogName: existingSystemId ? null : baseName(draft.primaryHost.name),
    properName: existingSystemId ? null : primary.properName || null,
    positionPc: existingSystemId ? null : primary.positionPc,
    distancePc: existingSystemId ? null : primary.distancePc,
    distanceApproximate: existingSystemId
      ? null
      : primary.distanceApproximate || primary.approximate || null,
    declaredStarCount,
    resolvedStarCount: stars.length,
    synthesizedStarCount: synthesized.length,
    idCollision: draft.idCollision || null,
    stars: orderedStars.map(starRecord),
    circumbinaryPlanets: circumbinaryPlanets.length
      ? circumbinaryPlanets.sort((a, b) => a.planetIds[0].localeCompare(b.planetIds[0]))
      : null,
  };
  return compact(system);
}

/**
 * Real stars carry only links; their position and physics are re-derived at
 * seed time with resolveHostStar from exoplanet-hosts.json (archive) and
 * exoplanet-hyg-stars.json (AT-HYG/HYG), which keeps the snapshot under the D2
 * size budget. Synthesized stars exist nowhere else, so they carry everything.
 */
const REAL_STAR_FIELDS = ['starId', 'letter', 'role', 'source', 'hostId', 'atHygId'];

function starRecord(star) {
  const { preferredLetter: _preferred, existingRole: _role, planetIds, existing, ...rest } = star;
  const fields =
    star.source === 'synthesized'
      ? rest
      : Object.fromEntries(REAL_STAR_FIELDS.map((field) => [field, rest[field]]));
  return compact({
    ...fields,
    existing: existing || null,
    planetIds: planetIds.length ? [...planetIds].sort() : null,
  });
}

/** Exit criteria: each planet and each host belongs to exactly one system. */
function validateSystems(systems, hosts) {
  const errors = [];
  const hostOwner = new Map();
  const planetOwner = new Map();
  const claim = (owners, key, systemId, label) => {
    if (owners.has(key)) {
      errors.push(`${label} ${key} is in ${owners.get(key)} and ${systemId}`);
    }
    owners.set(key, systemId);
  };
  const systemIds = new Set();
  for (const system of systems) {
    if (systemIds.has(system.id)) {
      errors.push(`duplicate system ID ${system.id}`);
    }
    systemIds.add(system.id);
    for (const star of system.stars) {
      if (star.hostId) {
        claim(hostOwner, star.hostId, system.id, 'host');
      }
    }
    for (const star of system.stars) {
      for (const planetId of star.planetIds || []) {
        claim(planetOwner, planetId, system.id, 'planet');
      }
    }
    for (const group of system.circumbinaryPlanets || []) {
      for (const planetId of group.planetIds) {
        claim(planetOwner, planetId, system.id, 'planet');
      }
    }
  }
  for (const host of hosts) {
    if (!hostOwner.has(host.id)) {
      errors.push(`host ${host.id} has no system`);
    }
    for (const planetId of host.planetIds || []) {
      if (!planetOwner.has(planetId)) {
        errors.push(`planet ${planetId} has no system`);
      }
    }
  }
  return errors;
}

function summarizeSystems(systems) {
  const summary = {
    systems: systems.length,
    existingSystems: 0,
    multiStarSystems: 0,
    circumbinarySystems: 0,
    idCollisions: 0,
    stars: { 'archive-host': 0, 'hyg-companion': 0, synthesized: 0 },
    byDeclaredStarCount: {},
  };
  for (const system of systems) {
    summary.existingSystems += system.existing ? 1 : 0;
    summary.multiStarSystems += system.stars.length > 1 ? 1 : 0;
    summary.circumbinarySystems += system.circumbinaryPlanets ? 1 : 0;
    summary.idCollisions += system.idCollision ? 1 : 0;
    summary.byDeclaredStarCount[system.declaredStarCount] =
      (summary.byDeclaredStarCount[system.declaredStarCount] || 0) + 1;
    for (const star of system.stars) {
      summary.stars[star.source] += 1;
    }
  }
  return summary;
}

module.exports = {
  ROLES,
  assignLetters,
  baseName,
  buildSystems,
  catalogStarFromSlice,
  groupHosts,
  isCircumbinaryHostName,
  mainSequenceFromMass,
  preferredLetter,
  spectralClassForTeff,
  summarizeSystems,
  synthesizeCompanion,
  validateSystems,
};
