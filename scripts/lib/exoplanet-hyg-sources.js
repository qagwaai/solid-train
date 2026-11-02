'use strict';

/**
 * I/O helpers for the HYG v4.4 and AT-HYG v4.0 catalogs used by the exoplanet
 * host cross-match: cached downloads verified against Codeberg Git LFS
 * pointers, and streaming gzip CSV readers.
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const zlib = require('node:zlib');

const {
  atHygStarFromRow,
  buildHostGrid,
  findNearbyHosts,
  hdNumber,
  hygStarFromRow,
  parseCsvLine,
} = require('./exoplanet-crossmatch');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const DEFAULT_CACHE_DIR = path.join(ROOT_DIR, '.cache', 'exoplanet');

const HYG_SOURCES = {
  hyg: {
    label: 'HYG v4.4',
    fileName: 'hyg_v44.csv.gz',
    pointerUrl:
      'https://codeberg.org/astronexus/hyg/raw/branch/main/data/hyg/CURRENT/hyg_v44.csv.gz',
    fileUrl:
      'https://codeberg.org/astronexus/hyg/media/branch/main/data/hyg/CURRENT/hyg_v44.csv.gz',
  },
  atHyg: {
    label: 'AT-HYG v4.0',
    fileName: 'athyg_40.csv.gz',
    pointerUrl: 'https://codeberg.org/astronexus/athyg/raw/branch/main/data/athyg_40.csv.gz',
    fileUrl: 'https://codeberg.org/astronexus/athyg/media/branch/main/data/athyg_40.csv.gz',
  },
};

function cacheDirectory() {
  return process.env.EXOPLANET_CACHE_DIR
    ? path.resolve(process.env.EXOPLANET_CACHE_DIR)
    : DEFAULT_CACHE_DIR;
}

function parseLfsPointer(text) {
  const sha = /^oid sha256:([0-9a-f]{64})$/m.exec(text);
  const size = /^size (\d+)$/m.exec(text);
  if (!sha || !size) {
    throw new Error('Not a Git LFS pointer');
  }
  return { sha256: sha[1], size: Number(size[1]) };
}

async function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  await pipeline(fs.createReadStream(filePath), hash);
  return hash.digest('hex');
}

async function fetchPointer(source, fetchImpl) {
  const response = await fetchImpl(source.pointerUrl, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) {
    throw new Error(`${source.label} pointer request failed: HTTP ${response.status}`);
  }
  return parseLfsPointer(await response.text());
}

async function download(source, target, fetchImpl) {
  const response = await fetchImpl(source.fileUrl, { signal: AbortSignal.timeout(30 * 60_000) });
  if (!response.ok || !response.body) {
    throw new Error(`${source.label} download failed: HTTP ${response.status}`);
  }
  await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(target));
}

/**
 * Returns a local path to a verified copy of the source. The LFS pointer's
 * SHA-256 is the source of truth; a cached file that matches is reused. When
 * the pointer cannot be fetched, an existing cache is used with a warning.
 */
async function ensureSource(
  source,
  { cacheDir = cacheDirectory(), fetchImpl = fetch, log = console.log } = {}
) {
  const filePath = path.join(cacheDir, source.fileName);
  const cached = fs.existsSync(filePath);
  let pointer;
  try {
    pointer = await fetchPointer(source, fetchImpl);
  } catch (error) {
    if (!cached) {
      throw error;
    }
    log(`WARNING: ${error.message}; using unverified cache ${filePath}`);
    return { ...source, path: filePath, sha256: await sha256File(filePath), verified: false };
  }

  if (cached && (await sha256File(filePath)) === pointer.sha256) {
    return { ...source, path: filePath, sha256: pointer.sha256, verified: true };
  }

  fs.mkdirSync(cacheDir, { recursive: true });
  const temporary = `${filePath}.tmp`;
  log(`Downloading ${source.label} (${(pointer.size / 1e6).toFixed(1)} MB)...`);
  await download(source, temporary, fetchImpl);
  const actual = await sha256File(temporary);
  if (actual !== pointer.sha256) {
    fs.rmSync(temporary, { force: true });
    throw new Error(`${source.label} checksum mismatch: expected ${pointer.sha256}, got ${actual}`);
  }
  fs.renameSync(temporary, filePath);
  return { ...source, path: filePath, sha256: actual, verified: true };
}

/** Streams a gzip (or plain) CSV, calling onRow with a header-keyed object per line. */
async function readCsv(filePath, onRow) {
  let input = fs.createReadStream(filePath);
  if (filePath.endsWith('.gz')) {
    input = input.pipe(zlib.createGunzip());
  }
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  let header = null;
  let count = 0;
  for await (const line of lines) {
    if (!line) {
      continue;
    }
    const values = parseCsvLine(line);
    if (!header) {
      header = values;
      continue;
    }
    const row = {};
    for (let index = 0; index < header.length; index += 1) {
      row[header[index]] = values[index];
    }
    onRow(row);
    count += 1;
  }
  return count;
}

/** Loads HYG v4.4 into memory keyed by HYG id, plus multiple-star base groups. */
async function loadHygStars(filePath) {
  const byId = new Map();
  const baseGroups = new Map();
  await readCsv(filePath, (row) => {
    const star = hygStarFromRow(row);
    byId.set(star.hygId, star);
    if (star.base) {
      if (!baseGroups.has(star.base)) {
        baseGroups.set(star.base, []);
      }
      baseGroups.get(star.base).push(star.hygId);
    }
  });
  return { byId, baseGroups };
}

function pushTo(map, key, value) {
  if (!map.has(key)) {
    map.set(key, []);
  }
  map.get(key).push(value);
}

/**
 * Streams AT-HYG once and gathers everything the match needs: ID hits, stars
 * near each host, and rows the caller asked for by HYG or AT-HYG id.
 *
 * @param {string} filePath
 * @param {object[]} hosts - exoplanet host records
 * @param {object} options
 * @param {(host: object) => number} options.neighborRadiusFor - arcseconds
 * @param {Set<string>} [options.hygIds] - HYG ids whose AT-HYG rows to keep
 * @param {Set<string>} [options.atHygIds] - AT-HYG ids to keep (override targets)
 */
async function scanAtHyg(
  filePath,
  hosts,
  { neighborRadiusFor, hygIds = new Set(), atHygIds = new Set() }
) {
  const byGaia = new Map();
  const byHip = new Map();
  const byHd = new Map();
  for (const host of hosts) {
    if (host.gaiaDr3Id) pushTo(byGaia, host.gaiaDr3Id, host);
    if (host.hipId) pushTo(byHip, String(host.hipId), host);
    const hd = hdNumber(host.hdName);
    if (hd) pushTo(byHd, hd, host);
  }
  const grid = buildHostGrid(hosts, neighborRadiusFor);

  const idHits = new Map();
  const neighbors = new Map();
  const starsByHygId = new Map();
  const starsByAtHygId = new Map();
  const rowCount = await readCsv(filePath, (row) => {
    const star = atHygStarFromRow(row);
    for (const [via, index, key] of [
      ['gaia-dr3', byGaia, star.gaia],
      ['hip', byHip, star.hip],
      ['hd', byHd, star.hd],
    ]) {
      for (const host of (key && index.get(key)) || []) {
        pushTo(idHits, host.id, { via, star });
      }
    }
    for (const { host, separation } of findNearbyHosts(grid, star)) {
      pushTo(neighbors, host.id, { star, separation });
    }
    if (star.hygId && hygIds.has(star.hygId)) {
      starsByHygId.set(star.hygId, star);
    }
    if (atHygIds.has(star.atHygId)) {
      starsByAtHygId.set(star.atHygId, star);
    }
  });
  return { rowCount, idHits, neighbors, starsByHygId, starsByAtHygId };
}

module.exports = {
  DEFAULT_CACHE_DIR,
  HYG_SOURCES,
  cacheDirectory,
  ensureSource,
  loadHygStars,
  parseLfsPointer,
  readCsv,
  scanAtHyg,
  sha256File,
};
