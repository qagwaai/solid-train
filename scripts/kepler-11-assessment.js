'use strict';

const evidence = require('../data/kepler-11-assessment-evidence.json');
const { assessEvidence } = require('./lib/exoplanet-assessment-guards');

if (process.argv.length !== 2) {
  throw new Error('Usage: node scripts/kepler-11-assessment.js (offline read-only assessment)');
}
const report = assessEvidence(evidence, {
  measurementFields: ['massEarth', 'eccentricity'],
  requireCommonFit: true,
});
console.log(JSON.stringify({ systemId: evidence.systemId, ...report }, null, 2));
process.exitCode = report.status === 'held' ? 2 : 0;
