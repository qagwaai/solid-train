#!/usr/bin/env node
'use strict';

/**
 * Fits the tier-3 (scored) cross-match constants from hosts whose catalog IDs
 * already identify their AT-HYG star, and checks them on a held-out 20%.
 *
 * Usage: npm run catalog:exoplanet:calibrate
 * Env:   EXOPLANET_CACHE_DIR (default .cache/exoplanet)
 */

const fs = require('node:fs');
const path = require('node:path');

const {
  AUTO_MATCH_MARGIN,
  AUTO_MATCH_POSTERIOR,
  FEATURES,
  MAX_AUTO_SEPARATION_NORM,
  MAX_AUTO_VMAG_DIFFERENCE,
  REVIEW_POSTERIOR,
  buildCalibrationExamples,
  coneRadiusArcsec,
  evaluateCalibration,
  fitCalibration,
  isHoldoutHost,
} = require('./lib/exoplanet-crossmatch');
const { HYG_SOURCES, ensureSource, scanAtHyg } = require('./lib/exoplanet-hyg-sources');

const ROOT_DIR = path.resolve(__dirname, '..');
const HOSTS_FILE = path.join(ROOT_DIR, 'data', 'exoplanet-hosts.json');
const CALIBRATION_FILE = path.join(__dirname, 'lib', 'exoplanet-crossmatch-calibration.json');
const TRAINING_RADIUS_ARCSEC = 300;
const MIN_HOLDOUT_PRECISION = 0.95;

function loadHosts() {
  return JSON.parse(fs.readFileSync(HOSTS_FILE, 'utf8')).records.map(
    ({ match: _match, ...host }) => host
  );
}

function trainingRadius(host) {
  return Math.max(coneRadiusArcsec(host), TRAINING_RADIUS_ARCSEC);
}

async function main() {
  const hosts = loadHosts();
  const atHyg = await ensureSource(HYG_SOURCES.atHyg);
  console.log(`Scanning ${atHyg.label} for ${hosts.length} hosts...`);
  const scan = await scanAtHyg(atHyg.path, hosts, { neighborRadiusFor: trainingRadius });

  const training = hosts.filter((host) => !isHoldoutHost(host.id));
  const holdout = hosts.filter((host) => isHoldoutHost(host.id));
  const { examples, priorMatchRate } = buildCalibrationExamples(training, scan);
  const fitted = fitCalibration(examples, { priorMatchRate });
  const holdoutMetrics = evaluateCalibration(holdout, scan, fitted);
  const trainingMetrics = evaluateCalibration(training, scan, fitted);

  const calibration = {
    generatedDate: new Date().toISOString().slice(0, 10),
    source: { label: atHyg.label, sha256: atHyg.sha256 },
    trainingRadiusArcsec: TRAINING_RADIUS_ARCSEC,
    trainingPairs: {
      positives: examples.filter((example) => example.match).length,
      negatives: examples.filter((example) => !example.match).length,
    },
    thresholds: {
      autoMatchPosterior: AUTO_MATCH_POSTERIOR,
      autoMatchMargin: AUTO_MATCH_MARGIN,
      reviewPosterior: REVIEW_POSTERIOR,
      maxAutoSeparationNorm: MAX_AUTO_SEPARATION_NORM,
      maxAutoVMagDifference: MAX_AUTO_VMAG_DIFFERENCE,
    },
    bins: Object.fromEntries(
      Object.entries(FEATURES).map(([name, definition]) => [
        name,
        definition.categories ||
          definition.bins.map((upper) => (upper === Infinity ? null : upper)),
      ])
    ),
    priorLogOdds: fitted.priorLogOdds,
    features: fitted.features,
    metrics: { holdout: holdoutMetrics, training: trainingMetrics },
  };

  console.log(JSON.stringify(calibration.metrics, null, 2));
  if (!(holdoutMetrics.precision >= MIN_HOLDOUT_PRECISION)) {
    throw new Error(
      `Held-out precision ${holdoutMetrics.precision} is below ${MIN_HOLDOUT_PRECISION}; calibration not written`
    );
  }
  fs.writeFileSync(CALIBRATION_FILE, `${JSON.stringify(calibration, null, 2)}\n`);
  console.log(`Wrote ${path.relative(ROOT_DIR, CALIBRATION_FILE)}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
