'use strict';

/**
 * Runtime star-fact resolution for exoplanet systems (D31, D37, D47). The
 * snapshot keeps star records slim, so star physics, positions, and IDs are
 * re-derived here from the archive host and AT-HYG slice records. The build
 * scripts import these functions so both paths produce identical facts.
 */

const MISSING_DISTANCE_PC = 100000;
const PRECISE_PARALLAX_MAS = 5;
const DISTANCE_DISAGREEMENT = 0.1;
const SUN_ABSOLUTE_V_MAG = 4.83;
const SUN_TEFF_K = 5772;

const firstDefined = (...values) => values.find((value) => value !== null && value !== undefined);

function round(value, digits) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

function knownDistance(distancePc) {
  return distancePc > 0 && distancePc < MISSING_DISTANCE_PC ? distancePc : null;
}

function hdNumber(hdName) {
  const match = /^HD\s+(\d+)/.exec(hdName || '');
  return match ? match[1] : null;
}

function equatorialToCartesian(raDeg, decDeg, distancePc) {
  const rad = Math.PI / 180;
  const cosDec = Math.cos(decDeg * rad);
  return {
    x: distancePc * cosDec * Math.cos(raDeg * rad),
    y: distancePc * cosDec * Math.sin(raDeg * rad),
    z: distancePc * Math.sin(decDeg * rad),
  };
}

function median(values) {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!sorted.length) {
    return null;
  }
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** D31 default: median archive distance of hosts that ship as archive-only stars. */
function defaultDistancePc(hosts) {
  const value = median(hosts.map((entry) => knownDistance(entry.distancePc)));
  return value === null ? null : Number(value.toFixed(3));
}

function hostLogLuminosity(host) {
  if (Number.isFinite(host.logLuminositySolar)) {
    return host.logLuminositySolar;
  }
  if (host.radiusSolar > 0 && host.teffK > 0) {
    return Math.log10(host.radiusSolar ** 2 * (host.teffK / SUN_TEFF_K) ** 4);
  }
  return null;
}

/**
 * Photometric distance from apparent magnitude and luminosity. Assumes the
 * Sun's bolometric correction for every star and no extinction (D31).
 */
function photometricDistancePc(host) {
  const apparent = firstDefined(host.vMag, host.gaiaMag);
  const logLuminosity = hostLogLuminosity(host);
  if (!Number.isFinite(apparent) || logLuminosity === null) {
    return null;
  }
  const absolute = SUN_ABSOLUTE_V_MAG - 2.5 * logLuminosity;
  return knownDistance(10 ** ((apparent - absolute + 5) / 5));
}

/**
 * Deterministic distance for a host (D31). Order: AT-HYG for matched hosts;
 * 1000/parallax when it is precise (≥ 5 mas) and disagrees with sy_dist by
 * > 10% (TICv8 errors); sy_dist; 1000/parallax; photometric; the default.
 */
function resolveHostDistance(host, star = null, { defaultDistance = null } = {}) {
  const starDistance = star ? knownDistance(star.distancePc) : null;
  if (starDistance) {
    return { distancePc: starDistance, source: 'at-hyg' };
  }
  const archive = knownDistance(host.distancePc);
  const parallax = host.parallaxMas > 0 ? knownDistance(1000 / host.parallaxMas) : null;
  if (
    archive &&
    parallax &&
    host.parallaxMas >= PRECISE_PARALLAX_MAS &&
    Math.abs(parallax / archive - 1) > DISTANCE_DISAGREEMENT
  ) {
    return { distancePc: parallax, source: 'parallax' };
  }
  if (archive) {
    return { distancePc: archive, source: 'archive' };
  }
  if (parallax) {
    return { distancePc: parallax, source: 'parallax' };
  }
  const photometric = photometricDistancePc(host);
  if (photometric) {
    return { distancePc: photometric, source: 'photometric', approximate: true };
  }
  if (defaultDistance) {
    return { distancePc: defaultDistance, source: 'default', approximate: true };
  }
  return { distancePc: null, source: 'none' };
}

/**
 * Resolves star facts for a host, applying the phase 2 precedence rule:
 * the archive wins for stellar physics; AT-HYG/HYG wins for position,
 * distance, and names. Unmatched hosts use archive values, with distance
 * gaps filled by resolveHostDistance (D31).
 */
function resolveHostStar(host, star = null, hygStar = null, options = {}) {
  const resolvedDistance = resolveHostDistance(host, star, options);
  const useCatalogPosition = Boolean(
    star && resolvedDistance.source === 'at-hyg' && star.x !== null
  );
  const distancePc = resolvedDistance.distancePc;
  let position = null;
  if (useCatalogPosition) {
    position = { x: star.x, y: star.y, z: star.z };
  } else if (distancePc && host.raDeg !== undefined && host.decDeg !== undefined) {
    position = equatorialToCartesian(host.raDeg, host.decDeg, distancePc);
  }
  const hygLuminosity = hygStar && hygStar.lum > 0 ? Math.log10(hygStar.lum) : null;
  return {
    hostId: host.id,
    catalogName: host.name,
    properName: firstDefined(star && star.proper, hygStar && hygStar.proper) || null,
    positionSource: useCatalogPosition ? 'at-hyg' : 'archive',
    raDeg: useCatalogPosition ? star.raDeg : (host.raDeg ?? null),
    decDeg: useCatalogPosition ? star.decDeg : (host.decDeg ?? null),
    distancePc: distancePc ?? null,
    distanceSource: resolvedDistance.source,
    distanceApproximate: Boolean(resolvedDistance.approximate),
    positionPc: position,
    vMag: firstDefined(star && star.vMag, host.vMag) ?? null,
    spectralType: firstDefined(host.spectralType, star && star.spect) ?? null,
    teffK: host.teffK ?? null,
    massSolar: host.massSolar ?? null,
    radiusSolar: host.radiusSolar ?? null,
    logLuminositySolar: firstDefined(host.logLuminositySolar, hygLuminosity) ?? null,
    ids: {
      atHygId: (star && star.atHygId) || null,
      hygId: (star && star.hygId) || null,
      gaiaDr3Id: host.gaiaDr3Id || (star && star.gaia) || null,
      hipId: host.hipId || (star && star.hip) || null,
      hdId: hdNumber(host.hdName) || (star && star.hd) || null,
      ticId: host.ticId || null,
    },
  };
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

/** Facts for an archive host, optionally matched to an AT-HYG slice record. */
function hostStarFacts(host, catalogRecord, defaultDistance) {
  const resolved = resolveHostStar(
    host,
    catalogRecord ? catalogStarFromSlice(catalogRecord) : null,
    catalogRecord ? { lum: catalogRecord.luminositySolar, proper: catalogRecord.properName } : null,
    { defaultDistance }
  );
  return {
    hostId: host.id,
    atHygId: catalogRecord ? catalogRecord.atHygId : null,
    hygId: catalogRecord ? (catalogRecord.hygId ?? null) : null,
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
    ids: resolved.ids,
  };
}

/** Facts for an AT-HYG companion that hosts no planets. */
function companionStarFacts(record) {
  const hasPosition = record.xPc !== undefined && record.xPc !== null;
  let position = hasPosition ? { x: record.xPc, y: record.yPc, z: record.zPc } : null;
  if (!position && record.distancePc && record.raDeg !== undefined) {
    position = equatorialToCartesian(record.raDeg, record.decDeg, record.distancePc);
  }
  return {
    atHygId: record.atHygId,
    hygId: record.hygId ?? null,
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
    ids: {
      atHygId: record.atHygId,
      hygId: record.hygId ?? null,
      gaiaDr3Id: record.gaiaDr3Id ?? null,
      hipId: record.hipId ?? null,
      hdId: record.hdId ?? null,
    },
  };
}

function matchedCatalogRecord(host, hygByAtHygId) {
  return host.match && host.match.decision === 'matched'
    ? hygByAtHygId.get(host.match.atHygId) || null
    : null;
}

/**
 * Re-derives the physics of a system's real stars (D37) for the body
 * generator: starId → facts. Synthesized stars carry their own physics.
 */
function systemStarFacts(system, { hostsById, hygByAtHygId, defaultDistance = null }) {
  const facts = new Map();
  for (const star of system.stars) {
    if (star.source === 'archive-host') {
      const host = hostsById.get(star.hostId);
      facts.set(
        star.starId,
        hostStarFacts(host, matchedCatalogRecord(host, hygByAtHygId), defaultDistance)
      );
    } else if (star.source === 'hyg-companion') {
      facts.set(star.starId, companionStarFacts(hygByAtHygId.get(star.atHygId)));
    }
  }
  return facts;
}

module.exports = {
  SUN_ABSOLUTE_V_MAG,
  catalogStarFromSlice,
  companionCatalogName,
  companionStarFacts,
  defaultDistancePc,
  equatorialToCartesian,
  hdNumber,
  hostStarFacts,
  knownDistance,
  matchedCatalogRecord,
  photometricDistancePc,
  resolveHostDistance,
  resolveHostStar,
  roundedPosition,
  systemStarFacts,
};
