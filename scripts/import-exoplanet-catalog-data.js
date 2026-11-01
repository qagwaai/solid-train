'use strict';

const fs = require('node:fs');
const path = require('node:path');
const cheerio = require('cheerio');

const DATA_DIR = path.join(__dirname, '..', 'data');
const PLANETS_FILE = 'exoplanet-planets.json';
const HOSTS_FILE = 'exoplanet-hosts.json';
const REFERENCES_FILE = 'exoplanet-references.json';
const LICENSE_FILE = 'LICENSE-exoplanet-catalog.md';

const ARCHIVE_NAME = 'NASA Exoplanet Archive';
const ARCHIVE_BASE_URL = 'https://exoplanetarchive.ipac.caltech.edu';
const TAP_SYNC_URL = `${ARCHIVE_BASE_URL}/TAP/sync`;
const ARCHIVE_TABLE = 'pscomppars';
const ARCHIVE_TABLE_DOCS_URL = `${ARCHIVE_BASE_URL}/docs/API_PS_columns.html`;
const ADS_ABSTRACT_PREFIX = 'https://ui.adsabs.harvard.edu/abs/';
const DATA_LICENSE = 'CC BY-SA 4.0';

const PLANET_MINIMUM = 6000;
const HOST_MINIMUM = 4500;
const SHRINKAGE_LIMIT = 0.02;
const FETCH_TIMEOUT_MS = 180_000;
const FETCH_ATTEMPTS = 3;
const EARTH_MASSES_PER_SOLAR_MASS = 332946.0487;
const DAYS_PER_JULIAN_YEAR = 365.25;

// Planet fields copied from pscomppars, in output order.
const PLANET_FIELDS = [
  ['pl_orbper', 'orbitalPeriodDays'],
  ['pl_orbsmax', 'semiMajorAxisAu'],
  ['pl_orbeccen', 'eccentricity'],
  ['pl_orbincl', 'inclinationDeg'],
  ['pl_orblper', 'argumentOfPeriapsisDeg'],
  ['pl_orbtper', 'periapsisTimeJd'],
  ['pl_tranmid', 'transitMidpointJd'],
  ['pl_rade', 'radiusEarth'],
  ['pl_bmasse', 'massEarth'],
  ['pl_dens', 'densityGcm3'],
  ['pl_eqt', 'equilibriumTempK'],
  ['pl_insol', 'insolationEarth'],
];

// Host fields copied from pscomppars, in output order.
const HOST_FIELDS = [
  ['ra', 'raDeg'],
  ['dec', 'decDeg'],
  ['sy_dist', 'distancePc'],
  ['sy_plx', 'parallaxMas'],
  ['sy_pmra', 'pmRaMasYr'],
  ['sy_pmdec', 'pmDecMasYr'],
  ['sy_vmag', 'vMag'],
  ['sy_gaiamag', 'gaiaMag'],
  ['st_teff', 'teffK'],
  ['st_rad', 'radiusSolar'],
  ['st_mass', 'massSolar'],
  ['st_lum', 'logLuminositySolar'],
  ['st_met', 'metallicityDex'],
  ['st_age', 'ageGyr'],
];

const HOST_TEXT_FIELDS = [
  ['st_spectype', 'spectralType'],
  ['hd_name', 'hdName'],
];

const HOST_ID_FIELDS = [
  ['hip_name', 'hipId', /^HIP\s+(\d+)/],
  ['tic_id', 'ticId', /^TIC\s+(\d+)/],
  ['gaia_dr2_id', 'gaiaDr2Id', /^Gaia DR2\s+(\d+)/],
  ['gaia_dr3_id', 'gaiaDr3Id', /^Gaia DR3\s+(\d+)/],
];

const HOST_COUNT_FIELDS = [
  ['sy_snum', 'starCount'],
  ['sy_pnum', 'planetCount'],
  ['sy_mnum', 'moonCount'],
];

// Reference columns; the discovery reference is always listed first.
const REFERENCE_COLUMNS = [
  'disc_refname',
  'pl_orbper_reflink',
  'pl_orbsmax_reflink',
  'pl_orbeccen_reflink',
  'pl_orbincl_reflink',
  'pl_orblper_reflink',
  'pl_orbtper_reflink',
  'pl_tranmid_reflink',
  'pl_rade_reflink',
  'pl_bmasse_reflink',
  'pl_dens_reflink',
  'pl_eqt_reflink',
  'pl_insol_reflink',
  'sy_dist_reflink',
  'st_spectype_reflink',
  'st_teff_reflink',
  'st_rad_reflink',
  'st_mass_reflink',
  'st_lum_reflink',
  'st_met_reflink',
  'st_age_reflink',
];

const ARCHIVE_COLUMNS = [
  'pl_name',
  'pl_letter',
  'hostname',
  'cb_flag',
  'pl_controv_flag',
  'pl_bmassprov',
  'disc_year',
  'discoverymethod',
  'disc_facility',
  ...PLANET_FIELDS.map(([column]) => column),
  ...HOST_FIELDS.map(([column]) => column),
  ...HOST_TEXT_FIELDS.map(([column]) => column),
  ...HOST_ID_FIELDS.map(([column]) => column),
  ...HOST_COUNT_FIELDS.map(([column]) => column),
  ...REFERENCE_COLUMNS,
];

const NUMERIC_RANGES = {
  orbitalPeriodDays: { min: 0, exclusiveMin: true },
  semiMajorAxisAu: { min: 0, exclusiveMin: true },
  eccentricity: { min: 0, max: 1, exclusiveMax: true },
  inclinationDeg: { min: 0, max: 180 },
  argumentOfPeriapsisDeg: { min: 0, max: 360, exclusiveMax: true },
  radiusEarth: { min: 0, exclusiveMin: true },
  massEarth: { min: 0, exclusiveMin: true },
  densityGcm3: { min: 0, exclusiveMin: true },
  equilibriumTempK: { min: 0, exclusiveMin: true },
  insolationEarth: { min: 0 },
  raDeg: { min: 0, max: 360, exclusiveMax: true },
  decDeg: { min: -90, max: 90 },
  distancePc: { min: 0, exclusiveMin: true },
  teffK: { min: 0, exclusiveMin: true },
  radiusSolar: { min: 0, exclusiveMin: true },
  massSolar: { min: 0, exclusiveMin: true },
  ageGyr: { min: 0 },
  starCount: { min: 1 },
  planetCount: { min: 1 },
  moonCount: { min: 0 },
};

function buildTapQuery() {
  return `select ${ARCHIVE_COLUMNS.join(',')} from ${ARCHIVE_TABLE}`;
}

function buildTapUrl() {
  return `${TAP_SYNC_URL}?query=${encodeURIComponent(buildTapQuery())}&format=json`;
}

function slugify(value) {
  const slug = String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!slug) {
    throw new Error(`Cannot build an ID from ${JSON.stringify(value)}`);
  }
  return slug;
}

function planetIdFor(planetName) {
  return `exo-${slugify(planetName)}`;
}

function hostIdFor(hostName) {
  return `exo-host-${slugify(hostName)}`;
}

function cleanText(value) {
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value).replace(/\s+/g, ' ').trim();
  return text || null;
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : Number.NaN;
}

function roundSignificant(value, digits = 6) {
  return Number(value.toPrecision(digits));
}

/**
 * Parses an archive reference anchor into a [key, label] pair. The key is an
 * ADS bibcode when the link points at ADS, otherwise an absolute URL. Labels
 * are plain text; callers must never render them as HTML.
 */
function parseReferenceAnchor(html) {
  const source = cleanText(html);
  if (!source) {
    return null;
  }
  const $ = cheerio.load(source, null, false);
  const anchor = $('a').first();
  const label = cleanText(anchor.length ? anchor.text() : $.root().text());
  const href = cleanText(anchor.attr('href'));
  if (!href || !label) {
    return null;
  }
  if (href.startsWith(ADS_ABSTRACT_PREFIX)) {
    const bibcode = decodeURIComponent(
      href.slice(ADS_ABSTRACT_PREFIX.length).replace(/\/abstract\/?$/, '')
    );
    if (/^\d{4}\S{15}$/.test(bibcode)) {
      return [bibcode, label];
    }
  }
  const absoluteUrl = new URL(href, ARCHIVE_BASE_URL);
  if (absoluteUrl.protocol !== 'https:' && absoluteUrl.protocol !== 'http:') {
    return null;
  }
  return [absoluteUrl.href, label];
}

/**
 * Builds the reference table and per-planet index lists. Entries from the
 * previous table keep their index so monthly diffs stay small; new entries are
 * appended in key order. When rows disagree on a label, the most common label
 * wins (ties go to the alphabetically first) so output never depends on row
 * order.
 */
function buildReferenceTable(rows, previousEntries = []) {
  const entries = previousEntries.map(([key, label]) => [key, label]);
  const indexByKey = new Map(entries.map(([key], index) => [key, index]));
  const refsByPlanet = new Map();
  const labelCounts = new Map();

  for (const row of rows) {
    const keys = [];
    for (const column of REFERENCE_COLUMNS) {
      const parsed = parseReferenceAnchor(row[column]);
      if (!parsed) {
        continue;
      }
      const [key, label] = parsed;
      if (!keys.includes(key)) {
        keys.push(key);
      }
      if (!labelCounts.has(key)) {
        labelCounts.set(key, new Map());
      }
      const counts = labelCounts.get(key);
      counts.set(label, (counts.get(label) || 0) + 1);
    }
    refsByPlanet.set(row.pl_name, keys);
  }

  const labelFor = (key) =>
    [...labelCounts.get(key)].sort(
      ([labelA, countA], [labelB, countB]) => countB - countA || (labelA < labelB ? -1 : 1)
    )[0][0];
  for (const key of [...labelCounts.keys()].sort()) {
    if (indexByKey.has(key)) {
      entries[indexByKey.get(key)][1] = labelFor(key);
    } else {
      indexByKey.set(key, entries.length);
      entries.push([key, labelFor(key)]);
    }
  }

  const used = new Set();
  const refIndexesByPlanet = new Map();
  for (const [planetName, keys] of refsByPlanet) {
    const indexes = keys.map((key) => indexByKey.get(key));
    indexes.forEach((index) => used.add(index));
    refIndexesByPlanet.set(planetName, indexes);
  }
  return { entries, refIndexesByPlanet, unusedCount: entries.length - used.size };
}

function solveSemiMajorAxisAu(periodDays, starMassSolar, planetMassEarth) {
  const totalMass = starMassSolar + (planetMassEarth || 0) / EARTH_MASSES_PER_SOLAR_MASS;
  return Math.cbrt(totalMass * (periodDays / DAYS_PER_JULIAN_YEAR) ** 2);
}

function solvePeriodDays(semiMajorAxisAu, starMassSolar, planetMassEarth) {
  const totalMass = starMassSolar + (planetMassEarth || 0) / EARTH_MASSES_PER_SOLAR_MASS;
  return DAYS_PER_JULIAN_YEAR * Math.sqrt(semiMajorAxisAu ** 3 / totalMass);
}

/**
 * Fills a missing period or semi-major axis from the other using Kepler's
 * third law (D20). Derived values are not flagged; this is a game catalog.
 */
function deriveOrbit(planet, starMassSolar) {
  if (!(starMassSolar > 0)) {
    return planet;
  }
  const { orbitalPeriodDays: period, semiMajorAxisAu: axis, massEarth } = planet;
  if (axis === undefined && period > 0) {
    return {
      ...planet,
      semiMajorAxisAu: roundSignificant(solveSemiMajorAxisAu(period, starMassSolar, massEarth)),
    };
  }
  if (period === undefined && axis > 0) {
    return {
      ...planet,
      orbitalPeriodDays: roundSignificant(solvePeriodDays(axis, starMassSolar, massEarth)),
    };
  }
  return planet;
}

function assignNumbers(target, row, fields) {
  for (const [column, key] of fields) {
    const value = toNumber(row[column]);
    if (value !== null) {
      target[key] = value;
    }
  }
  return target;
}

function normalizePlanet(row, refIndexes = []) {
  const name = cleanText(row.pl_name);
  const hostName = cleanText(row.hostname);
  if (!name || !hostName) {
    throw new Error(`Archive row is missing pl_name or hostname: ${JSON.stringify(row)}`);
  }
  const planet = {
    id: planetIdFor(name),
    name,
    hostId: hostIdFor(hostName),
    status: 'confirmed',
  };
  const letter = cleanText(row.pl_letter);
  if (letter) {
    planet.letter = letter;
  }
  if (toNumber(row.pl_controv_flag) === 1) {
    planet.controversial = true;
  }
  if (toNumber(row.cb_flag) === 1) {
    planet.circumbinary = true;
  }
  assignNumbers(planet, row, PLANET_FIELDS);
  if (Number.isFinite(planet.argumentOfPeriapsisDeg)) {
    planet.argumentOfPeriapsisDeg = roundSignificant(
      ((planet.argumentOfPeriapsisDeg % 360) + 360) % 360,
      12
    );
  }
  const massProvenance = cleanText(row.pl_bmassprov);
  if (massProvenance && planet.massEarth !== undefined) {
    planet.massProvenance = massProvenance;
  }
  const discoveryYear = toNumber(row.disc_year);
  if (discoveryYear !== null) {
    planet.discoveryYear = discoveryYear;
  }
  const discoveryMethod = cleanText(row.discoverymethod);
  if (discoveryMethod) {
    planet.discoveryMethod = discoveryMethod;
  }
  const discoveryFacility = cleanText(row.disc_facility);
  if (discoveryFacility) {
    planet.discoveryFacility = discoveryFacility;
  }
  if (refIndexes.length) {
    planet.refs = refIndexes;
  }
  return deriveOrbit(planet, toNumber(row.st_mass));
}

// pscomppars repeats host values on every planet row and they can disagree;
// pick the most common value, breaking ties by first occurrence.
function pickConsensus(values) {
  const counts = new Map();
  for (const value of values) {
    if (value !== null && value !== undefined && !Number.isNaN(value)) {
      counts.set(value, (counts.get(value) || 0) + 1);
    }
  }
  let best;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return { value: best, conflict: counts.size > 1 };
}

function normalizeHosts(rows) {
  const rowsByHost = new Map();
  for (const row of [...rows].sort((a, b) => String(a.pl_name).localeCompare(b.pl_name))) {
    const hostName = cleanText(row.hostname);
    if (!rowsByHost.has(hostName)) {
      rowsByHost.set(hostName, []);
    }
    rowsByHost.get(hostName).push(row);
  }

  const hosts = [];
  const conflicts = new Map();
  const noteConflict = (key, conflict) => {
    if (conflict) {
      conflicts.set(key, (conflicts.get(key) || 0) + 1);
    }
  };

  for (const [name, hostRows] of rowsByHost) {
    const host = { id: hostIdFor(name), name };
    for (const [column, key, pattern] of HOST_ID_FIELDS) {
      const { value, conflict } = pickConsensus(
        hostRows.map((row) => {
          const match = pattern.exec(cleanText(row[column]) || '');
          return match ? match[1] : null;
        })
      );
      noteConflict(key, conflict);
      if (value !== undefined) {
        host[key] = value;
      }
    }
    for (const [column, key] of HOST_TEXT_FIELDS) {
      const { value, conflict } = pickConsensus(hostRows.map((row) => cleanText(row[column])));
      noteConflict(key, conflict);
      if (value !== undefined) {
        host[key] = value;
      }
    }
    for (const [column, key] of [...HOST_COUNT_FIELDS, ...HOST_FIELDS]) {
      const { value, conflict } = pickConsensus(hostRows.map((row) => toNumber(row[column])));
      noteConflict(key, conflict);
      if (value !== undefined) {
        host[key] = value;
      }
    }
    host.planetIds = hostRows.map((row) => planetIdFor(cleanText(row.pl_name))).sort();
    hosts.push(host);
  }

  hosts.sort((a, b) => a.id.localeCompare(b.id));
  return { hosts, conflicts: Object.fromEntries([...conflicts].sort()) };
}

function checkRange(errors, label, key, value) {
  if (typeof value !== 'number') {
    return;
  }
  if (!Number.isFinite(value)) {
    errors.push(`${label}: ${key} is not a finite number`);
    return;
  }
  const range = NUMERIC_RANGES[key];
  if (!range) {
    return;
  }
  const belowMin =
    range.min !== undefined && (range.exclusiveMin ? value <= range.min : value < range.min);
  const aboveMax =
    range.max !== undefined && (range.exclusiveMax ? value >= range.max : value > range.max);
  if (belowMin || aboveMax) {
    errors.push(`${label}: ${key}=${value} is out of range`);
  }
}

function findDuplicates(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }
  return [...duplicates];
}

function validateCatalog(
  { planets, hosts, references },
  { planetMinimum = PLANET_MINIMUM, hostMinimum = HOST_MINIMUM } = {}
) {
  const errors = [];
  if (planets.length < planetMinimum) {
    errors.push(`Expected at least ${planetMinimum} planets, got ${planets.length}`);
  }
  if (hosts.length < hostMinimum) {
    errors.push(`Expected at least ${hostMinimum} hosts, got ${hosts.length}`);
  }
  for (const id of findDuplicates(planets.map((planet) => planet.id))) {
    errors.push(`Duplicate planet ID ${id}`);
  }
  for (const id of findDuplicates(hosts.map((host) => host.id))) {
    errors.push(`Duplicate host ID ${id}`);
  }
  const hostIds = new Set(hosts.map((host) => host.id));
  for (const planet of planets) {
    if (!hostIds.has(planet.hostId)) {
      errors.push(`${planet.id}: unknown host ${planet.hostId}`);
    }
    for (const [key, value] of Object.entries(planet)) {
      checkRange(errors, planet.id, key, value);
    }
    for (const index of planet.refs || []) {
      if (!Number.isInteger(index) || index < 0 || index >= references.length) {
        errors.push(`${planet.id}: reference index ${index} is out of range`);
      }
    }
  }
  for (const host of hosts) {
    for (const [key, value] of Object.entries(host)) {
      checkRange(errors, host.id, key, value);
    }
  }
  return errors;
}

/**
 * Compares planet IDs with the previous snapshot. Fails when more than 2% of
 * previously known planets disappear unless the override is acknowledged.
 */
function checkShrinkage(previousIds, currentIds, { allowShrink = false } = {}) {
  const current = new Set(currentIds);
  const previous = new Set(previousIds);
  const removed = [...previous].filter((id) => !current.has(id)).sort();
  const added = [...current].filter((id) => !previous.has(id)).sort();
  const ratio = previous.size ? removed.length / previous.size : 0;
  const exceeded = ratio > SHRINKAGE_LIMIT;
  return { added, removed, ratio, exceeded, blocked: exceeded && !allowShrink };
}

/**
 * Serializes a snapshot with one record per line so git diffs stay readable
 * while the file stays compact.
 */
function serializeSnapshot(metadata, records) {
  const lines = Object.entries(metadata).map(
    ([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)}`
  );
  const body = records.map((record) => `    ${JSON.stringify(record)}`).join(',\n');
  lines.push(`  "records": [${records.length ? `\n${body}\n  ` : ''}]`);
  return `{\n${lines.join(',\n')}\n}\n`;
}

function buildCatalog(rows, { previousReferences = [] } = {}) {
  const { entries, refIndexesByPlanet, unusedCount } = buildReferenceTable(
    rows,
    previousReferences
  );
  const planets = rows
    .map((row) => normalizePlanet(row, refIndexesByPlanet.get(row.pl_name)))
    .sort((a, b) => a.id.localeCompare(b.id));
  const { hosts, conflicts } = normalizeHosts(rows);
  return {
    planets,
    hosts,
    references: entries,
    report: { hostFieldConflicts: conflicts, unusedReferences: unusedCount },
  };
}

function readSnapshotRecords(fileName) {
  const filePath = path.join(DATA_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8')).records || [];
}

async function fetchArchiveRows(url = buildTapUrl()) {
  let lastError;
  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!response.ok) {
        throw new Error(`Exoplanet Archive request failed (${response.status}): ${url}`);
      }
      const rows = await response.json();
      if (!Array.isArray(rows)) {
        throw new Error('Exoplanet Archive response is not a JSON array');
      }
      return rows;
    } catch (error) {
      lastError = error;
      if (attempt < FETCH_ATTEMPTS) {
        console.warn(`Attempt ${attempt} failed (${error.message}); retrying`);
        await new Promise((resolve) => setTimeout(resolve, 5000 * attempt));
      }
    }
  }
  throw lastError;
}

function isShrinkOverride(argv, env) {
  return argv.includes('--allow-shrink') || env.EXOPLANET_ALLOW_SHRINK === '1';
}

async function main(argv = process.argv.slice(2), env = process.env) {
  const allowShrink = isShrinkOverride(argv, env);
  const rows = await fetchArchiveRows();
  const previousPlanets = readSnapshotRecords(PLANETS_FILE);
  const catalog = buildCatalog(rows, {
    previousReferences: readSnapshotRecords(REFERENCES_FILE),
  });

  const errors = validateCatalog(catalog);
  if (errors.length) {
    throw new Error(
      `Exoplanet catalog validation failed (${errors.length}):\n${errors.slice(0, 50).join('\n')}`
    );
  }
  const shrinkage = checkShrinkage(
    previousPlanets.map((planet) => planet.id),
    catalog.planets.map((planet) => planet.id),
    { allowShrink }
  );
  if (shrinkage.blocked) {
    throw new Error(
      `${shrinkage.removed.length} planets (${(shrinkage.ratio * 100).toFixed(1)}%) disappeared ` +
        'since the last snapshot. Re-run with --allow-shrink or EXOPLANET_ALLOW_SHRINK=1 after ' +
        `review. Removed: ${shrinkage.removed.slice(0, 20).join(', ')}`
    );
  }

  const snapshotDate = new Date().toISOString().slice(0, 10);
  const shared = {
    source: ARCHIVE_NAME,
    sourceUrl: TAP_SYNC_URL,
    sourceTable: ARCHIVE_TABLE,
    sourceDocsUrl: ARCHIVE_TABLE_DOCS_URL,
    snapshotDate,
    license: DATA_LICENSE,
    licenseFile: `data/${LICENSE_FILE}`,
  };
  const snapshots = [
    [PLANETS_FILE, { ...shared, recordCount: catalog.planets.length }, catalog.planets],
    [HOSTS_FILE, { ...shared, recordCount: catalog.hosts.length }, catalog.hosts],
    [
      REFERENCES_FILE,
      {
        ...shared,
        recordFormat: '[key, label]; key is an ADS bibcode or an absolute URL',
        adsUrlTemplate: `${ADS_ABSTRACT_PREFIX}{bibcode}/abstract`,
        recordCount: catalog.references.length,
      },
      catalog.references,
    ],
  ];
  for (const [fileName, metadata, records] of snapshots) {
    fs.writeFileSync(path.join(DATA_DIR, fileName), serializeSnapshot(metadata, records), 'utf8');
  }

  console.log(
    `Wrote ${catalog.planets.length} planets, ${catalog.hosts.length} hosts, and ` +
      `${catalog.references.length} references (${snapshotDate})`
  );
  console.log(
    `Since last snapshot: +${shrinkage.added.length} / -${shrinkage.removed.length} planets` +
      (shrinkage.exceeded ? ' (shrinkage override acknowledged)' : '')
  );
  console.log(`Unused references kept for stable indexes: ${catalog.report.unusedReferences}`);
  console.log(`Host field conflicts: ${JSON.stringify(catalog.report.hostFieldConflicts)}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  ARCHIVE_COLUMNS,
  buildCatalog,
  buildReferenceTable,
  buildTapQuery,
  checkShrinkage,
  deriveOrbit,
  hostIdFor,
  isShrinkOverride,
  normalizeHosts,
  normalizePlanet,
  parseReferenceAnchor,
  planetIdFor,
  serializeSnapshot,
  slugify,
  validateCatalog,
};
