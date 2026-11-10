'use strict';

const { previewCopperValeP3 } = require('../src/model/non-sol-p3-preview');

function main(args = process.argv.slice(2)) {
  if (args.some((arg) => arg !== '--json') || args.filter((arg) => arg === '--json').length > 1) {
    throw new Error('Usage: node scripts/non-sol-p3-preview.js [--json]');
  }
  const preview = previewCopperValeP3();
  if (args.includes('--json')) {
    console.log(JSON.stringify(preview, null, 2));
  } else {
    console.log(
      `Copper Vale P3 offline preview: ${
        preview.generatedBodies.filter((body) => body.bodyType === 'asteroid').length
      } asteroids; resources=${JSON.stringify(preview.resourceCounts)}`
    );
    console.log(
      `Station=${preview.station.marketId}; host=${preview.station.stationPlacement.primaryBodyId}; ` +
        `orbit=${preview.station.trajectory.orbit.semiMajorAxisKm.toFixed(2)} km; ` +
        `period=${preview.station.trajectory.orbit.orbitalPeriodSec.toFixed(2)} sec`
    );
    console.log(
      `Clearance=${JSON.stringify(preview.stationClearance)}; sha256=${preview.outputSha256}`
    );
    console.log('Offline only: no runtime activation or database writes.');
  }
  return preview;
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
