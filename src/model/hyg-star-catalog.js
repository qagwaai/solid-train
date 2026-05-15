'use strict';

/**
 * HYG (Hipparcos / Yale / Gliese) star catalog loader.
 *
 * The full HYG dataset lives at https://codeberg.org/astronexus/hyg.
 * For deterministic tests and lightweight server bootstrap we ship a fixture
 * CSV under data/hyg-fixture.csv that contains a handful of nearby systems
 * (Sol, Alpha Centauri A/B/Proxima, Sirius, Barnard's Star, Lalande 21185,
 * Wolf 359). Replace the fixture with a real HYG slice in production.
 *
 * Fields used (subset of HYG v3 columns):
 *   id            - HYG numeric id (also used as deterministic generator seed)
 *   hip           - Hipparcos catalog id
 *   hd            - Henry Draper catalog id
 *   proper        - common name ("Sirius A", "Proxima Centauri", ...)
 *   ra, dec       - right ascension (hours), declination (degrees)
 *   dist          - distance from Sol in parsecs
 *   mag           - apparent magnitude
 *   absmag        - absolute magnitude
 *   spect         - spectral type (e.g. "G2V", "M5.5Ve")
 *   ci            - B-V color index
 *   x, y, z       - galactic Cartesian position in parsecs
 *   lum           - luminosity in solar units
 *   system_id     - synthetic id grouping multi-star systems together
 *   system_role   - "primary" | "secondary" | "tertiary" | ...
 */

const fs = require('node:fs');
const path = require('node:path');

const PARSEC_KM = 3.085677581491367e13;
const SOLAR_MASS_KG = 1.98892e30;
const SOLAR_RADIUS_KM = 695700;

const SPECTRAL_CLASSES = ['O', 'B', 'A', 'F', 'G', 'K', 'M', 'L', 'T', 'Y'];

const DEFAULT_FIXTURE_PATH = path.join(__dirname, '..', '..', 'data', 'hyg-fixture.csv');

function splitCsvLine(line) {
  // Simple CSV split. Fixture has no quoted commas.
  return line.split(',').map((value) => value.trim());
}

function toNumber(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

/**
 * Convert a B-V color index into a CSS hex color (rough, game-grade).
 * Calibrated approximation: blue (B-V<=0) → blue-white; B-V~0.65 → yellow (Sun);
 * B-V>=1.5 → orange-red.
 */
function colorHexFromBv(bv) {
  if (bv === null || !Number.isFinite(bv)) {
    return '#ffffff';
  }
  const clamped = Math.max(-0.4, Math.min(2.0, bv));
  // Piecewise linear interpolation across known anchor points.
  /** @type {Array<[number, [number, number, number]]>} */
  const anchors = [
    [-0.4, [155, 188, 255]], // O5: blue
    [0.0, [200, 215, 255]], // A0: blue-white
    [0.3, [248, 247, 255]], // F0: white
    [0.58, [255, 244, 234]], // G0: yellow-white
    [0.65, [255, 237, 188]], // G2 (Sun): warm yellow
    [0.81, [255, 218, 152]], // K0: orange
    [1.4, [255, 180, 110]], // M0: deep orange
    [1.83, [255, 130, 90]], // M5: red-orange
    [2.0, [255, 100, 70]], // late-M / L: red
  ];

  /** @type {[number, [number, number, number]]} */
  let prev = anchors[0];
  /** @type {[number, [number, number, number]]} */
  let next = anchors[anchors.length - 1];
  for (let i = 1; i < anchors.length; i += 1) {
    if (clamped <= anchors[i][0]) {
      prev = anchors[i - 1];
      next = anchors[i];
      break;
    }
  }
  const span = next[0] - prev[0] || 1;
  const t = (clamped - prev[0]) / span;
  const rgb = [0, 1, 2].map((idx) => Math.round(prev[1][idx] + (next[1][idx] - prev[1][idx]) * t));
  return `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Parse "G2V", "M5.5Ve", "K1V" → primary class letter.
 */
function spectralClassLetter(spect) {
  const trimmed = toNonEmptyString(spect).toUpperCase();
  if (!trimmed) return 'G';
  const letter = trimmed[0];
  return SPECTRAL_CLASSES.includes(letter) ? letter : 'G';
}

/**
 * Parse a numeric subclass (0..9, possibly fractional). Defaults to 5.
 */
function spectralSubclass(spect) {
  const trimmed = toNonEmptyString(spect);
  const match = trimmed.match(/^[OBAFGKMLTY]([0-9](?:\.[0-9]+)?)/i);
  if (!match) return 5;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : 5;
}

/**
 * Approximate stellar mass in solar units from spectral class + subclass.
 * Game-grade lookup based on canonical main-sequence values.
 */
function massSolarFromSpectral(spectralClass, subclass) {
  const subclassFraction = Math.max(0, Math.min(9, subclass)) / 9;
  // Rough mid-range mass per class (M_sun) at subclass 5.
  const ranges = {
    O: [16, 60],
    B: [2.1, 16],
    A: [1.4, 2.1],
    F: [1.04, 1.4],
    G: [0.8, 1.04],
    K: [0.45, 0.8],
    M: [0.08, 0.45],
    L: [0.05, 0.08],
    T: [0.02, 0.05],
    Y: [0.01, 0.02],
  };
  const range = ranges[spectralClass] || ranges.G;
  // Lower subclass numbers => hotter/heavier within the class.
  return range[1] - (range[1] - range[0]) * subclassFraction;
}

/**
 * Approximate stellar radius (R_sun) from spectral class + subclass for main sequence.
 */
function radiusSolarFromSpectral(spectralClass, subclass) {
  const subclassFraction = Math.max(0, Math.min(9, subclass)) / 9;
  const ranges = {
    O: [6.6, 12],
    B: [1.8, 6.6],
    A: [1.4, 1.8],
    F: [1.15, 1.4],
    G: [0.96, 1.15],
    K: [0.7, 0.96],
    M: [0.1, 0.7],
    L: [0.08, 0.1],
    T: [0.06, 0.08],
    Y: [0.04, 0.06],
  };
  const range = ranges[spectralClass] || ranges.G;
  return range[1] - (range[1] - range[0]) * subclassFraction;
}

function parseHygCsv(text) {
  const lines = text.split(/\r?\n/).filter((line) => line && !line.startsWith('#'));
  if (lines.length === 0) return [];
  const header = splitCsvLine(lines[0]);
  const idxOf = (name) => header.indexOf(name);
  const records = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = splitCsvLine(lines[i]);
    if (cols.length === 0 || (cols.length === 1 && cols[0] === '')) continue;
    const hygId = toNonEmptyString(cols[idxOf('id')]);
    const proper = toNonEmptyString(cols[idxOf('proper')]);
    const spect = toNonEmptyString(cols[idxOf('spect')]);
    const spectralClass = spectralClassLetter(spect);
    const subclass = spectralSubclass(spect);
    const ci = toNumber(cols[idxOf('ci')]);
    const lum = toNumber(cols[idxOf('lum')]);
    const massSolar = massSolarFromSpectral(spectralClass, subclass);
    const radiusSolar = radiusSolarFromSpectral(spectralClass, subclass);
    const dist = toNumber(cols[idxOf('dist')]);
    const x = toNumber(cols[idxOf('x')]) || 0;
    const y = toNumber(cols[idxOf('y')]) || 0;
    const z = toNumber(cols[idxOf('z')]) || 0;
    records.push({
      hygId,
      hipId: toNonEmptyString(cols[idxOf('hip')]) || null,
      hdId: toNonEmptyString(cols[idxOf('hd')]) || null,
      properName: proper || null,
      raHours: toNumber(cols[idxOf('ra')]),
      decDeg: toNumber(cols[idxOf('dec')]),
      distanceParsec: dist,
      apparentMagnitude: toNumber(cols[idxOf('mag')]),
      absoluteMagnitude: toNumber(cols[idxOf('absmag')]),
      spectralType: spect || null,
      spectralClass,
      spectralSubclass: subclass,
      colorIndexBv: ci,
      colorHex: colorHexFromBv(ci),
      luminositySolar: Number.isFinite(lum) ? lum : null,
      massSolar,
      radiusSolar,
      radiusKm: radiusSolar * SOLAR_RADIUS_KM,
      massKg: massSolar * SOLAR_MASS_KG,
      positionPc: { x, y, z },
      systemId: toNonEmptyString(cols[idxOf('system_id')]) || `hyg-${hygId}`,
      systemRole: toNonEmptyString(cols[idxOf('system_role')]) || 'primary',
    });
  }
  return records;
}

function loadHygFixture(fixturePath = DEFAULT_FIXTURE_PATH) {
  const text = fs.readFileSync(fixturePath, 'utf8');
  return parseHygCsv(text);
}

function indexBySystemId(records) {
  const map = new Map();
  for (const star of records) {
    if (!map.has(star.systemId)) {
      map.set(star.systemId, []);
    }
    map.get(star.systemId).push(star);
  }
  return map;
}

let cachedRecords = null;
function getHygStars() {
  if (!cachedRecords) {
    cachedRecords = loadHygFixture();
  }
  return cachedRecords;
}

function getHygSystems() {
  const records = getHygStars();
  const bySystem = indexBySystemId(records);
  const systems = [];
  for (const [systemId, stars] of bySystem.entries()) {
    const primary = stars.find((s) => s.systemRole === 'primary') || stars[0];
    systems.push({
      systemId,
      displayName: primary?.properName
        ? primary.properName.replace(/\s*[AB]$/i, '').trim()
        : systemId,
      stars: stars.slice().sort((a, b) => {
        const order = ['primary', 'secondary', 'tertiary'];
        return order.indexOf(a.systemRole) - order.indexOf(b.systemRole);
      }),
      primaryHygId: primary?.hygId || null,
      positionPc: primary?.positionPc || { x: 0, y: 0, z: 0 },
      distanceParsec: primary?.distanceParsec ?? null,
      isMultiStar: stars.length > 1,
    });
  }
  return systems;
}

function clearCache() {
  cachedRecords = null;
}

module.exports = {
  PARSEC_KM,
  SOLAR_MASS_KG,
  SOLAR_RADIUS_KM,
  SPECTRAL_CLASSES,
  parseHygCsv,
  loadHygFixture,
  getHygStars,
  getHygSystems,
  colorHexFromBv,
  spectralClassLetter,
  spectralSubclass,
  massSolarFromSpectral,
  radiusSolarFromSpectral,
  clearCache,
};
