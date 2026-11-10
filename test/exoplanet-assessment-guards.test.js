'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { assessEvidence } = require('../scripts/lib/exoplanet-assessment-guards');
const reviewed = require('../data/kepler-11-assessment-evidence.json');
const { normalizePlanet } = require('../scripts/import-exoplanet-catalog-data');

const options = { measurementFields: ['massEarth', 'eccentricity'], requireCommonFit: true };

test('reviewed evidence blocks both g limits and uncertified architecture explicitly', () => {
  const before = JSON.stringify(reviewed);
  const report = assessEvidence(reviewed, options);
  assert.equal(report.status, 'held');
  assert.equal(report.physicalEligibility, 'not-assessed');
  assert.ok(report.blockers.includes('exo-kepler-11-g: massEarth is upper, not a measurement'));
  assert.ok(report.blockers.includes('exo-kepler-11-g: eccentricity is upper, not a measurement'));
  assert.ok(report.blockers.some((message) => message.startsWith('Common fitted')));
  assert.equal(JSON.stringify(reviewed), before);
});

test('measurement evidence can pass without implying physical eligibility or a common fit', () => {
  const report = assessEvidence({ records: reviewed.records.slice(0, 5) }, {
    measurementFields: ['massEarth', 'eccentricity'],
  });
  assert.deepEqual(report, {
    status: 'measurement-evidence-accepted', physicalEligibility: 'not-assessed', blockers: [],
  });
  assert.equal(assessEvidence({ records: reviewed.records.slice(0, 5) }, options).status, 'held');
});

test('imported evidence wires into guards and missing legacy metadata cannot pass', () => {
  const record = normalizePlanet({
    pl_name: 'Example b', hostname: 'Example', pl_bmasse: 5, pl_bmasselim: 1,
  });
  assert.equal(assessEvidence({ records: [record] }, {
    measurementFields: ['massEarth'],
  }).status, 'held');
  assert.match(assessEvidence({ records: [{ id: 'legacy', massEarth: 5 }] }, {
    measurementFields: ['massEarth'],
  }).blockers[0], /no matching/);
});

test('mismatches, conflicting alternatives, missing errors and estimated masses stay held', () => {
  for (const mutate of [
    (record) => { record.massEarth = 99; },
    (record) => { record.fieldEvidence[0].errorUpper = -1; },
    (record) => { delete record.fieldEvidence[0].reference; },
    (record) => { delete record.massProvenance; },
    (record) => { record.massProvenance = 'Msini'; },
    (record) => { record.massProvenance = 'M-R relationship'; },
    (record) => { record.fieldEvidence.push({ ...record.fieldEvidence[0], errorUpper: 4 }); },
  ]) {
    const record = structuredClone(reviewed.records[0]);
    mutate(record);
    assert.equal(assessEvidence({ records: [record] }, options).status, 'held');
  }
});

test('invalid requests throw explicit errors', () => {
  assert.throws(() => assessEvidence(null, options), /requires evidence/);
  assert.throws(() => assessEvidence({ records: [] }, options), /must not be empty/);
  assert.throws(() => assessEvidence(reviewed, { measurementFields: [] }), /nonempty/);
  assert.throws(() => assessEvidence({ records: [{ id: 'bad', fieldEvidence: {} }] }, options),
    /must be an array/);
  assert.throws(() => assessEvidence({ records: [reviewed.records[0], reviewed.records[0]] }, options),
    /unique/);
});

test('offline CLI emits a held report and exits 2 without any write action', () => {
  const script = path.resolve(__dirname, '../scripts/kepler-11-assessment.js');
  const result = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  assert.equal(result.status, 2, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.systemId, 'exo-kepler-116');
  assert.equal(report.status, 'held');
  assert.equal(report.physicalEligibility, 'not-assessed');
  const invalid = spawnSync(process.execPath, [script, '--write'], { encoding: 'utf8' });
  assert.notEqual(invalid.status, 0);
  assert.match(invalid.stderr, /Usage:/);
});
