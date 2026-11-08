'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { previewNonSolSystem } = require('../src/model/non-sol-augmentation');
const policy = require('../data/non-sol-scientific-policy-v1.json');
const expandedPolicy = require('../data/non-sol-scientific-policy-v2.json');
const { previewExpandedNonSolSystem, countBodies } = require('../src/model/non-sol-expanded-augmentation');

const DEFAULT_SYSTEMS = ['alpha-centauri', 'barnards-star', 'exo-gj-9066', 'cygnus-x1'];

function parseArgs(args) {
  const options = { systems: [], all: false, expanded: false, out: null, epoch: policy.epoch };
  const seen = new Set();
  for (let index = 0; index < args.length; index++) {
    const key = args[index];
    if (key === '--all' || key === '--expanded') {
      if (seen.has(key)) throw new Error(`Duplicate ${key}`);
      if (key === '--all') options.all = true;
      if (key === '--expanded') options.expanded = true;
    } else if (['--system', '--out', '--epoch'].includes(key)) {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${key}`);
      if (key !== '--system' && seen.has(key)) throw new Error(`Duplicate ${key}`);
      if (key === '--system') options.systems.push(value);
      if (key === '--out') options.out = path.resolve(value);
      if (key === '--epoch') options.epoch = value;
    } else throw new Error(`Unknown argument: ${key}`);
    seen.add(key);
  }
  if (options.all && options.systems.length)
    throw new Error('--all cannot be combined with --system');
  if (options.expanded && options.all)
    throw new Error('Expanded generation is scoped to five pilots; --all is not authorized');
  if (new Set(options.systems).size !== options.systems.length)
    throw new Error('Duplicate preview system');
  if (!options.all && !options.systems.length)
    options.systems = [...(options.expanded ? expandedPolicy.scope : DEFAULT_SYSTEMS)];
  return options;
}

function buildReport(options) {
  if (options.expanded && options.all)
    throw new Error('Expanded generation is scoped to five pilots; --all is not authorized');
  let systems = options.systems;
  if (options.all) {
    const manifest = require('../data/non-sol-celestial-generation-manifest-v1.json');
    systems = manifest.systems.map((entry) => entry.id);
  }
  const details = [];
  const summary = [];
  for (const id of [...systems].sort()) {
    const preview = options.expanded
      ? previewExpandedNonSolSystem(id, { epoch: options.epoch })
      : previewNonSolSystem(id, { epoch: options.epoch });
    const counts = {};
    for (const body of preview.generatedBodies)
      counts[body.bodyType] = (counts[body.bodyType] || 0) + 1;
    summary.push({
      systemId: id,
      status: preview.status,
      ...(options.expanded ? {} : { abundance: preview.abundance }),
      counts,
      ringProposals: preview.ringProposals.length,
      requested: preview.countPlan,
      rejectionCodes: [...new Set(preview.rejected.map((entry) => entry.code))],
      exclusionCodes: [...new Set(preview.exclusions.map((entry) => entry.code))],
      sourceSha256: preview.sourceSha256,
      outputSha256: preview.outputSha256,
      ...(options.expanded ? {
        bodyCounts: preview.counts,
        populationDescriptors: preview.populationDescriptors.length,
        familyBlockers: preview.familyBlockers,
      } : {}),
    });
    if (!options.all) details.push(preview);
  }
  const report = {
    schemaVersion: options.expanded ? 'non-sol-preview-report-v2' : 'non-sol-preview-report-v1',
    policyVersion: options.expanded ? expandedPolicy.version : policy.version,
    epoch: options.epoch,
    runtimeEnabled: false,
    databaseWrites: false,
    targetCount: systems.length,
    validPreviews: summary.filter((entry) => entry.status === 'preview-valid').length,
    blockedPreviews: summary.filter((entry) => entry.status === 'blocked').length,
    summary,
    ...(options.all ? {} : { details }),
    ...(options.expanded ? {
      occurrenceCalibrated: false,
      samplingInterpretation: expandedPolicy.samplingInterpretation,
      counts: {
        existing: countBodies(details.flatMap((preview) => preview.baseBodies)),
        additions: countBodies(details.flatMap((preview) => preview.generatedBodies)),
        combined: countBodies(details.flatMap((preview) => [...preview.baseBodies, ...preview.generatedBodies])),
      },
      structures: {
        existingRings: details.reduce((sum, preview) => sum + preview.baseBodies.filter((body) => body.rings).length, 0),
        proposedRings: details.reduce((sum, preview) => sum + preview.ringProposals.length, 0),
        proposedPopulations: details.reduce((sum, preview) => sum + preview.populationDescriptors.length, 0),
      },
    } : {}),
  };
  return {
    ...report,
    reportSha256: createHash('sha256').update(JSON.stringify(report)).digest('hex'),
  };
}

function publishReport(file, report) {
  const text = `${JSON.stringify(report, null, 2)}\n`;
  if (fs.existsSync(file)) {
    if (fs.readFileSync(file, 'utf8') !== text)
      throw new Error(
        'Preview output differs; choose a new path, never overwrite reviewed evidence'
      );
    return 'unchanged';
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, text, { flag: 'wx' });
    fs.linkSync(temporary, file);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
  return 'created';
}

function main(args = process.argv.slice(2)) {
  const options = parseArgs(args);
  const report = buildReport(options);
  if (options.out)
    console.log(`Preview report ${publishReport(options.out, report)}: ${options.out}`);
  console.log(
    `Offline preview: ${report.targetCount} systems; ${report.validPreviews} analytically screened; ${report.blockedPreviews} blocked.`
  );
  for (const row of report.summary) {
    console.log(
      `${row.systemId}: ${row.status}; ${JSON.stringify(row.counts)}; rings=${row.ringProposals}; exclusions=${row.exclusionCodes.join(',') || 'none'}`
    );
    if (options.expanded) {
      console.log(`  existing=${JSON.stringify(row.bodyCounts.existing.byType)}; combined=${JSON.stringify(row.bodyCounts.combined.byType)}`);
      console.log(`  planet appearances (not observed composition)=${JSON.stringify(row.bodyCounts.combined.planetAppearances)}`);
    }
  }
  if (options.expanded)
    console.log(`Totals: ${JSON.stringify(report.counts)}; structures=${JSON.stringify(report.structures)}. Authored exploratory sampling, not calibrated occurrence.`);
  console.log(
    `Digest: ${report.reportSha256}. No runtime activation, database writes, playable verification, or rollout completion.`
  );
  return report;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`[non-sol-preview] ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { parseArgs, buildReport, publishReport };
