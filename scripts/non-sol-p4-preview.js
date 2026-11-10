'use strict';

const path = require('node:path');
const { previewCopperValeP4 } = require('../src/model/non-sol-p4-preview');
const { publishReport } = require('./non-sol-celestial-preview');

function main(args = process.argv.slice(2)) {
  let out = null;
  let json = false;
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--json' && !json) json = true;
    else if (args[index] === '--out' && !out) {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error('Missing --out path');
      out = path.resolve(value);
    } else throw new Error('Usage: non-sol-p4-preview.js [--json] [--out path]');
  }
  const preview = previewCopperValeP4();
  if (out) console.log(`P4 report ${publishReport(out, preview)}: ${out}`);
  if (json) console.log(JSON.stringify(preview, null, 2));
  else {
    console.log(
      `Copper Vale P4 offline: ${preview.counts.cultural} cultural names (${preview.counts.inherited} inherited / ${preview.counts.narrative} narrative); ${preview.counts.systematic} systematic labels; ${preview.counts.protectedExisting} protected existing bodies.`
    );
    console.log(
      `Languages: ${JSON.stringify(preview.counts.languages)}; station host: ${preview.station.trajectory.orbit.anchorBodyName}`
    );
    for (const entry of preview.assignments)
      console.log(`${entry.bodyId}: ${entry.preferredName} [${entry.lane}/${entry.language}]`);
    console.log(
      `Digest: ${preview.outputSha256}. Other four systems unchanged; no runtime activation or database writes.`
    );
  }
  return preview;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`[non-sol-p4-preview] ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { main };
