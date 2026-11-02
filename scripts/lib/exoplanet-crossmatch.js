'use strict';

/**
 * Pure cross-match functions for linking NASA Exoplanet Archive hosts to
 * AT-HYG / HYG stars. See docs/exoplanet-catalog-import-plan-2026-11-01.md
 * ("Cross-match design") for the tier rules these functions implement.
 */

const ARCSEC_PER_DEG = 3600;
const MAS_PER_DEG = 3.6e6;
const MISSING_DISTANCE_PC = 100000;

const ARCHIVE_EPOCH = 2016.0;
const J2000_EPOCH = 2000.0;

const SANITY_MAX_SEPARATION_ARCSEC = 60;
const SANITY_MAX_DISTANCE_DIFFERENCE = 0.3;
const KINEMATIC_TOLERANCE = 0.05;
const MIN_CONE_ARCSEC = 15;
const CONE_PROPER_MOTION_YEARS = 30;
const SEPARATION_PROPER_MOTION_YEARS = 16;

const AUTO_MATCH_POSTERIOR = 0.95;
const AUTO_MATCH_MARGIN = 0.2;
const REVIEW_POSTERIOR = 0.8;
const MAX_AUTO_VMAG_DIFFERENCE = 1;
const MAX_AUTO_SEPARATION_NORM = 5;
const MAX_FEATURE_LLR = 8;

const ID_TIERS = ['gaia-dr3', 'hip', 'hd'];
const TIER_RANK = { override: 0, 'gaia-dr3': 1, hip: 2, hd: 3, scored: 4 };

const FEATURES = {
  separation: { bins: [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, Infinity] },
  distance: { bins: [0.01, 0.03, 0.1, 0.3, 0.6, Infinity] },
  vMag: { bins: [0.1, 0.3, 0.6, 1, 2, 4, Infinity] },
  properMotion: { bins: [0.05, 0.15, 0.5, 1, Infinity] },
  name: { categories: ['agree', 'none'] },
  spectralClass: { categories: ['agree', 'differ'] },
};

const GREEK = new Map(
  Object.entries({
    alpha: ['alf', 'alp', 'alpha'],
    beta: ['bet', 'beta'],
    gamma: ['gam', 'gamma'],
    delta: ['del', 'delta'],
    epsilon: ['eps', 'epsilon'],
    zeta: ['zet', 'zeta'],
    eta: ['eta'],
    theta: ['the', 'tet', 'theta'],
    iota: ['iot', 'iota'],
    kappa: ['kap', 'kappa'],
    lambda: ['lam', 'lambda'],
    mu: ['mu'],
    nu: ['nu'],
    xi: ['xi', 'ksi'],
    omicron: ['omi', 'omicron'],
    pi: ['pi'],
    rho: ['rho'],
    sigma: ['sig', 'sigma'],
    tau: ['tau'],
    upsilon: ['ups', 'upsilon'],
    phi: ['phi'],
    chi: ['chi'],
    psi: ['psi'],
    omega: ['ome', 'omega'],
  }).flatMap(([canonical, aliases]) => aliases.map((alias) => [alias, canonical]))
);

const COMPONENT_SUFFIX = /\s+\(?(A[ab]?|B[ab]?|C|AB|BC|ABC)\)?$/;
const COMPONENT_TOKEN = /\s(?:a|b|c|ab|bc|abc|aa|ba|bb)$/;

/** Splits one CSV line, honoring double-quoted fields and escaped quotes. */
function parseCsvLine(line) {
  if (!line.includes('"')) {
    return line.split(',');
  }
  const values = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === '"' && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

function optionalNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function optionalText(value) {
  const text = value === null || value === undefined ? '' : String(value).trim();
  return text || null;
}

function knownDistance(distancePc) {
  return distancePc > 0 && distancePc < MISSING_DISTANCE_PC ? distancePc : null;
}

/** Converts an AT-HYG v4.0 CSV row into the light star shape used for matching. */
function atHygStarFromRow(row) {
  const raHours = optionalNumber(row.ra);
  return {
    atHygId: optionalText(row.id),
    hygId: optionalText(row.hyg),
    gaia: optionalText(row.gaia),
    tyc: optionalText(row.tyc),
    hip: optionalText(row.hip),
    hd: optionalText(row.hd),
    hr: optionalText(row.hr),
    gl: optionalText(row.gl),
    bayer: optionalText(row.bayer),
    flam: optionalText(row.flam),
    con: optionalText(row.con),
    proper: optionalText(row.proper),
    raDeg: raHours === null ? null : raHours * 15,
    decDeg: optionalNumber(row.dec),
    posSrc: optionalText(row.pos_src),
    distancePc: knownDistance(optionalNumber(row.dist)),
    distSrc: optionalText(row.dist_src),
    x: optionalNumber(row.x0),
    y: optionalNumber(row.y0),
    z: optionalNumber(row.z0),
    vMag: optionalNumber(row.mag),
    absMag: optionalNumber(row.absmag),
    ci: optionalNumber(row.ci),
    rv: optionalNumber(row.rv),
    pmRa: optionalNumber(row.pmra),
    pmDec: optionalNumber(row.pmdec),
    spect: optionalText(row.spect),
  };
}

/** Converts a HYG v4.4 CSV row into the light shape used for multiplicity. */
function hygStarFromRow(row) {
  return {
    hygId: optionalText(row.id),
    hip: optionalText(row.hip),
    hd: optionalText(row.hd),
    gl: optionalText(row.gl),
    proper: optionalText(row.proper),
    base: optionalText(row.base),
    comp: optionalNumber(row.comp),
    compPrimary: optionalText(row.comp_primary),
    lum: optionalNumber(row.lum),
    spect: optionalText(row.spect),
  };
}

function angularSeparationArcsec(ra1, dec1, ra2, dec2) {
  const rad = Math.PI / 180;
  const haversine =
    Math.sin(((dec2 - dec1) * rad) / 2) ** 2 +
    Math.cos(dec1 * rad) * Math.cos(dec2 * rad) * Math.sin(((ra2 - ra1) * rad) / 2) ** 2;
  return ((2 * Math.asin(Math.min(1, Math.sqrt(haversine)))) / rad) * ARCSEC_PER_DEG;
}

/** Moves a star along its proper motion (pmRa includes cos dec) by the given years. */
function propagate(star, years) {
  const cosDec = Math.max(1e-6, Math.cos((star.decDeg * Math.PI) / 180));
  return {
    raDeg: (((star.raDeg + ((star.pmRa || 0) * years) / MAS_PER_DEG / cosDec) % 360) + 360) % 360,
    decDeg: Math.max(-90, Math.min(90, star.decDeg + ((star.pmDec || 0) * years) / MAS_PER_DEG)),
  };
}

/**
 * Plausible positions of a star at the archive epoch (J2016). AT-HYG mixes
 * epochs and pos_src does not reliably say which applies (high proper-motion
 * Tycho rows appear at both J2000 and J2016), so both are tried.
 */
function archiveEpochPositions(star) {
  const catalog = { raDeg: star.raDeg, decDeg: star.decDeg };
  if (!star.pmRa && !star.pmDec) {
    return [catalog];
  }
  return [catalog, propagate(star, ARCHIVE_EPOCH - J2000_EPOCH)];
}

function separationArcsec(host, star) {
  return Math.min(
    ...archiveEpochPositions(star).map((position) =>
      angularSeparationArcsec(host.raDeg, host.decDeg, position.raDeg, position.decDeg)
    )
  );
}

function totalProperMotionMasYr(object, raKey, decKey) {
  const ra = object[raKey];
  const dec = object[decKey];
  return ra === null || ra === undefined || dec === null || dec === undefined
    ? null
    : Math.hypot(ra, dec);
}

function coneRadiusArcsec(host) {
  const properMotion = totalProperMotionMasYr(host, 'pmRaMasYr', 'pmDecMasYr') || 0;
  return Math.max(MIN_CONE_ARCSEC, (properMotion / 1000) * CONE_PROPER_MOTION_YEARS);
}

const GRID_CELL_DEG = 0.1;
const GRID_RA_CELLS = Math.round(360 / GRID_CELL_DEG);

/**
 * Indexes hosts by every 0.1° cell their search radius touches, so each star
 * needs a single cell lookup. radiusFor(host) returns arcseconds.
 */
function buildHostGrid(hosts, radiusFor) {
  const cells = new Map();
  for (const host of hosts) {
    if (!Number.isFinite(host.raDeg) || !Number.isFinite(host.decDeg)) {
      continue;
    }
    const radiusArcsec = radiusFor(host);
    const radiusDeg = radiusArcsec / ARCSEC_PER_DEG;
    const decLow = Math.max(-90, host.decDeg - radiusDeg);
    const decHigh = Math.min(90, host.decDeg + radiusDeg);
    const cosDec = Math.cos((Math.max(Math.abs(decLow), Math.abs(decHigh)) * Math.PI) / 180);
    const raHalfWidth = cosDec > 1e-6 ? radiusDeg / cosDec : 360;
    const raCells = [];
    if (raHalfWidth >= 180) {
      for (let i = 0; i < GRID_RA_CELLS; i += 1) raCells.push(i);
    } else {
      const first = Math.floor((host.raDeg - raHalfWidth) / GRID_CELL_DEG);
      const last = Math.floor((host.raDeg + raHalfWidth) / GRID_CELL_DEG);
      for (let i = first; i <= last; i += 1) {
        raCells.push(((i % GRID_RA_CELLS) + GRID_RA_CELLS) % GRID_RA_CELLS);
      }
    }
    const entry = { host, radiusArcsec };
    for (
      let j = Math.floor(decLow / GRID_CELL_DEG);
      j <= Math.floor(decHigh / GRID_CELL_DEG);
      j += 1
    ) {
      for (const i of new Set(raCells)) {
        const key = `${i}:${j}`;
        if (!cells.has(key)) {
          cells.set(key, []);
        }
        cells.get(key).push(entry);
      }
    }
  }
  return cells;
}

/** Returns [{ host, separation }] for hosts whose search radius contains the star. */
function findNearbyHosts(grid, star) {
  if (!Number.isFinite(star.raDeg) || !Number.isFinite(star.decDeg)) {
    return [];
  }
  const nearest = new Map();
  for (const position of archiveEpochPositions(star)) {
    const i =
      ((Math.floor(position.raDeg / GRID_CELL_DEG) % GRID_RA_CELLS) + GRID_RA_CELLS) %
      GRID_RA_CELLS;
    for (const { host, radiusArcsec } of grid.get(
      `${i}:${Math.floor(position.decDeg / GRID_CELL_DEG)}`
    ) || []) {
      const separation = angularSeparationArcsec(
        host.raDeg,
        host.decDeg,
        position.raDeg,
        position.decDeg
      );
      const previous = nearest.get(host.id);
      if (separation <= radiusArcsec && (!previous || separation < previous.separation)) {
        nearest.set(host.id, { host, separation });
      }
    }
  }
  return [...nearest.values()];
}

function hostComponentSuffix(name) {
  const match = COMPONENT_SUFFIX.exec(name || '');
  return match ? match[1] : null;
}

function hdNumber(hdName) {
  const match = /^HD\s+(\d+)/.exec(hdName || '');
  return match ? match[1] : null;
}

/**
 * Normalizes a designation for comparison: lowercase, Gliese prefixes unified
 * to "gj", Greek abbreviations expanded, digits and letters separated.
 */
function normalizeDesignation(value) {
  const tokens = String(value || '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/(\d)([a-z])/g, '$1 $2')
    .replace(/([a-z])(\d)/g, '$1 $2')
    .split(/[^a-z0-9+]+/)
    .filter(Boolean);
  if (!tokens.length) {
    return '';
  }
  if (tokens[0] === 'gliese' || tokens[0] === 'gl') {
    tokens[0] = 'gj';
  }
  if (GREEK.has(tokens[0])) {
    tokens[0] = GREEK.get(tokens[0]);
  }
  return tokens.join(' ');
}

function addKey(keys, value) {
  const key = normalizeDesignation(value);
  if (key) {
    keys.add(key);
    keys.add(key.replace(COMPONENT_TOKEN, ''));
  }
}

function hostNameKeys(host) {
  const keys = new Set();
  addKey(keys, host.name);
  addKey(keys, host.hdName);
  if (host.hipId) {
    keys.add(`hip ${host.hipId}`);
  }
  return keys;
}

function starNameKeys(star) {
  const keys = new Set();
  addKey(keys, star.proper);
  if (star.con && star.flam) {
    addKey(keys, `${star.flam} ${star.con}`);
  }
  if (star.con && star.bayer) {
    addKey(keys, `${star.bayer.replace(/[-\d]+$/, '')} ${star.con}`);
  }
  addKey(keys, star.gl);
  for (const [prefix, value] of [
    ['hd', star.hd],
    ['hip', star.hip],
    ['hr', star.hr],
  ]) {
    if (value) {
      keys.add(`${prefix} ${value}`);
    }
  }
  return keys;
}

function spectralLetter(spectralType) {
  const match = /^[^A-Za-z]*([OBAFGKMLTY])/.exec(spectralType || '');
  return match ? match[1].toUpperCase() : null;
}

/** Computes raw tier-3 feature values for a host/star pair. Missing features are null. */
function computeFeatures(host, star, separation) {
  const hostPm = totalProperMotionMasYr(host, 'pmRaMasYr', 'pmDecMasYr');
  const starPm = totalProperMotionMasYr(star, 'pmRa', 'pmDec');
  const fastestArcsecYr = Math.max(hostPm || 0, starPm || 0) / 1000;
  const starDistance = knownDistance(star.distancePc);
  const distanceFeatures = starDistance
    ? hostDistances(host).map(
        (distance) => Math.abs(distance - starDistance) / Math.max(distance, starDistance)
      )
    : [];
  const hostKeys = hostNameKeys(host);
  const nameAgrees = [...starNameKeys(star)].some((key) => hostKeys.has(key));
  const hostLetter = spectralLetter(host.spectralType);
  const starLetter = spectralLetter(star.spect);
  const hostVMag = host.vMag ?? null;
  return {
    separation: separation / (1 + SEPARATION_PROPER_MOTION_YEARS * fastestArcsecYr),
    distance: distanceFeatures.length ? Math.min(...distanceFeatures) : null,
    vMag: hostVMag !== null && star.vMag !== null ? Math.abs(hostVMag - star.vMag) : null,
    properMotion:
      hostPm !== null && starPm !== null
        ? Math.hypot(host.pmRaMasYr - star.pmRa, host.pmDecMasYr - star.pmDec) / (hostPm + 5)
        : null,
    name: nameAgrees ? 'agree' : 'none',
    spectralClass:
      hostLetter && starLetter ? (hostLetter === starLetter ? 'agree' : 'differ') : null,
  };
}

function featureBin(name, value) {
  if (value === null || value === undefined) {
    return null;
  }
  const feature = FEATURES[name];
  if (feature.categories) {
    return feature.categories.indexOf(value);
  }
  return feature.bins.findIndex((upper) => value < upper);
}

/**
 * Fits Fellegi–Sunter log-likelihood ratios from labeled pairs. Each example
 * is { features, match } where features come from computeFeatures.
 */
function fitCalibration(examples, { priorMatchRate }) {
  const features = {};
  for (const [name, definition] of Object.entries(FEATURES)) {
    const binCount = (definition.categories || definition.bins).length;
    const matchCounts = new Array(binCount).fill(0);
    const nonMatchCounts = new Array(binCount).fill(0);
    for (const example of examples) {
      const bin = featureBin(name, example.features[name]);
      if (bin === null || bin < 0) {
        continue;
      }
      (example.match ? matchCounts : nonMatchCounts)[bin] += 1;
    }
    const matchTotal = matchCounts.reduce((sum, count) => sum + count, 0);
    const nonMatchTotal = nonMatchCounts.reduce((sum, count) => sum + count, 0);
    features[name] = matchCounts.map((count, bin) => {
      const llr =
        Math.log((count + 1) / (matchTotal + binCount)) -
        Math.log((nonMatchCounts[bin] + 1) / (nonMatchTotal + binCount));
      return Number(Math.max(-MAX_FEATURE_LLR, Math.min(MAX_FEATURE_LLR, llr)).toFixed(4));
    });
  }
  const rate = Math.min(0.99, Math.max(0.01, priorMatchRate));
  return { priorLogOdds: Number(Math.log(rate / (1 - rate)).toFixed(4)), features };
}

function scorePair(features, calibration) {
  let logOdds = calibration.priorLogOdds;
  for (const name of Object.keys(FEATURES)) {
    const bin = featureBin(name, features[name]);
    if (bin !== null && bin >= 0 && calibration.features[name]) {
      logOdds += calibration.features[name][bin];
    }
  }
  return 1 / (1 + Math.exp(-logOdds));
}

/** Scores every candidate for a host, best first. */
function scoreCandidates(host, candidates, calibration) {
  return candidates
    .map(({ star, separation }) => {
      const features = computeFeatures(host, star, separation);
      return { star, separation, features, posterior: scorePair(features, calibration) };
    })
    .sort(
      (a, b) =>
        b.posterior - a.posterior ||
        a.separation - b.separation ||
        String(a.star.atHygId).localeCompare(String(b.star.atHygId))
    );
}

/**
 * Applies the tier-3 decision rule to candidates ranked by scoreCandidates.
 * Co-moving companions share distance and proper motion with the host, which
 * naive Bayes over-counts, so a best candidate that is wide (normalized
 * separation ≥ MAX_AUTO_SEPARATION_NORM) or differs by more than
 * MAX_AUTO_VMAG_DIFFERENCE in V goes to review instead of auto-matching.
 */
function decideScored(ranked, host = {}) {
  const [best, second] = ranked;
  if (!best) {
    return { decision: 'unmatched', tier: null, reasons: ['no-candidates'] };
  }
  const margin = best.posterior - (second ? second.posterior : 0);
  const evidence = { posterior: best.posterior, margin, separation: best.separation };
  const hostVMag = host.vMag ?? null;
  const guards = [];
  if (best.features && best.features.separation >= MAX_AUTO_SEPARATION_NORM) {
    guards.push('wide-separation');
  }
  if (
    hostVMag !== null &&
    best.star.vMag !== null &&
    Math.abs(hostVMag - best.star.vMag) > MAX_AUTO_VMAG_DIFFERENCE
  ) {
    guards.push('magnitude-mismatch');
  }
  if (best.posterior >= AUTO_MATCH_POSTERIOR && margin >= AUTO_MATCH_MARGIN && !guards.length) {
    return { ...evidence, decision: 'matched', tier: 'scored', star: best.star, reasons: [] };
  }
  if (best.posterior >= REVIEW_POSTERIOR) {
    let reasons = ['low-posterior'];
    if (best.posterior >= AUTO_MATCH_POSTERIOR) {
      reasons = guards.length ? guards : ['insufficient-margin'];
    }
    return { ...evidence, decision: 'review', tier: 'scored', star: best.star, reasons };
  }
  return { ...evidence, decision: 'unmatched', tier: null, reasons: ['below-threshold'] };
}

/** Archive distances a star may be compared with: sy_dist and, when present, 1000 / sy_plx. */
function hostDistances(host) {
  const distances = [knownDistance(host.distancePc)];
  if (host.parallaxMas > 0) {
    distances.push(knownDistance(1000 / host.parallaxMas));
  }
  return distances.filter(Boolean);
}

function closestDistanceDifference(host, star) {
  const starDistance = knownDistance(star.distancePc);
  const distances = hostDistances(host);
  if (!starDistance || !distances.length) {
    return null;
  }
  return Math.min(...distances.map((distance) => Math.abs(starDistance / distance - 1)));
}

/**
 * Tier-2 sanity gate for ID matches: the star must sit within 60″ and within
 * ±30% in distance (against sy_dist or the parallax distance, since TICv8
 * sy_dist is wrong for some nearby high proper-motion stars). Gliese-sourced
 * AT-HYG positions can be off by arcminutes, so a positional miss is accepted
 * when distance and proper motion both agree within 5%.
 */
function sanityGate(host, star, separation) {
  const reasons = [];
  const notes = [];
  const distanceDifference = closestDistanceDifference(host, star);
  if (distanceDifference !== null && distanceDifference > SANITY_MAX_DISTANCE_DIFFERENCE) {
    reasons.push(`distance differs by ${(distanceDifference * 100).toFixed(0)}%`);
  }
  if (!(separation < SANITY_MAX_SEPARATION_ARCSEC)) {
    const hostPm = totalProperMotionMasYr(host, 'pmRaMasYr', 'pmDecMasYr');
    const starPm = totalProperMotionMasYr(star, 'pmRa', 'pmDec');
    const kinematicMatch =
      distanceDifference !== null &&
      distanceDifference <= KINEMATIC_TOLERANCE &&
      hostPm !== null &&
      starPm !== null &&
      hostPm > 0 &&
      Math.hypot(host.pmRaMasYr - star.pmRa, host.pmDecMasYr - star.pmDec) / hostPm <=
        KINEMATIC_TOLERANCE;
    if (kinematicMatch) {
      notes.push(`position-offset-accepted: ${separation.toFixed(1)}″`);
    } else {
      reasons.push(`separation ${separation.toFixed(1)}″`);
    }
  }
  return { pass: reasons.length === 0, reasons, notes };
}

function uniqueStars(stars) {
  return [...new Map(stars.map((star) => [star.atHygId, star])).values()];
}

/**
 * Applies tiers 1–3 to one host.
 *
 * @param {object} host - exoplanet-hosts.json record without a match block
 * @param {object} inputs
 * @param {object[]} [inputs.idHits] - [{ via: 'gaia-dr3'|'hip'|'hd', star }]
 * @param {object[]} [inputs.candidates] - [{ star, separation }] inside the host's cone
 * @param {object} [inputs.override] - hostMatches entry from the overrides file
 * @param {object} [inputs.overrideStar] - AT-HYG star named by a match override
 * @param {object} inputs.calibration - fitted tier-3 constants
 */
function matchHost(host, { idHits = [], candidates = [], override, overrideStar, calibration }) {
  const base = { hostId: host.id, ranked: [] };
  if (override) {
    if (override.action === 'no-match') {
      return { ...base, decision: 'unmatched', tier: 'override', reasons: [override.reason] };
    }
    if (!overrideStar) {
      throw new Error(`Override for ${host.id} names unknown AT-HYG star ${override.atHygId}`);
    }
    return {
      ...base,
      decision: 'matched',
      tier: 'override',
      star: overrideStar,
      separation: separationArcsec(host, overrideStar),
      reasons: [override.reason],
    };
  }

  const reasons = [];
  const hitsByTier = new Map(ID_TIERS.map((tier) => [tier, []]));
  for (const hit of idHits) {
    hitsByTier.get(hit.via).push(hit.star);
  }
  const idStars = uniqueStars(idHits.map((hit) => hit.star));
  if (idStars.length > 1) {
    reasons.push(`ids-disagree:${idStars.map((star) => star.atHygId).join('|')}`);
  }

  for (const tier of ID_TIERS) {
    const stars = uniqueStars(hitsByTier.get(tier));
    if (!stars.length) {
      continue;
    }
    if (tier === 'hd' && (hostComponentSuffix(host.name) || stars.length > 1)) {
      reasons.push('hd-ambiguous');
      break;
    }
    if (stars.length > 1) {
      reasons.push(`${tier}-ambiguous`);
      break;
    }
    const [star] = stars;
    const separation = separationArcsec(host, star);
    const gate = sanityGate(host, star, separation);
    if (!gate.pass) {
      return {
        ...base,
        decision: 'review',
        tier,
        star,
        separation,
        reasons: [...reasons, ...gate.reasons.map((reason) => `sanity-gate: ${reason}`)],
      };
    }
    return {
      ...base,
      decision: 'matched',
      tier,
      star,
      separation,
      reasons: [...reasons, ...gate.notes],
    };
  }

  const ranked = scoreCandidates(host, candidates, calibration);
  const scored = decideScored(ranked, host);
  return { ...base, ...scored, ranked, reasons: [...reasons, ...scored.reasons] };
}

function compareClaims(a, b) {
  return (
    (TIER_RANK[a.tier] ?? 9) - (TIER_RANK[b.tier] ?? 9) ||
    (b.posterior ?? 1) - (a.posterior ?? 1) ||
    a.hostId.localeCompare(b.hostId)
  );
}

/**
 * Enforces one host per AT-HYG star. The strongest claim keeps the star; the
 * others move to the review queue. Two overrides on one star is a data error.
 */
function enforceOneToOne(results) {
  const claims = new Map();
  for (const result of results) {
    if (result.decision === 'matched') {
      const key = result.star.atHygId;
      if (!claims.has(key)) {
        claims.set(key, []);
      }
      claims.get(key).push(result);
    }
  }
  for (const [atHygId, claimants] of claims) {
    if (claimants.length < 2) {
      continue;
    }
    claimants.sort(compareClaims);
    if (claimants[1].tier === 'override') {
      throw new Error(`Overrides assign AT-HYG star ${atHygId} to more than one host`);
    }
    for (const loser of claimants.slice(1)) {
      loser.decision = 'review';
      loser.reasons = [...loser.reasons, `claimed-by:${claimants[0].hostId}`];
    }
  }
  return results;
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

const firstDefined = (...values) => values.find((value) => value !== null && value !== undefined);

/**
 * Resolves star facts for a host, applying the phase 2 precedence rule:
 * the archive wins for stellar physics; AT-HYG/HYG wins for position,
 * distance, and names. Unmatched hosts use archive values only.
 */
function resolveHostStar(host, star = null, hygStar = null) {
  const starDistance = star ? knownDistance(star.distancePc) : null;
  const useCatalogPosition = Boolean(star && starDistance && star.x !== null);
  const distancePc = useCatalogPosition ? starDistance : knownDistance(host.distancePc);
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

/** Deterministic 80/20 split by host ID for calibration (true = held out). */
function isHoldoutHost(hostId) {
  let hash = 2166136261;
  for (const char of hostId) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 5 === 0;
}

/** Neighbors a host is scored against: everything inside its cone. */
function conePool(host, neighbors = []) {
  const radius = coneRadiusArcsec(host);
  return neighbors.filter((candidate) => candidate.separation <= radius);
}

/** The star a host's IDs point to, when that ID match passes the sanity gate. */
function trustedIdStar(host, idHits = []) {
  if (!idHits.length) {
    return null;
  }
  const result = matchHost(host, { idHits, calibration: null });
  return result.decision === 'matched' && ID_TIERS.includes(result.tier) ? result.star : null;
}

/**
 * Labels host/star pairs for calibration. Positives are trusted ID matches;
 * negatives are every other star in the host's neighborhood.
 */
function buildCalibrationExamples(hosts, { idHits, neighbors }) {
  const examples = [];
  let poolHosts = 0;
  let poolCandidates = 0;
  for (const host of hosts) {
    const nearby = neighbors.get(host.id) || [];
    const pool = conePool(host, nearby);
    // Every host's cone candidates count toward the prior, so hosts without
    // usable IDs (mostly faint stars absent from AT-HYG) pull it down.
    poolCandidates += pool.length;
    const truth = trustedIdStar(host, idHits.get(host.id));
    if (!truth) {
      continue;
    }
    for (const { star, separation } of nearby) {
      examples.push({
        hostId: host.id,
        match: star.atHygId === truth.atHygId,
        features: computeFeatures(host, star, separation),
      });
    }
    if (pool.some(({ star }) => star.atHygId === truth.atHygId)) {
      poolHosts += 1;
    }
  }
  return { examples, priorMatchRate: poolCandidates ? poolHosts / poolCandidates : 0.5 };
}

/**
 * Scores held-out hosts the way the matcher will. Reports auto-match precision
 * and recall, plus the false-auto rate when the true star is removed from the
 * pool (a stand-in for faint hosts AT-HYG does not contain).
 */
function evaluateCalibration(hosts, { idHits, neighbors }, calibration) {
  const counts = { hosts: 0, autoMatches: 0, correct: 0, review: 0, truthRemovedAuto: 0 };
  for (const host of hosts) {
    const truth = trustedIdStar(host, idHits.get(host.id));
    const pool = truth ? conePool(host, neighbors.get(host.id)) : [];
    if (!pool.some(({ star }) => star.atHygId === truth.atHygId)) {
      continue;
    }
    counts.hosts += 1;
    const decision = decideScored(scoreCandidates(host, pool, calibration), host);
    if (decision.decision === 'matched') {
      counts.autoMatches += 1;
      if (decision.star.atHygId === truth.atHygId) counts.correct += 1;
    } else if (decision.decision === 'review') {
      counts.review += 1;
    }
    const withoutTruth = pool.filter(({ star }) => star.atHygId !== truth.atHygId);
    if (
      decideScored(scoreCandidates(host, withoutTruth, calibration), host).decision === 'matched'
    ) {
      counts.truthRemovedAuto += 1;
    }
  }
  const ratio = (numerator, denominator) =>
    denominator ? Number((numerator / denominator).toFixed(4)) : null;
  return {
    ...counts,
    precision: ratio(counts.correct, counts.autoMatches),
    recall: ratio(counts.correct, counts.hosts),
    truthRemovedFalseAutoRate: ratio(counts.truthRemovedAuto, counts.hosts),
  };
}
module.exports = {
  AUTO_MATCH_MARGIN,
  AUTO_MATCH_POSTERIOR,
  FEATURES,
  MAX_AUTO_SEPARATION_NORM,
  MAX_AUTO_VMAG_DIFFERENCE,
  MIN_CONE_ARCSEC,
  REVIEW_POSTERIOR,
  SANITY_MAX_SEPARATION_ARCSEC,
  angularSeparationArcsec,
  archiveEpochPositions,
  atHygStarFromRow,
  buildCalibrationExamples,
  buildHostGrid,
  conePool,
  evaluateCalibration,
  findNearbyHosts,
  computeFeatures,
  coneRadiusArcsec,
  decideScored,
  enforceOneToOne,
  equatorialToCartesian,
  fitCalibration,
  hdNumber,
  hostComponentSuffix,
  hostNameKeys,
  hygStarFromRow,
  isHoldoutHost,
  knownDistance,
  matchHost,
  normalizeDesignation,
  parseCsvLine,
  resolveHostStar,
  sanityGate,
  scoreCandidates,
  separationArcsec,
  starNameKeys,
  trustedIdStar,
};
