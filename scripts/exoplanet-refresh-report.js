#!/usr/bin/env node
'use strict';

/**
 * Phase 6 of the exoplanet refresh: after `npm run catalog:exoplanet:refresh`,
 * compares the new snapshot with a base git ref, runs the validation checks,
 * appends a snapshot-metrics row to docs/exoplanet-catalog-data.md, and writes
 * the pull-request body. Used by .github/workflows/refresh-exoplanet-catalog.yml.
 *
 * Usage: npm run catalog:exoplanet:report -- [--base HEAD] [--pr-body <file>]
 *          [--first-attempt-failed] [--skip-checks] [--force]
 * --force builds the report and PR even when no snapshot records changed.
 * Writes `changed`, `draft`, and `date` to $GITHUB_OUTPUT when it is set.
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const METRICS_DOC = path.join(ROOT_DIR, 'docs', 'exoplanet-catalog-data.md');

/** Generated snapshot files; a PR opens only when their records change. */
const SNAPSHOT_FILES = [
  'exoplanet-planets.json',
  'exoplanet-hosts.json',
  'exoplanet-references.json',
  'exoplanet-hyg-stars.json',
  'exoplanet-match-report.json',
  'exoplanet-systems.json',
];
const NAMES_FILE = 'exoplanet-names.json';

/** Mirrors the guard limits in the importer (D11) and the matcher (EX-2.9). */
const SHRINKAGE_LIMIT = 0.02;
const METRICS_END_MARKER = '<!-- snapshot-metrics:end -->';

const CHECKED_FILES = [
  'scripts/import-exoplanet-catalog-data.js',
  'scripts/match-exoplanet-hosts.js',
  'scripts/build-exoplanet-systems.js',
  'scripts/exoplanet-refresh-report.js',
  'scripts/lib/exoplanet-crossmatch.js',
  'scripts/lib/exoplanet-hyg-sources.js',
  'scripts/lib/exoplanet-systems.js',
  'src/model/exoplanet-catalog.js',
  'src/model/exoplanet-star-facts.js',
  'src/model/exoplanet-system-generator.js',
  'src/model/star-catalog.js',
  'src/model/solar-system-registry.js',
  'src/model/solar-system-celestial-seed.js',
];
const TEST_FILES = [
  'test/import-exoplanet-catalog-data.test.js',
  'test/exoplanet-crossmatch.test.js',
  'test/exoplanet-systems.test.js',
  'test/exoplanet-system-generator.test.js',
  'test/exoplanet-catalog-runtime.test.js',
  'test/exoplanet-refresh-report.test.js',
  'test/solar-system-celestial-seed.test.js',
  'test/solar-system-get-message-handler.test.js',
  'test/solar-system-list-message-handler.test.js',
  'test/star-get-message-handler.test.js',
  'test/star-list-message-handler.test.js',
];

const CHECKS = [
  { id: 'tests', command: 'node', args: ['--test', ...TEST_FILES] },
  { id: 'typecheck', command: 'npm', args: ['run', 'typecheck'] },
  { id: 'eslint', command: 'npx', args: ['eslint', ...CHECKED_FILES, ...TEST_FILES] },
  {
    id: 'prettier',
    command: 'npx',
    args: ['prettier', '--check', ...CHECKED_FILES, ...TEST_FILES],
  },
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readBaseJson(ref, fileName) {
  try {
    const text = execFileSync('git', ['show', `${ref}:data/${fileName}`], {
      cwd: ROOT_DIR,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Snapshot content without the run date, so a same-data rerun is "unchanged". */
function snapshotContent(snapshot) {
  if (!snapshot) {
    return null;
  }
  const { snapshotDate: _date, calibration: _calibration, ...rest } = snapshot;
  return JSON.stringify(rest);
}

function changedFiles(base, current) {
  return SNAPSHOT_FILES.filter(
    (fileName) => snapshotContent(base[fileName]) !== snapshotContent(current[fileName])
  );
}

function diffIds(previousRecords, currentRecords) {
  const previous = new Set((previousRecords || []).map((record) => record.id));
  const current = new Set((currentRecords || []).map((record) => record.id));
  const added = [...current].filter((id) => !previous.has(id)).sort();
  const removed = [...previous].filter((id) => !current.has(id)).sort();
  const ratio = previous.size ? removed.length / previous.size : 0;
  return { added, removed, ratio, exceeded: ratio > SHRINKAGE_LIMIT };
}

/** Review-queue rows for the PR body (EX-6.3): host, top candidate, posterior. */
function reviewEntries(matchReport, hosts) {
  const names = new Map((hosts?.records || []).map((host) => [host.id, host.name]));
  return (matchReport?.records || [])
    .filter((record) => record.decision === 'review')
    .map((record) => {
      const [candidateId, posterior] = record.candidates?.[0] || [record.atHygId, null];
      return {
        hostId: record.hostId,
        name: names.get(record.hostId) || record.hostId,
        tier: record.tier,
        candidate: candidateId || null,
        posterior: posterior ?? null,
        reasons: record.reasons || [],
        carriedOver: Boolean(record.carriedOver),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Names-file keys that no longer resolve after the refresh (renames or retractions). */
function orphanedNames(names, planets, systems) {
  const planetIds = new Set((planets?.records || []).map((planet) => planet.id));
  const systemIds = new Set((systems?.records || []).map((system) => system.id));
  const starIds = new Set(
    (systems?.records || []).flatMap((system) => (system.stars || []).map((star) => star.starId))
  );
  const missing = (keys, known, kind) =>
    Object.keys(keys || {})
      .filter((id) => !known.has(id))
      .map((id) => ({ kind, id, name: keys[id] }));
  return [
    ...missing(names?.systems, systemIds, 'system'),
    ...missing(names?.stars, starIds, 'star'),
    ...missing(names?.planets, planetIds, 'planet'),
  ];
}

function formatCount(value) {
  return Number(value || 0).toLocaleString('en-US');
}

function snapshotSizeMb(dataDir = DATA_DIR) {
  const bytes = SNAPSHOT_FILES.reduce(
    (total, fileName) => total + fs.statSync(path.join(dataDir, fileName)).size,
    0
  );
  return (bytes / 1e6).toFixed(2);
}

/** One row for the snapshot-metrics table, matching the plan's columns. */
function buildMetricsRow({ date, planets, hosts, systems, matchReport, sizeMb, note }) {
  const counts = matchReport.counts;
  const summary = systems.summary;
  const missingAxis = planets.records.filter((planet) => planet.semiMajorAxisAu == null).length;
  const manual = counts.byTier?.override || 0;
  const auto = counts.matched - manual;
  return [
    date,
    formatCount(planets.recordCount),
    formatCount(hosts.recordCount),
    formatCount(summary.systems),
    `${formatCount(summary.multiStarSystems)} (${formatCount(summary.circumbinarySystems)} with circumbinary)`,
    `${formatCount(auto)} (${(counts.autoMatchRate * 100).toFixed(2)}%) / ${counts.review} / ${manual}`,
    formatCount(counts.unmatched),
    `${formatCount(missingAxis)} lack a semi-major axis`,
    `${sizeMb} MB`,
    note,
  ]
    .map((cell) => ` ${cell} `)
    .join('|')
    .replace(/^/, '|')
    .concat('|');
}

function appendMetricsRow(docText, row) {
  const index = docText.indexOf(METRICS_END_MARKER);
  if (index === -1) {
    throw new Error(`Metrics doc is missing the ${METRICS_END_MARKER} marker`);
  }
  const before = docText.slice(0, index).replace(/\s*$/, '');
  return `${before}\n${row}\n\n${docText.slice(index)}`;
}

function runChecks(checks = CHECKS) {
  return checks.map((check) => {
    const display = [check.command, ...check.args].join(' ');
    console.log(`\n$ ${display}`);
    const result = spawnSync(check.command, check.args, {
      cwd: ROOT_DIR,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    return { id: check.id, command: display, passed: result.status === 0 };
  });
}

function formatList(ids, limit = 25) {
  if (!ids.length) {
    return 'none';
  }
  const shown = ids.slice(0, limit).map((id) => `\`${id}\``);
  const more = ids.length > limit ? `, and ${ids.length - limit} more` : '';
  return `${shown.join(', ')}${more}`;
}

function buildPrBody({
  date,
  files,
  forced = false,
  planetDiff,
  hostDiff,
  systemDiff,
  matchReport,
  review,
  orphans,
  guards,
  firstAttemptFailed,
  checks,
  metricsRow,
}) {
  const counts = matchReport.counts;
  const carried = review.filter((entry) => entry.carriedOver);
  const fresh = review.filter((entry) => !entry.carriedOver);
  const reviewTable = (entries) =>
    entries.length
      ? [
          '| Host | Tier | Top candidate (AT-HYG) | Posterior | Reasons |',
          '| --- | --- | --- | ---: | --- |',
          ...entries.map(
            (entry) =>
              `| ${entry.name} (\`${entry.hostId}\`) | ${entry.tier} | ${entry.candidate ?? '—'} | ${
                entry.posterior == null ? '—' : entry.posterior
              } | ${entry.reasons.join(', ') || '—'} |`
          ),
        ].join('\n')
      : 'None.';
  const attention = [
    ...guards.map((guard) => `- ⚠️ ${guard}`),
    ...orphans.map(
      (orphan) =>
        `- ⚠️ Names-file ${orphan.kind} \`${orphan.id}\` ("${orphan.name}") no longer exists. Add a rename to \`data/exoplanet-overrides.json\` or move the name to the new ID.`
    ),
    ...checks.filter((check) => !check.passed).map((check) => `- ❌ \`${check.command}\` failed.`),
  ];

  return `## Summary

- Refresh the NASA Exoplanet Archive snapshot (${date}) and its HYG cross-match and solar-system grouping.
- Changed files: ${
    files.length
      ? files.map((file) => `\`data/${file}\``).join(', ')
      : 'none (forced run; only the snapshot date and metrics row change)'
  }.${forced ? '\n- Opened by a forced `workflow_dispatch` run to verify the workflow; close it without merging.' : ''}
- Planets: ${formatCount(planetDiff.current)} (+${planetDiff.added.length} / −${planetDiff.removed.length}). Hosts: ${formatCount(hostDiff.current)} (+${hostDiff.added.length} / −${hostDiff.removed.length}). Systems: ${formatCount(systemDiff.current)} (+${systemDiff.added.length} / −${systemDiff.removed.length}).
- HYG matches: ${formatCount(counts.matched)} (auto-match rate ${(counts.autoMatchRate * 100).toFixed(2)}%), review ${counts.review}, unmatched ${formatCount(counts.unmatched)}.
- Per-system seed versions hash each system's records, so merging reseeds only changed systems (D48).
- Appends a snapshot-metrics row to \`docs/exoplanet-catalog-data.md\`.
${firstAttemptFailed ? '- The first refresh attempt failed a guard; this run used `EXOPLANET_ALLOW_SHRINK=1` and `EXOPLANET_ALLOW_MATCH_DRIFT=1`, so this PR is a draft (D61).\n' : ''}
### Needs attention

${attention.length ? attention.join('\n') : 'Nothing. All guards and checks passed.'}

### Added and removed

- Added planets: ${formatList(planetDiff.added)}
- Removed planets: ${formatList(planetDiff.removed)}
- Added systems: ${formatList(systemDiff.added)}
- Removed systems: ${formatList(systemDiff.removed)}

### Review queue (D14)

Merging is not blocked. Resolve entries through \`data/exoplanet-overrides.json\` before the next monthly run.

**New this run**

${reviewTable(fresh)}

**Still unresolved from earlier runs** (see plan follow-up F1)

${reviewTable(carried)}

### Snapshot metrics

\`\`\`
${metricsRow}
\`\`\`

## SW-08 Producer Checklist

- [x] SW-08 contract-impacting change acknowledged
- [x] SW-08 consumer surfaces reviewed
- [x] SW-08 migration note linked or marked not-required

Migration note: not-required (data-only refresh; no schema change)

## Testing

- \`npm run catalog:exoplanet:refresh\` — passed${firstAttemptFailed ? ' (with guard overrides)' : ''}
${checks.map((check) => `- \`${check.command}\` — ${check.passed ? 'passed' : 'failed'}`).join('\n')}
`;
}

function guardMessages(planetDiff, matchReport) {
  const messages = [];
  if (planetDiff.exceeded) {
    messages.push(
      `Planet shrinkage ${(planetDiff.ratio * 100).toFixed(2)}% exceeds the ${SHRINKAGE_LIMIT * 100}% guard (${planetDiff.removed.length} removed).`
    );
  }
  if (matchReport?.drift?.exceeded) {
    messages.push(
      `Auto-match rate moved ${(matchReport.drift.drift * 100).toFixed(2)} points, beyond the 2-point guard.`
    );
  }
  return messages;
}

function parseArgs(argv) {
  const value = (flag, fallback) => {
    const index = argv.indexOf(flag);
    return index === -1 ? fallback : argv[index + 1];
  };
  return {
    base: value('--base', 'HEAD'),
    prBody: value('--pr-body', null),
    firstAttemptFailed: argv.includes('--first-attempt-failed'),
    skipChecks: argv.includes('--skip-checks'),
    force: argv.includes('--force'),
  };
}

function writeOutputs(outputs) {
  if (!process.env.GITHUB_OUTPUT) {
    return;
  }
  const lines = Object.entries(outputs).map(([key, value]) => `${key}=${value}`);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join('\n')}\n`);
}

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const current = Object.fromEntries(
    SNAPSHOT_FILES.map((fileName) => [fileName, readJson(path.join(DATA_DIR, fileName))])
  );
  const base = Object.fromEntries(
    SNAPSHOT_FILES.map((fileName) => [fileName, readBaseJson(options.base, fileName)])
  );
  const files = changedFiles(base, current);
  const date = current['exoplanet-planets.json'].snapshotDate;
  if (!files.length && !options.force) {
    console.log('Exoplanet snapshot records are unchanged; no pull request needed.');
    writeOutputs({ changed: 'false', draft: 'false', date });
    return { changed: false };
  }

  const planets = current['exoplanet-planets.json'];
  const hosts = current['exoplanet-hosts.json'];
  const systems = current['exoplanet-systems.json'];
  const matchReport = current['exoplanet-match-report.json'];
  const withCurrent = (diff, records) => ({ ...diff, current: records.length });
  const planetDiff = withCurrent(
    diffIds(base['exoplanet-planets.json']?.records, planets.records),
    planets.records
  );
  const hostDiff = withCurrent(
    diffIds(base['exoplanet-hosts.json']?.records, hosts.records),
    hosts.records
  );
  const systemDiff = withCurrent(
    diffIds(base['exoplanet-systems.json']?.records, systems.records),
    systems.records
  );
  const review = reviewEntries(matchReport, hosts);
  const orphans = orphanedNames(readJson(path.join(DATA_DIR, NAMES_FILE)), planets, systems);
  const guards = guardMessages(planetDiff, matchReport);

  const metricsRow = buildMetricsRow({
    date,
    planets,
    hosts,
    systems,
    matchReport,
    sizeMb: snapshotSizeMb(),
    note: `Monthly refresh; +${planetDiff.added.length} / −${planetDiff.removed.length} planets`,
  });
  fs.writeFileSync(METRICS_DOC, appendMetricsRow(fs.readFileSync(METRICS_DOC, 'utf8'), metricsRow));
  spawnSync('npx', ['prettier', '--write', path.relative(ROOT_DIR, METRICS_DOC)], {
    cwd: ROOT_DIR,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  const checks = options.skipChecks ? [] : runChecks();
  const draft =
    options.firstAttemptFailed ||
    guards.length > 0 ||
    orphans.length > 0 ||
    checks.some((check) => !check.passed);
  const body = buildPrBody({
    date,
    files,
    forced: options.force && !files.length,
    planetDiff,
    hostDiff,
    systemDiff,
    matchReport,
    review,
    orphans,
    guards,
    firstAttemptFailed: options.firstAttemptFailed,
    checks,
    metricsRow,
  });
  if (options.prBody) {
    fs.writeFileSync(options.prBody, body);
  } else {
    console.log(body);
  }
  writeOutputs({ changed: 'true', draft: String(draft), date });
  return { changed: true, draft };
}

if (require.main === module) {
  main();
}

module.exports = {
  METRICS_END_MARKER,
  SNAPSHOT_FILES,
  appendMetricsRow,
  buildMetricsRow,
  buildPrBody,
  changedFiles,
  diffIds,
  guardMessages,
  orphanedNames,
  reviewEntries,
  snapshotContent,
};
