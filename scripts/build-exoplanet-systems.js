#!/usr/bin/env node
'use strict';

/**
 * Phase 3 of the exoplanet refresh: groups matched hosts, HYG companions, and
 * synthesized companions into solar systems (D32–D36) and writes
 * data/exoplanet-systems.json. Reads only checked-in snapshots, so it needs no
 * network or cache.
 *
 * Usage: npm run catalog:exoplanet:systems
 */

const fs = require('node:fs');
const path = require('node:path');

const { buildSystems, summarizeSystems, validateSystems } = require('./lib/exoplanet-systems');
const { serializeSnapshot } = require('./import-exoplanet-catalog-data');
const { validateOverrides } = require('./match-exoplanet-hosts');

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const FILES = {
  hosts: path.join(DATA_DIR, 'exoplanet-hosts.json'),
  planets: path.join(DATA_DIR, 'exoplanet-planets.json'),
  hygStars: path.join(DATA_DIR, 'exoplanet-hyg-stars.json'),
  report: path.join(DATA_DIR, 'exoplanet-match-report.json'),
  overrides: path.join(DATA_DIR, 'exoplanet-overrides.json'),
  systems: path.join(DATA_DIR, 'exoplanet-systems.json'),
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function main() {
  const hostsSnapshot = readJson(FILES.hosts);
  const hosts = hostsSnapshot.records;
  if (hosts.some((host) => !host.match || !host.resolvedDistance)) {
    throw new Error('Hosts have no match results; run npm run catalog:exoplanet:match first');
  }
  const planets = readJson(FILES.planets).records;
  const hygStars = readJson(FILES.hygStars).records;
  const report = readJson(FILES.report);
  const overrides = readJson(FILES.overrides);
  const overrideErrors = validateOverrides(overrides);
  if (overrideErrors.length) {
    throw new Error(`Invalid exoplanet-overrides.json:\n${overrideErrors.join('\n')}`);
  }

  const systems = buildSystems({
    hosts,
    hygStars,
    planetsById: new Map(planets.map((planet) => [planet.id, planet])),
    systemAssignments: overrides.systemAssignments,
    defaultDistance: report.distances ? report.distances.defaultDistancePc : null,
  });
  const errors = validateSystems(systems, hosts);
  if (errors.length) {
    throw new Error(`System grouping failed:\n${errors.slice(0, 20).join('\n')}`);
  }

  const summary = summarizeSystems(systems);
  fs.writeFileSync(
    FILES.systems,
    serializeSnapshot(
      {
        source: 'NASA Exoplanet Archive hosts grouped with AT-HYG/HYG companions (D32–D36)',
        snapshotDate: hostsSnapshot.snapshotDate,
        license: 'CC BY-SA 4.0',
        licenseFile: hostsSnapshot.licenseFile,
        recordFormat:
          'One solar system per record. Stars list their own planetIds; circumbinaryPlanets orbit the barycenter of starIds. Archive-host and hyg-companion stars carry links only (position and physics are re-derived from exoplanet-hosts.json / exoplanet-hyg-stars.json); the system positionPc is its primary star. synthesized stars carry full approximate physics. existing: true marks systems already in the curated catalog.',
        summary,
        recordCount: systems.length,
      },
      systems
    ),
    'utf8'
  );
  console.log(JSON.stringify(summary));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { main };
