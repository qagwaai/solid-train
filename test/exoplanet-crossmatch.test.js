'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const test = require('node:test');

const crossmatch = require('../scripts/lib/exoplanet-crossmatch');
const sources = require('../scripts/lib/exoplanet-hyg-sources');
const {
  buildHygStarSlice,
  buildMatchBlock,
  buildReportRecord,
  buildResolvedDistances,
  checkMatchDrift,
  existingStarsByHip,
  isDriftOverride,
  summarize,
  validateOverrides,
} = require('../scripts/match-exoplanet-hosts');
const calibration = require('../scripts/lib/exoplanet-crossmatch-calibration.json');

const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'exoplanet');
const FIXTURE_HOSTS = JSON.parse(
  fs.readFileSync(path.join(FIXTURE_DIR, 'hosts-sample.json'), 'utf8')
);

function star(overrides = {}) {
  return {
    atHygId: '1',
    hygId: null,
    gaia: null,
    hip: null,
    hd: null,
    raDeg: 10,
    decDeg: 20,
    distancePc: 10,
    vMag: 8,
    pmRa: 0,
    pmDec: 0,
    x: null,
    y: null,
    z: null,
    spect: null,
    ...overrides,
  };
}

function host(overrides = {}) {
  return {
    id: 'exo-host-test',
    name: 'Test',
    raDeg: 10,
    decDeg: 20,
    distancePc: 10,
    vMag: 8,
    pmRaMasYr: 0,
    pmDecMasYr: 0,
    ...overrides,
  };
}

let fixtureRunPromise;
function runFixtureMatch() {
  fixtureRunPromise ??= (async () => {
    const hyg = await sources.loadHygStars(path.join(FIXTURE_DIR, 'hyg-sample.csv'));
    const scan = await sources.scanAtHyg(
      path.join(FIXTURE_DIR, 'athyg-sample.csv'),
      FIXTURE_HOSTS,
      {
        neighborRadiusFor: crossmatch.coneRadiusArcsec,
        hygIds: new Set([...hyg.baseGroups.values()].flat()),
      }
    );
    const results = crossmatch.enforceOneToOne(
      FIXTURE_HOSTS.map((record) =>
        crossmatch.matchHost(record, {
          idHits: scan.idHits.get(record.id),
          candidates: scan.neighbors.get(record.id),
          calibration,
        })
      )
    );
    return {
      hyg,
      scan,
      results,
      byHost: new Map(results.map((result) => [result.hostId, result])),
    };
  })();
  return fixtureRunPromise;
}

test('parseCsvLine handles quoted fields and escaped quotes', () => {
  assert.deepEqual(crossmatch.parseCsvLine('1,,b'), ['1', '', 'b']);
  assert.deepEqual(crossmatch.parseCsvLine('1,"a, ""b""",c'), ['1', 'a, "b"', 'c']);
});

test('normalizeDesignation unifies Greek, Gliese, and digit/letter spacing', () => {
  assert.equal(crossmatch.normalizeDesignation('alf Tau'), 'alpha tau');
  assert.equal(crossmatch.normalizeDesignation('tet Cyg'), 'theta cyg');
  assert.equal(crossmatch.normalizeDesignation('Gliese 581'), 'gj 581');
  assert.equal(crossmatch.normalizeDesignation('Gl581'), 'gj 581');
  assert.equal(crossmatch.normalizeDesignation('HD 133131 A'), 'hd 133131 a');
});

test('host and star name keys agree on Flamsteed designations and ignore components', () => {
  const hostKeys = crossmatch.hostNameKeys({ name: '55 Cnc A' });
  const starKeys = crossmatch.starNameKeys({ flam: '55', con: 'Cnc' });
  assert.ok([...starKeys].some((key) => hostKeys.has(key)));
  assert.equal(crossmatch.hostComponentSuffix('HD 133131 A'), 'A');
  assert.equal(crossmatch.hostComponentSuffix('Kepler-16'), null);
});

test('angular separation and epoch positions', () => {
  assert.ok(Math.abs(crossmatch.angularSeparationArcsec(0, 0, 0, 1) - 3600) < 1e-6);
  const moving = star({ raDeg: 0, decDeg: 0, pmRa: 0, pmDec: 1000 });
  const positions = crossmatch.archiveEpochPositions(moving);
  assert.equal(positions.length, 2);
  assert.ok(Math.abs((positions[1].decDeg - positions[0].decDeg) * 3600 - 16) < 1e-6);
  assert.equal(crossmatch.archiveEpochPositions(star()).length, 1);
  // A J2000 star 16″ behind the archive position matches after propagation.
  const target = host({ raDeg: 0, decDeg: 16 / 3600 });
  assert.ok(crossmatch.separationArcsec(target, moving) < 1e-6);
});

test('cone radius scales with proper motion and has a 15″ floor', () => {
  assert.equal(crossmatch.coneRadiusArcsec(host()), crossmatch.MIN_CONE_ARCSEC);
  assert.ok(Math.abs(crossmatch.coneRadiusArcsec(host({ pmDecMasYr: 10000 })) - 300) < 1e-9);
});

test('host grid finds hosts near a star, including across RA 0 and near the pole', () => {
  const hosts = [
    host({ id: 'a', raDeg: 359.999, decDeg: 0 }),
    host({ id: 'b', raDeg: 45, decDeg: 89.99 }),
  ];
  const grid = crossmatch.buildHostGrid(hosts, () => 60);
  assert.deepEqual(
    crossmatch.findNearbyHosts(grid, star({ raDeg: 0.001, decDeg: 0 })).map((hit) => hit.host.id),
    ['a']
  );
  assert.deepEqual(
    crossmatch
      .findNearbyHosts(grid, star({ raDeg: 225, decDeg: 89.995 }))
      .map((hit) => hit.host.id),
    ['b']
  );
  assert.deepEqual(crossmatch.findNearbyHosts(grid, star({ raDeg: 180, decDeg: 0 })), []);
});

test('sanity gate accepts the parallax distance and kinematic matches', () => {
  const nearby = star({ distancePc: 2.546, pmRa: -580, pmDec: -4776 });
  const badDistance = host({ distancePc: 5.676, pmRaMasYr: -580, pmDecMasYr: -4767 });
  assert.equal(crossmatch.sanityGate(badDistance, nearby, 1).pass, false);
  assert.equal(crossmatch.sanityGate({ ...badDistance, parallaxMas: 392.4 }, nearby, 1).pass, true);

  const offset = crossmatch.sanityGate({ ...badDistance, parallaxMas: 392.4 }, nearby, 110);
  assert.equal(offset.pass, true);
  assert.match(offset.notes[0], /position-offset-accepted/);
  const unrelated = crossmatch.sanityGate(host(), star({ pmRa: 500 }), 110);
  assert.equal(unrelated.pass, false);
  assert.match(unrelated.reasons[0], /separation/);
});

test('fitCalibration learns that close pairs are matches and far pairs are not', () => {
  const examples = [
    ...Array.from({ length: 20 }, () => ({ match: true, features: { separation: 0.03 } })),
    ...Array.from({ length: 20 }, () => ({ match: false, features: { separation: 30 } })),
  ];
  const fitted = crossmatch.fitCalibration(examples, { priorMatchRate: 0.5 });
  assert.equal(fitted.priorLogOdds, 0);
  assert.ok(fitted.features.separation[0] > 2);
  assert.ok(fitted.features.separation[8] < -2);
});

test('decideScored applies posterior, margin, and companion guards', () => {
  const ranked = (posterior, features = { separation: 0.1 }, extra = {}) => ({
    star: star(extra),
    posterior,
    separation: 0.1,
    features,
  });
  assert.equal(crossmatch.decideScored([], host()).reasons[0], 'no-candidates');
  assert.equal(crossmatch.decideScored([ranked(0.99)], host()).decision, 'matched');
  assert.deepEqual(crossmatch.decideScored([ranked(0.99), ranked(0.9)], host()).reasons, [
    'insufficient-margin',
  ]);
  assert.deepEqual(crossmatch.decideScored([ranked(0.99, { separation: 6 })], host()).reasons, [
    'wide-separation',
  ]);
  assert.deepEqual(
    crossmatch.decideScored([ranked(0.99, undefined, { vMag: 10 })], host()).reasons,
    ['magnitude-mismatch']
  );
  assert.equal(crossmatch.decideScored([ranked(0.85)], host()).decision, 'review');
  const low = crossmatch.decideScored([ranked(0.5)], host());
  assert.equal(low.decision, 'unmatched');
  assert.equal(low.star, undefined);
});

test('a name collision alone does not produce a match', () => {
  const named = host({ name: '55 Cnc', vMag: 6, distancePc: 12.6 });
  const wrongStar = star({ flam: '55', con: 'Cnc', vMag: 11, distancePc: 300, atHygId: '9' });
  const result = crossmatch.matchHost(named, {
    candidates: [{ star: wrongStar, separation: 14 }],
    calibration,
  });
  assert.notEqual(result.decision, 'matched');
  assert.equal(crossmatch.matchHost(named, { candidates: [], calibration }).decision, 'unmatched');
});

test('matchHost honors overrides before IDs', () => {
  const target = star({ atHygId: '42' });
  const matched = crossmatch.matchHost(host(), {
    idHits: [{ via: 'gaia-dr3', star: star({ atHygId: '7' }) }],
    override: { hostId: 'exo-host-test', action: 'match', atHygId: '42', reason: 'manual' },
    overrideStar: target,
    calibration,
  });
  assert.equal(matched.tier, 'override');
  assert.equal(matched.star.atHygId, '42');
  const rejected = crossmatch.matchHost(host(), {
    override: { hostId: 'exo-host-test', action: 'no-match', reason: 'not in AT-HYG' },
    calibration,
  });
  assert.equal(rejected.decision, 'unmatched');
  assert.throws(
    () =>
      crossmatch.matchHost(host(), {
        override: { hostId: 'exo-host-test', action: 'match', atHygId: '404', reason: 'x' },
        calibration,
      }),
    /unknown AT-HYG star 404/
  );
});

test('matchHost sends ambiguous HD hits for component hosts to tier 3', () => {
  const result = crossmatch.matchHost(host({ name: 'HD 1 A' }), {
    idHits: [{ via: 'hd', star: star({ atHygId: '5' }) }],
    candidates: [],
    calibration,
  });
  assert.ok(result.reasons.includes('hd-ambiguous'));
  assert.equal(result.decision, 'unmatched');
});

test('enforceOneToOne keeps the strongest claim and rejects duplicate overrides', () => {
  const shared = star({ atHygId: '1' });
  const results = crossmatch.enforceOneToOne([
    { hostId: 'b', decision: 'matched', tier: 'hip', star: shared, reasons: [] },
    { hostId: 'a', decision: 'matched', tier: 'gaia-dr3', star: shared, reasons: [] },
  ]);
  assert.equal(results[1].decision, 'matched');
  assert.equal(results[0].decision, 'review');
  assert.deepEqual(results[0].reasons, ['claimed-by:a']);
  assert.throws(
    () =>
      crossmatch.enforceOneToOne([
        { hostId: 'a', decision: 'matched', tier: 'override', star: shared, reasons: [] },
        { hostId: 'b', decision: 'matched', tier: 'override', star: shared, reasons: [] },
      ]),
    /more than one host/
  );
});

test('holdout split is deterministic and close to 20%', () => {
  const ids = Array.from({ length: 2000 }, (_, index) => `exo-host-${index}`);
  const held = ids.filter(crossmatch.isHoldoutHost).length;
  assert.equal(crossmatch.isHoldoutHost('exo-host-1'), crossmatch.isHoldoutHost('exo-host-1'));
  assert.ok(held > 340 && held < 460, `held out ${held}`);
});

test('resolveHostStar: archive wins for physics, AT-HYG for position and names', () => {
  const archiveHost = host({
    name: 'HD 1',
    spectralType: 'G2 V',
    teffK: 5800,
    massSolar: 1.1,
    distancePc: 20,
    hipId: '7',
  });
  const catalogStar = star({
    atHygId: '3',
    hygId: '4',
    proper: 'Testa',
    distancePc: 21,
    x: 1,
    y: 2,
    z: 3,
  });
  const resolved = crossmatch.resolveHostStar(archiveHost, catalogStar, { lum: 10 });
  assert.equal(resolved.positionSource, 'at-hyg');
  assert.equal(resolved.distancePc, 21);
  assert.deepEqual(resolved.positionPc, { x: 1, y: 2, z: 3 });
  assert.equal(resolved.properName, 'Testa');
  assert.equal(resolved.spectralType, 'G2 V');
  assert.equal(resolved.massSolar, 1.1);
  assert.equal(resolved.logLuminositySolar, 1);
  assert.equal(resolved.ids.hipId, '7');

  const unmatched = crossmatch.resolveHostStar(host({ raDeg: 0, decDeg: 0, distancePc: 10 }));
  assert.equal(unmatched.positionSource, 'archive');
  assert.equal(unmatched.distanceSource, 'archive');
  assert.equal(unmatched.distanceApproximate, false);
  assert.ok(Math.abs(unmatched.positionPc.x - 10) < 1e-9);
});

test('resolveHostDistance follows the D31 order and is deterministic', () => {
  const resolve = (overrides, star = null) =>
    crossmatch.resolveHostDistance(host(overrides), star, { defaultDistance: 500 });

  assert.deepEqual(resolve({ distancePc: 20 }, star({ distancePc: 21 })), {
    distancePc: 21,
    source: 'at-hyg',
  });
  // Precise parallax beats a TICv8 sy_dist that disagrees (the GJ 411 case).
  assert.deepEqual(resolve({ distancePc: 5.68, parallaxMas: 392.6 }), {
    distancePc: 1000 / 392.6,
    source: 'parallax',
  });
  // Faint, distant hosts keep sy_dist even when 1/parallax disagrees.
  assert.deepEqual(resolve({ distancePc: 162, parallaxMas: 3.17 }), {
    distancePc: 162,
    source: 'archive',
  });
  assert.deepEqual(resolve({ distancePc: null, parallaxMas: 10 }), {
    distancePc: 100,
    source: 'parallax',
  });

  // A Sun-like star (log L = 0) at V = 4.83 + 5 sits at 100 pc.
  const photometric = resolve({ distancePc: null, vMag: 9.83, logLuminositySolar: 0 });
  assert.equal(photometric.source, 'photometric');
  assert.equal(photometric.approximate, true);
  assert.ok(Math.abs(photometric.distancePc - 100) < 1e-6);
  const fromRadius = resolve({
    distancePc: null,
    vMag: null,
    gaiaMag: 9.83,
    radiusSolar: 1,
    teffK: 5772,
  });
  assert.ok(Math.abs(fromRadius.distancePc - 100) < 1e-6);

  assert.deepEqual(resolve({ distancePc: null, vMag: null }), {
    distancePc: 500,
    source: 'default',
    approximate: true,
  });
  assert.deepEqual(crossmatch.resolveHostDistance(host({ distancePc: null, vMag: null })), {
    distancePc: null,
    source: 'none',
  });
  assert.equal(
    crossmatch.defaultDistancePc([{ distancePc: 30 }, { distancePc: 10 }, { distancePc: null }]),
    20
  );
});

test('buildResolvedDistances uses the archive-only median as the default', () => {
  const hosts = [
    host({ id: 'a', distancePc: 100 }),
    host({ id: 'b', distancePc: 300 }),
    host({ id: 'c', distancePc: 1, parallaxMas: 1000 }),
    host({ id: 'd', distancePc: null, vMag: null }),
  ];
  const results = new Map([
    ['a', { decision: 'unmatched' }],
    ['b', { decision: 'review' }],
    ['c', { decision: 'matched', star: star({ distancePc: 1.3 }) }],
    ['d', { decision: 'unmatched' }],
  ]);
  const { byHost, summary } = buildResolvedDistances(hosts, results);
  assert.deepEqual(summary, {
    defaultDistancePc: 200,
    bySource: { archive: 2, 'at-hyg': 1, default: 1 },
  });
  assert.deepEqual(byHost.get('c'), { distancePc: 1.3, source: 'at-hyg' });
  assert.deepEqual(byHost.get('d'), { distancePc: 200, source: 'default', approximate: true });
});

test('buildReportRecord flags review hosts carried over from the previous run', () => {
  const result = {
    hostId: 'exo-host-a',
    decision: 'review',
    tier: 'gaia-dr3',
    star: null,
    reasons: ['sanity-gate:distance'],
    ranked: [],
  };
  assert.equal(buildReportRecord(result, new Set(['exo-host-a'])).carriedOver, true);
  assert.equal(buildReportRecord(result, new Set()).carriedOver, undefined);
  assert.equal(
    buildReportRecord({ ...result, decision: 'unmatched' }, new Set(['exo-host-a'])).carriedOver,
    undefined
  );
});

test('validateOverrides checks schema rules and duplicates', () => {
  assert.deepEqual(validateOverrides({ hostMatches: [], systemAssignments: [] }), []);
  const errors = validateOverrides({
    hostMatches: [
      { hostId: 'exo-host-a', action: 'match', reason: 'x' },
      { hostId: 'exo-host-b', action: 'no-match', atHygId: '1', reason: 'x' },
      { hostId: 'exo-host-c', action: 'no-match', reason: 'x' },
      { hostId: 'exo-host-c', action: 'no-match', reason: 'y' },
    ],
    systemAssignments: [],
  });
  assert.ok(errors.some((error) => error.includes("must have required property 'atHygId'")));
  assert.ok(errors.some((error) => error.includes('/hostMatches/1')));
  assert.ok(errors.some((error) => error.includes('duplicate hostId exo-host-c')));
  const committed = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'data', 'exoplanet-overrides.json'), 'utf8')
  );
  assert.deepEqual(validateOverrides(committed), []);
});

test('match drift gate blocks large moves unless overridden', () => {
  assert.equal(checkMatchDrift(null, 0.35).blocked, false);
  assert.equal(checkMatchDrift(0.35, 0.36).blocked, false);
  assert.equal(checkMatchDrift(0.35, 0.4).blocked, true);
  assert.equal(checkMatchDrift(0.35, 0.4, { allowDrift: true }).blocked, false);
  assert.equal(isDriftOverride(['--allow-match-drift'], {}), true);
  assert.equal(isDriftOverride([], { EXOPLANET_ALLOW_MATCH_DRIFT: '1' }), true);
  assert.equal(isDriftOverride([], {}), false);
});

test('existing Forge stars are keyed by HIP', () => {
  const byHip = existingStarsByHip();
  assert.deepEqual(byHip.get('70890'), {
    existingStarId: 'alpha-centauri-star-tertiary',
    existingSystemId: 'alpha-centauri',
  });
  assert.equal(byHip.get('98298').existingStarId, 'cygnus-x1-hd226868');
});

test('EX-2.8 hard cases resolve as expected on real catalog rows', async () => {
  const { byHost } = await runFixtureMatch();
  const expect = (hostId, decision, tier) => {
    const result = byHost.get(hostId);
    assert.equal(result.decision, decision, `${hostId}: ${JSON.stringify(result.reasons)}`);
    if (tier !== undefined) assert.equal(result.tier, tier, hostId);
    return result;
  };

  expect('exo-host-proxima-cen', 'matched', 'gaia-dr3');
  const a = expect('exo-host-55-cnc', 'matched', 'gaia-dr3');
  const b = expect('exo-host-55-cnc-b', 'matched', 'gaia-dr3');
  assert.notEqual(a.star.atHygId, b.star.atHygId);
  expect('exo-host-kepler-16', 'unmatched', null);
  expect('exo-host-trappist-1', 'unmatched', null);
  expect('exo-host-toi-1036', 'matched', 'gaia-dr3');
  expect('exo-host-gj-411', 'matched', 'hip');
  assert.match(expect('exo-host-lhs-475', 'matched').reasons[0], /position-offset-accepted/);
  assert.match(expect('exo-host-kepler-907', 'review', 'gaia-dr3').reasons[0], /sanity-gate/);
  assert.deepEqual(expect('exo-host-hd-41004-a', 'review', 'hip').reasons, [
    'claimed-by:exo-host-hd-41004-b',
  ]);
  assert.deepEqual(expect('exo-host-wasp-94-b', 'review', 'scored').reasons, ['wide-separation']);
  assert.match(expect('exo-host-hd-133131-a', 'matched').reasons[0], /^ids-disagree/);
  assert.notEqual(
    byHost.get('exo-host-hd-133131-a').star.atHygId,
    byHost.get('exo-host-hd-133131-b').star.atHygId
  );
});

test('match blocks reconcile with existing Forge stars', async () => {
  const { byHost } = await runFixtureMatch();
  const proxima = FIXTURE_HOSTS.find((record) => record.id === 'exo-host-proxima-cen');
  const block = buildMatchBlock(byHost.get(proxima.id), proxima, existingStarsByHip());
  assert.equal(block.existingStarId, 'alpha-centauri-star-tertiary');
  assert.equal(block.existingSystemId, 'alpha-centauri');
  const review = buildMatchBlock(
    byHost.get('exo-host-kepler-907'),
    { id: 'exo-host-kepler-907' },
    new Map()
  );
  assert.equal(review.atHygId, undefined);
  assert.equal(review.candidateAtHygId, '1961940');
});

test('HYG star slice never emits a planetless system', async () => {
  const { hyg, scan, results } = await runFixtureMatch();
  const slice = buildHygStarSlice(results, hyg, scan.starsByHygId, new Map());
  const matchedIds = new Set(
    results.filter((result) => result.decision === 'matched').map((result) => result.hostId)
  );
  for (const record of slice.records) {
    assert.ok(record.hostIds.length > 0);
    assert.ok(
      record.hostIds.every((hostId) => matchedIds.has(hostId)),
      record.atHygId
    );
  }
  assert.equal(new Set(slice.records.map((record) => record.atHygId)).size, slice.records.length);
  const ids = slice.records.map((record) => Number(record.atHygId));
  assert.deepEqual(
    ids,
    [...ids].sort((x, y) => x - y)
  );

  // Drop 55 Cnc B: its HYG base-group companion must still ride along with 55 Cnc A.
  const onlyA = results.filter((result) => result.hostId !== 'exo-host-55-cnc-b');
  const companions = buildHygStarSlice(onlyA, hyg, scan.starsByHygId, new Map()).records.filter(
    (record) => record.role === 'companion'
  );
  assert.equal(companions.length, 1);
  assert.deepEqual(companions[0].hostIds, ['exo-host-55-cnc']);
  assert.equal(companions[0].hygBase, 'Gl 324');

  // With no matched hosts, nothing is emitted.
  assert.deepEqual(buildHygStarSlice([], hyg, scan.starsByHygId, new Map()).records, []);
});

test('summarize reports auto-match rate without overrides', () => {
  const counts = summarize([
    { decision: 'matched', tier: 'gaia-dr3' },
    { decision: 'matched', tier: 'override' },
    { decision: 'review', tier: 'hip' },
    { decision: 'unmatched', tier: null },
  ]);
  assert.equal(counts.matched, 2);
  assert.equal(counts.autoMatchRate, 0.25);
  assert.deepEqual(counts.byTier, { 'gaia-dr3': 1, override: 1 });
});

test('parseLfsPointer reads the oid and size', () => {
  const pointer = sources.parseLfsPointer(
    `version https://git-lfs.github.com/spec/v1\noid sha256:${'a'.repeat(64)}\nsize 42\n`
  );
  assert.deepEqual(pointer, { sha256: 'a'.repeat(64), size: 42 });
  assert.throws(() => sources.parseLfsPointer('<html>'), /Not a Git LFS pointer/);
});

test('ensureSource reuses a verified cache, falls back offline, and rejects bad downloads', async () => {
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exo-cache-'));
  try {
    const source = { label: 'Test', fileName: 'test.csv', pointerUrl: 'p', fileUrl: 'f' };
    const content = 'id\n1\n';
    const sha = crypto.createHash('sha256').update(content).digest('hex');
    const pointer = `oid sha256:${sha}\nsize ${content.length}\n`;
    const fetched = [];
    const fakeFetch = (body) => async (url) => {
      fetched.push(url);
      if (url === 'p') return new Response(pointer);
      return new Response(body);
    };
    const log = () => {};

    const downloaded = await sources.ensureSource(source, {
      cacheDir,
      fetchImpl: fakeFetch(content),
      log,
    });
    assert.equal(downloaded.verified, true);
    assert.equal(fs.readFileSync(downloaded.path, 'utf8'), content);

    fetched.length = 0;
    await sources.ensureSource(source, { cacheDir, fetchImpl: fakeFetch(content), log });
    assert.deepEqual(fetched, ['p']);

    const offline = await sources.ensureSource(source, {
      cacheDir,
      fetchImpl: async () => {
        throw new Error('offline');
      },
      log,
    });
    assert.equal(offline.verified, false);
    assert.equal(offline.sha256, sha);

    fs.rmSync(downloaded.path);
    await assert.rejects(
      sources.ensureSource(source, { cacheDir, fetchImpl: fakeFetch('tampered'), log }),
      /checksum mismatch/
    );
    assert.equal(fs.existsSync(downloaded.path), false);
    assert.equal(fs.existsSync(`${downloaded.path}.tmp`), false);
  } finally {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
});
