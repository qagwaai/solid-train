'use strict';

const { buildHistoricalFitReport } = require('./lib/kepler-11-historical-fit');

if (process.argv.length !== 2) {
  throw new Error('Usage: node scripts/kepler-11-historical-fit.js (read-only parameter adapter)');
}
console.log(JSON.stringify(buildHistoricalFitReport(), null, 2));
