'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  METRICS_END_MARKER,
  appendMetricsRow,
  buildMetricsRow,
  buildPrBody,
  changedFiles,
  diffIds,
  guardMessages,
  orphanedNames,
  reviewEntries,
  snapshotContent,
} = require('../scripts/exoplanet-refresh-report');

const ROOT = path.resolve(__dirname, '..');
const matchReport = require('../data/exoplanet-match-report.json');
const hosts = require('../data/exoplanet-hosts.json');
const planets = require('../data/exoplanet-planets.json');
const systems = require('../data/exoplanet-systems.json');

const ids = (...values) => values.map((id) => ({ id }));

test('snapshot content ignores the run date so an unchanged rerun opens no PR', () => {
  const base = { 'exoplanet-planets.json': { snapshotDate: '2026-11-01', records: ids('a') } };
  const sameData = { 'exoplanet-planets.json': { snapshotDate: '2026-12-02', records: ids('a') } };
  const newData = {
    'exoplanet-planets.json': { snapshotDate: '2026-12-02', records: ids('a', 'b') },
  };
  assert.equal(
    snapshotContent(base['exoplanet-planets.json']),
    snapshotContent(sameData['exoplanet-planets.json'])
  );
  assert.deepEqual(changedFiles(base, sameData), []);
  assert.deepEqual(changedFiles(base, newData), ['exoplanet-planets.json']);
  assert.deepEqual(changedFiles({}, newData), ['exoplanet-planets.json']);
});

test('diffIds reports additions, removals, and the 2% shrinkage guard', () => {
  const previous = ids(...Array.from({ length: 100 }, (_, index) => `p${index}`));
  const small = diffIds(previous, [...previous.slice(2), ...ids('new')]);
  assert.deepEqual(small.added, ['new']);
  assert.deepEqual(small.removed, ['p0', 'p1']);
  assert.equal(small.exceeded, false);
  const large = diffIds(previous, previous.slice(3));
  assert.equal(large.exceeded, true);
  assert.match(guardMessages(large, { drift: { exceeded: false } })[0], /3\.00% exceeds the 2%/);
  assert.match(
    guardMessages(small, { drift: { exceeded: true, drift: -0.031 } })[0],
    /moved -3\.10 points/
  );
});

test('review entries list host name, top candidate, posterior, and carry-over', () => {
  const entries = reviewEntries(matchReport, hosts);
  assert.equal(entries.length, matchReport.counts.review);
  const hatP1 = entries.find((entry) => entry.hostId === 'exo-host-hat-p-1');
  assert.equal(hatP1.name, 'HAT-P-1');
  assert.equal(hatP1.candidate, '2475370');
  assert.equal(hatP1.posterior, 0.9999);
  assert.equal(hatP1.carriedOver, true);
  const hd41004 = entries.find((entry) => entry.hostId === 'exo-host-hd-41004-a');
  assert.equal(hd41004.candidate, '475216');
  assert.equal(hd41004.posterior, null);
});

test('orphaned names are detected when a named planet disappears', () => {
  const names = require('../data/exoplanet-names.json');
  assert.deepEqual(orphanedNames(names, planets, systems), []);
  const withoutGalileo = {
    records: planets.records.filter((planet) => planet.id !== 'exo-55-cnc-b'),
  };
  assert.deepEqual(orphanedNames(names, withoutGalileo, systems), [
    { kind: 'planet', id: 'exo-55-cnc-b', name: 'Galileo' },
  ]);
});

test('metrics row matches the data doc columns and is appended before the marker', () => {
  const row = buildMetricsRow({
    date: '2026-11-01',
    planets,
    hosts,
    systems,
    matchReport,
    sizeMb: '9.75',
    note: 'test',
  });
  const cells = row
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim());
  assert.deepEqual(cells, [
    '2026-11-01',
    '6,451',
    '4,847',
    '4,841',
    '432 (43 with circumbinary)',
    '1,694 (34.95%) / 6 / 0',
    '3,147',
    '8 lack a semi-major axis',
    '9.75 MB',
    'test',
  ]);

  const doc = fs.readFileSync(path.join(ROOT, 'docs', 'exoplanet-catalog-data.md'), 'utf8');
  const header = doc
    .split(/\r?\n/)
    .find((line) => line.startsWith('| Snapshot date'))
    .split('|')
    .slice(1, -1);
  assert.equal(cells.length, header.length);
  const updated = appendMetricsRow(doc, row);
  const lines = updated.split('\n');
  const markerLine = lines.findIndex((line) => line.includes(METRICS_END_MARKER));
  assert.equal(lines[markerLine - 2], row);
  assert.throws(() => appendMetricsRow('no marker', row), /marker/);
});

test('PR body follows the repository PR template and flags attention items', () => {
  const diff = (current) => ({ added: ['exo-new-b'], removed: [], current });
  const body = buildPrBody({
    date: '2026-12-02',
    files: ['exoplanet-planets.json'],
    planetDiff: diff(6452),
    hostDiff: diff(4848),
    systemDiff: diff(4842),
    matchReport,
    review: reviewEntries(matchReport, hosts),
    orphans: [{ kind: 'planet', id: 'exo-55-cnc-b', name: 'Galileo' }],
    guards: ['Planet shrinkage 3.00% exceeds the 2% guard (3 removed).'],
    firstAttemptFailed: true,
    checks: [
      { command: 'node --test a.test.js', passed: true },
      { command: 'npm run typecheck', passed: false },
    ],
    metricsRow: '| row |',
  });
  for (const heading of ['## Summary', '## SW-08 Producer Checklist', '## Testing']) {
    assert.ok(body.includes(heading), heading);
  }
  assert.ok(body.includes('Migration note: not-required'));
  assert.ok(body.includes('- [x] SW-08 contract-impacting change acknowledged'));
  assert.ok(body.includes('`npm run catalog:exoplanet:refresh` — passed (with guard overrides)'));
  assert.ok(body.includes('`node --test a.test.js` — passed'));
  assert.ok(body.includes('`npm run typecheck` — failed'));
  assert.ok(body.includes('Names-file planet `exo-55-cnc-b` ("Galileo")'));
  assert.ok(body.includes('Planet shrinkage 3.00%'));
  assert.ok(body.includes('Planets: 6,452 (+1 / −0)'));
  assert.ok(body.includes('| HAT-P-1 (`exo-host-hat-p-1`) | scored | 2475370 | 0.9999 |'));
  assert.ok(body.includes('**Still unresolved from earlier runs**'));
});
