'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const source = require('../data/kepler-11-historical-fit.json');
const { buildHistoricalFitReport } = require('../scripts/lib/kepler-11-historical-fit');
const { assessEvidence } = require('../scripts/lib/exoplanet-assessment-guards');

function close(actual, expected, tolerance) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}

test('adapter replays all Table 7 nominal values and errors without mutating the source', () => {
  const before = JSON.stringify(source);
  const expected = [
    [[10.3039, .0004], [689.7391, .0012], [.050, .019], [.014, .010], [6.80, 2.16]],
    [[13.0240, .0005], [683.3497, .0010], [.033, .016], [.005, .008], [9.25, 3.34]],
    [[22.6849, .0005], [694.0072, .0007], [-.003, .004], [.004, .003], [23.61, 1.84]],
    [[31.9999, .0005], [695.0756, .0005], [-.007, .003], [-.007, .003], [23.85, 2.55]],
    [[46.6877, .0014], [718.2697, .0021], [.014, .005], [-.001, .002], [5.26, 1.21]],
    [[118.3806, .0005], [693.8010, .0010], [0, null], [0, null], [25.29, null]],
  ];
  const report = buildHistoricalFitReport();
  assert.equal(report.systemId, 'exo-kepler-116');
  assert.equal(report.fitId, 'lissauer-2013-table-7-jr-g-fixed');
  assert.deepEqual(report.provenance, {
    reference: '2013ApJ...770..131L',
    sourceUrl: 'https://arxiv.org/html/1303.0227v2',
    reviewedAt: '2026-11-08',
    hostTable: 3,
    planetTable: 7,
  });
  assert.equal(report.planets.length, 6);
  report.planets.forEach((planet, index) => {
    assert.equal(planet.id, `exo-kepler-11-${'bcdefg'[index]}`);
    Object.values(planet.parameters).forEach((parameter, field) => {
      const [value, error] = expected[index][field];
      assert.equal(parameter.value, value);
      assert.equal(parameter.kind, error === null ? 'fixed-model-parameter' : 'fitted-parameter');
      if (error === null) {
        assert.equal(parameter.errorUpper, undefined);
        assert.equal(parameter.errorLower, undefined);
      } else {
        assert.equal(parameter.errorUpper, error);
        assert.equal(parameter.errorLower, -error);
      }
    });
  });
  assert.deepEqual(report.host, {
    massSolar: { value: .961, errorUpper: .025, errorLower: -.025 },
    radiusSolar: { value: 1.065, errorUpper: .017, errorLower: -.022 },
    temperatureK: { value: 5663, errorUpper: 55, errorLower: -66 },
    luminositySolar: { value: 1.045, errorUpper: .061, errorLower: -.078 },
    ageGyr: { value: 8.5, errorUpper: 1.1, errorLower: -1.4 },
  });
  report.host.massSolar.value = 99;
  report.planets[0].parameters.periodDays.value = 99;
  assert.equal(JSON.stringify(source), before);
  assert.equal(buildHistoricalFitReport().planets[0].parameters.periodDays.value, 10.3039);
});

test('adapter diagnostics meet documented numerical and source-convention thresholds', () => {
  const report = buildHistoricalFitReport();
  assert.equal(report.conventions.dynamicalEpochJd, 2455580);
  const masses = [2.17574, 2.95964, 7.55428, 7.63107, 1.68300, 8.09182];
  const eccentricities = [.051923, .033377, .005, .009899, .014036, 0];
  report.planets.forEach((planet, index) => {
    close(planet.diagnostics.massEarth, masses[index], .000005);
    close(planet.diagnostics.eccentricity, eccentricities[index], .0000005);
    close(planet.diagnostics.firstTransitJd,
      2454900 + planet.parameters.transitOffsetDays.value, 1e-9);
    close(planet.diagnostics.restFramePeriodDays,
      planet.parameters.periodDays.value * 1.00019, 1e-12);
    assert.ok(planet.diagnostics.firstTransitJd > report.conventions.dynamicalEpochJd);
    assert.ok(planet.diagnostics.firstTransitJd <
      report.conventions.dynamicalEpochJd + planet.parameters.periodDays.value);
  });
  assert.equal(report.planets[5].diagnostics.massKind, 'fixed-model-parameter');
  assert.equal(report.planets[5].diagnostics.eccentricityKind, 'fixed-model-parameter');
  assert.notEqual(report.planets[5].diagnostics.massEarth, 25);
});

test('nominal parameter replay cannot bypass assessment or claim integration/generation', () => {
  const report = buildHistoricalFitReport();
  assert.equal(report.status, 'nominal-parameters-adapted');
  assert.equal(report.physicalEligibility, 'not-assessed');
  assert.deepEqual(report.capabilities, {
    parameterReplay: true, stateVectors: false, integration: false,
    stabilityCertification: false, generation: false,
  });
  assert.equal(report.blockers.length, 4);
  assert.equal(assessEvidence({ records: report.planets }, {
    measurementFields: ['massEarth'], requireCommonFit: true,
  }).status, 'held');
  assert.throws(() => buildHistoricalFitReport({ epoch: 2451545 }), /does not accept/);
});

test('read-only CLI returns exact report with exit 0; overrides and write actions fail', () => {
  const script = path.resolve(__dirname, '../scripts/kepler-11-historical-fit.js');
  const result = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), buildHistoricalFitReport());
  for (const argument of ['--write', '--integrate', '--epoch=2451545']) {
    const invalid = spawnSync(process.execPath, [script, argument], { encoding: 'utf8' });
    assert.notEqual(invalid.status, 0);
    assert.match(invalid.stderr, /Usage:/);
  }
});
