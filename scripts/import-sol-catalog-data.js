'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const MPC_COMETS_URL = 'https://www.minorplanetcenter.net/iau/MPCORB/AllCometEls.txt';
const JPL_SATELLITES_URL = 'https://ssd.jpl.nasa.gov/sats/elem/';
const JPL_DISCOVERIES_URL = 'https://ssd.jpl.nasa.gov/sats/discovery.html';
const S2009_S1_SOURCE_URL = 'https://ciclops.org/view_popup.php?id=5926.html';
const MPC_COMET_MINIMUM = 4000;
const JPL_SATELLITE_MINIMUM = 400;

function parseNumber(value, fieldName) {
  const parsed = Number(String(value || '').trim());
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ${fieldName} in catalog source: ${value}`);
  }
  return parsed;
}

function parseMpcComets(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.startsWith('#'))
    .map((line) => {
      const monthValue = line.slice(19, 21).trim();
      const monthNames = {
        JAN: 1,
        FEB: 2,
        MAR: 3,
        APR: 4,
        MAY: 5,
        JUN: 6,
        JUL: 7,
        AUG: 8,
        SEP: 9,
        OCT: 10,
        NOV: 11,
        DEC: 12,
      };
      const perihelionMonth =
        monthNames[monthValue.toUpperCase()] || parseNumber(monthValue, 'perihelion month');
      const comet = {
        designation: line.slice(0, 12).trim(),
        name: line.slice(102, 158).trim(),
        perihelionYear: parseNumber(line.slice(14, 18), 'perihelion year'),
        perihelionMonth,
        perihelionDay: parseNumber(line.slice(22, 29), 'perihelion day'),
        perihelionDistanceAu: parseNumber(line.slice(30, 39), 'perihelion distance'),
        eccentricity: parseNumber(line.slice(41, 49), 'eccentricity'),
        argumentOfPerihelionDeg: parseNumber(line.slice(51, 59), 'argument of perihelion'),
        longitudeOfAscendingNodeDeg: parseNumber(line.slice(61, 69), 'longitude of ascending node'),
        inclinationDeg: parseNumber(line.slice(71, 79), 'inclination'),
        absoluteMagnitudeH: Number(line.slice(91, 95).trim()) || null,
      };
      if (
        !comet.designation ||
        !comet.name ||
        comet.perihelionMonth < 1 ||
        comet.perihelionMonth > 12 ||
        comet.perihelionDay < 0 ||
        comet.perihelionDay >= 32 ||
        comet.perihelionDistanceAu <= 0 ||
        comet.eccentricity < 0
      ) {
        throw new Error(`Invalid MPC comet record: ${line}`);
      }
      return comet;
    });
}

function isInterstellarCometDesignation(designation) {
  return /^\d+I(?:\/|$)/i.test(designation.replace(/^0+/, ''));
}

function decodeHtml(value) {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&omega;/gi, 'ω')
    .replace(/&#(\d+);/g, (match, code) => String.fromCodePoint(Number(code)))
    .trim();
}

function parseJplSatellites(html) {
  const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((rowMatch) =>
      [...rowMatch[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cellMatch) =>
        decodeHtml(cellMatch[1])
      )
    )
    .filter((row) => row.length >= 20 && /^\d+$/.test(row[0]));

  const satellites = rows.map((row) => {
    const satellite = {
      code: row[3],
      planet: row[1],
      name: row[2],
      frame: row[5],
      epoch: row[6],
      semiMajorAxisKm: parseNumber(row[7], 'satellite semimajor axis'),
      eccentricity: parseNumber(row[8], 'satellite eccentricity'),
      argumentOfPeriapsisDeg: parseNumber(row[9], 'satellite argument of periapsis'),
      meanAnomalyAtEpochDeg: parseNumber(row[10], 'satellite mean anomaly'),
      inclinationDeg: parseNumber(row[11], 'satellite inclination'),
      longitudeOfAscendingNodeDeg: parseNumber(row[12], 'satellite longitude of ascending node'),
      orbitalPeriodDays: parseNumber(row[13], 'satellite orbital period'),
    };
    if (
      !satellite.code ||
      !satellite.planet ||
      !satellite.name ||
      satellite.semiMajorAxisKm <= 0 ||
      satellite.eccentricity < 0 ||
      satellite.eccentricity >= 1 ||
      satellite.orbitalPeriodDays <= 0
    ) {
      throw new Error(`Invalid JPL satellite record: ${JSON.stringify(row)}`);
    }
    return satellite;
  });

  const uniqueSatellites = new Map();
  for (const satellite of satellites) {
    const key = `${satellite.planet}/${satellite.name}`;
    const current = uniqueSatellites.get(key);
    if (!current || satellite.epoch > current.epoch) {
      uniqueSatellites.set(key, satellite);
    }
  }
  return [...uniqueSatellites.values()];
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Catalog source request failed (${response.status}): ${url}`);
  }
  return response.text();
}

async function main() {
  const [mpcText, jplHtml, jplDiscoveryHtml] = await Promise.all([
    fetchText(MPC_COMETS_URL),
    fetchText(JPL_SATELLITES_URL),
    fetchText(JPL_DISCOVERIES_URL),
  ]);
  const comets = parseMpcComets(mpcText).filter(
    (comet) => !isInterstellarCometDesignation(comet.designation)
  );
  const satellites = parseJplSatellites(jplHtml);
  const discoveryText = decodeHtml(jplDiscoveryHtml);
  if (!/S\/2009\s+S1/.test(discoveryText)) {
    throw new Error('JPL satellite discovery source no longer lists S/2009 S 1');
  }
  const saturnMoonlet = 116914;
  satellites.push({
    code: 'S/2009-S1',
    planet: 'Saturn',
    name: 'S/2009 S 1',
    frame: 'approximate-circular',
    epoch: '2000-01-01.5',
    semiMajorAxisKm: saturnMoonlet,
    eccentricity: 0,
    argumentOfPeriapsisDeg: 0,
    meanAnomalyAtEpochDeg: 0,
    inclinationDeg: 0,
    longitudeOfAscendingNodeDeg: 0,
    orbitalPeriodDays: (2 * Math.PI * Math.sqrt(saturnMoonlet ** 3 / 37931207)) / 86400,
    meanRadiusKm: 0.15,
    discoveredBy: 'Cassini Imaging Team',
    discoveredYear: 2009,
    catalogNote: `Approximate circular equatorial elements for visualization only; based on the reported 116,914 km orbit. ${S2009_S1_SOURCE_URL}`,
  });
  if (comets.length < MPC_COMET_MINIMUM || satellites.length < JPL_SATELLITE_MINIMUM) {
    throw new Error(
      `Unexpected catalog size: ${comets.length} comets and ${satellites.length} satellites`
    );
  }
  if (new Set(comets.map((comet) => comet.designation)).size !== comets.length) {
    throw new Error('MPC comet source contains duplicate designations');
  }
  if (new Set(satellites.map((satellite) => satellite.code)).size !== satellites.length) {
    throw new Error('JPL satellite source contains duplicate codes');
  }

  const snapshotDate = new Date().toISOString().slice(0, 10);
  const snapshots = [
    {
      fileName: 'sol-comets.json',
      data: {
        source: 'International Astronomical Union Minor Planet Center',
        sourceUrl: MPC_COMETS_URL,
        sourceFormatUrl:
          'https://docs.minorplanetcenter.net/mpc-ops-docs/orbits/comet-orbit-format/',
        snapshotDate,
        records: comets,
      },
    },
    {
      fileName: 'sol-satellites.json',
      data: {
        source: 'NASA/JPL Solar System Dynamics',
        sourceUrl: JPL_SATELLITES_URL,
        discoverySourceUrl: JPL_DISCOVERIES_URL,
        supplementalSourceUrl: S2009_S1_SOURCE_URL,
        snapshotDate,
        records: satellites,
      },
    },
  ];

  for (const snapshot of snapshots) {
    fs.writeFileSync(
      path.join(DATA_DIR, snapshot.fileName),
      `${JSON.stringify(snapshot.data, null, 2)}\n`,
      'utf8'
    );
  }
  console.log(
    `Wrote ${comets.length} MPC comets and ${satellites.length} JPL satellites (${snapshotDate})`
  );
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  isInterstellarCometDesignation,
  parseJplSatellites,
  parseMpcComets,
};
