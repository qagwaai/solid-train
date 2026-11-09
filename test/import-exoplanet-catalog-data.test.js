'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ARCHIVE_COLUMNS,
  buildCatalog,
  buildReferenceTable,
  buildTapQuery,
  checkShrinkage,
  deriveOrbit,
  hostIdFor,
  isShrinkOverride,
  normalizeHosts,
  normalizePlanet,
  parseReferenceAnchor,
  planetIdFor,
  serializeSnapshot,
  validateCatalog,
} = require('../scripts/import-exoplanet-catalog-data');

const ads = (bibcode, label) =>
  `<a refstr=X href=https://ui.adsabs.harvard.edu/abs/${bibcode}/abstract target=ref> ${label} </a>`;

function row(overrides = {}) {
  return {
    pl_name: 'Test-1 b',
    pl_letter: 'b',
    hostname: 'Test-1',
    cb_flag: 0,
    pl_controv_flag: 0,
    pl_orbper: 10,
    pl_orbsmax: 0.09,
    st_mass: 1,
    hip_name: 'HIP 123',
    gaia_dr3_id: 'Gaia DR3 456789',
    sy_snum: 1,
    sy_pnum: 1,
    sy_mnum: 0,
    ra: 10,
    dec: -5,
    disc_year: 2020,
    discoverymethod: 'Transit',
    disc_refname: ads('2020AJ....160..100A', 'Alpha et al. 2020'),
    ...overrides,
  };
}

test('the TAP query lists explicit columns and never selects *', () => {
  const query = buildTapQuery();
  assert.match(query, /^select pl_name,/);
  assert.match(query, / from pscomppars$/);
  assert.doesNotMatch(query, /\*/);
  assert.equal(new Set(ARCHIVE_COLUMNS).size, ARCHIVE_COLUMNS.length);
});

test('IDs are prefixed, lowercase slugs', () => {
  assert.equal(planetIdFor('Proxima Cen b'), 'exo-proxima-cen-b');
  assert.equal(planetIdFor('2MASS J0249-0557 c'), 'exo-2mass-j0249-0557-c');
  assert.equal(hostIdFor('WASP-94 A'), 'exo-host-wasp-94-a');
  assert.equal(hostIdFor('Kepler-1647 (AB)'), 'exo-host-kepler-1647-ab');
  assert.throws(() => planetIdFor('  '), /Cannot build an ID/);
});

test('future imports preserve field limits, signed errors and references without changing points', () => {
  const planet = normalizePlanet(row({
    pl_bmasse: 25, pl_bmasselim: 1,
    pl_bmasse_reflink: ads('2013ApJ...770..131L', 'Lissauer et al. 2013'),
    pl_orbeccen: 0.15, pl_orbeccenlim: 1,
    pl_rade: 3.33, pl_radelim: 0, pl_radeerr1: 0.06, pl_radeerr2: -0.08,
  }));
  assert.equal(planet.massEarth, 25);
  assert.equal(planet.eccentricity, 0.15);
  assert.deepEqual(planet.fieldEvidence, [
    { field: 'eccentricity', value: 0.15, limit: 'upper' },
    { field: 'radiusEarth', value: 3.33, limit: 'none', errorUpper: 0.06, errorLower: -0.08 },
    { field: 'massEarth', value: 25, limit: 'upper',
      reference: ['2013ApJ...770..131L', 'Lissauer et al. 2013'] },
  ]);
  for (const column of ['pl_bmasse', 'pl_orbeccen', 'st_mass', 'st_lum']) {
    for (const suffix of ['lim', 'err1', 'err2']) {
      assert.ok(ARCHIVE_COLUMNS.includes(`${column}${suffix}`));
    }
  }
});

test('metadata retains lower limits and rejects invalid flags and signed errors', () => {
  assert.equal(normalizePlanet(row({ pl_bmasse: 3, pl_bmasselim: -1 }))
    .fieldEvidence[0].limit, 'lower');
  assert.throws(() => normalizePlanet(row({ pl_bmasse: 3, pl_bmasselim: 2 })), /invalid/);
  assert.throws(() => normalizePlanet(row({ pl_bmasse: 3, pl_bmasseerr1: -1 })), /invalid/);
  assert.throws(() => normalizePlanet(row({ pl_bmasse: 3, pl_bmasseerr2: 1 })), /invalid/);
  assert.throws(() => normalizePlanet(row({ pl_bmasse: 3, pl_bmasseerr1: 'invalid' })), /invalid/);
  const wrapped = normalizePlanet(row({ pl_orblper: -90, pl_orblperlim: 0 }));
  assert.equal(wrapped.argumentOfPeriapsisDeg, 270);
  assert.deepEqual(wrapped.fieldEvidence[0], {
    field: 'argumentOfPeriapsisDeg', value: 270, limit: 'none', sourceValue: -90,
  });
});

test('host evidence follows the selected point and retains distinct source alternatives', () => {
  const rows = [
    row({ st_mass: 1, st_masslim: 0, st_mass_reflink: ads('2013ApJ...770..131L', 'A') }),
    row({ pl_name: 'Test-1 c', st_mass: 1, st_masslim: 0,
      st_mass_reflink: ads('2014A&A...571A..38B', 'B') }),
    row({ pl_name: 'Test-1 d', st_mass: 2, st_masslim: 1 }),
  ];
  const { hosts } = normalizeHosts(rows);
  assert.equal(hosts[0].massSolar, 1);
  assert.equal(hosts[0].fieldEvidence.length, 2);
  assert.ok(hosts[0].fieldEvidence.every((entry) => entry.value === 1));
});

test('parseReferenceAnchor returns ADS bibcodes, including A&A codes', () => {
  assert.deepEqual(parseReferenceAnchor(ads('2026A&A...705A.190M', 'Moutou et al. 2026')), [
    '2026A&A...705A.190M',
    'Moutou et al. 2026',
  ]);
});

test('parseReferenceAnchor resolves relative and non-ADS links to absolute URLs', () => {
  assert.deepEqual(
    parseReferenceAnchor(
      '<a refstr=CALCULATED_VALUE href=/docs/pscp_calc.html target=_blank>Calculated Value</a>'
    ),
    ['https://exoplanetarchive.ipac.caltech.edu/docs/pscp_calc.html', 'Calculated Value']
  );
  assert.deepEqual(
    parseReferenceAnchor(
      '<a refstr=K href=https://www.nature.com/articles/s41550-021-01539-1 target=ref>Kipping et al. 2022</a>'
    ),
    ['https://www.nature.com/articles/s41550-021-01539-1', 'Kipping et al. 2022']
  );
});

test('parseReferenceAnchor keeps labels as plain text and rejects unsafe or empty links', () => {
  const [, label] = parseReferenceAnchor(
    '<a href=https://example.org/x>Smith &lt;script&gt; <b>2020</b></a>'
  );
  assert.equal(label, 'Smith <script> 2020');
  assert.equal(parseReferenceAnchor('<a href=javascript:alert(1)>Bad</a>'), null);
  assert.equal(parseReferenceAnchor('<a href=https://example.org/x></a>'), null);
  assert.equal(parseReferenceAnchor(null), null);
  assert.equal(parseReferenceAnchor(''), null);
});

test('buildReferenceTable de-duplicates and lists the discovery reference first', () => {
  const rows = [
    row({
      pl_name: 'A b',
      disc_refname: ads('2020AJ....160..100Z', 'Zed 2020'),
      pl_orbper_reflink: ads('2019AJ....150...10A', 'Able 2019'),
      pl_rade_reflink: ads('2020AJ....160..100Z', 'Zed 2020'),
    }),
    row({ pl_name: 'A c', disc_refname: ads('2019AJ....150...10A', 'Able 2019') }),
  ];
  const { entries, refIndexesByPlanet } = buildReferenceTable(rows);
  assert.deepEqual(entries, [
    ['2019AJ....150...10A', 'Able 2019'],
    ['2020AJ....160..100Z', 'Zed 2020'],
  ]);
  assert.deepEqual(refIndexesByPlanet.get('A b'), [1, 0]);
  assert.deepEqual(refIndexesByPlanet.get('A c'), [0]);
});

test('buildReferenceTable keeps previous indexes stable and appends new entries', () => {
  const previous = [
    ['2021AJ....161....1Q', 'Old label'],
    ['2018AJ....155....1U', 'Unused 2018'],
  ];
  const rows = [
    row({
      disc_refname: ads('2021AJ....161....1Q', 'New label'),
      pl_orbper_reflink: ads('2000AJ....120....1N', 'New 2000'),
    }),
  ];
  const { entries, refIndexesByPlanet, unusedCount } = buildReferenceTable(rows, previous);
  assert.deepEqual(entries, [
    ['2021AJ....161....1Q', 'New label'],
    ['2018AJ....155....1U', 'Unused 2018'],
    ['2000AJ....120....1N', 'New 2000'],
  ]);
  assert.deepEqual(refIndexesByPlanet.get('Test-1 b'), [0, 2]);
  assert.equal(unusedCount, 1);
  assert.deepEqual(previous[0], ['2021AJ....161....1Q', 'Old label']);
});

test('buildReferenceTable picks the same label regardless of row order', () => {
  const rows = [
    row({ pl_name: 'A b', disc_refname: ads('2020AJ....160..100Z', 'Zed et al. 2020') }),
    row({ pl_name: 'A c', disc_refname: ads('2020AJ....160..100Z', 'Zed 2020') }),
    row({ pl_name: 'A d', disc_refname: ads('2020AJ....160..100Z', 'Zed 2020') }),
  ];
  const forward = buildReferenceTable(rows).entries;
  const reverse = buildReferenceTable([...rows].reverse()).entries;
  const incremental = buildReferenceTable([...rows].reverse(), [
    ['2020AJ....160..100Z', 'Stale'],
  ]).entries;
  assert.deepEqual(forward, [['2020AJ....160..100Z', 'Zed 2020']]);
  assert.deepEqual(reverse, forward);
  assert.deepEqual(incremental, forward);
});

test('normalizePlanet builds a compact confirmed record and omits missing values', () => {
  const planet = normalizePlanet(
    row({ pl_orbeccen: null, pl_rade: '1.5', pl_bmasse: 3, pl_bmassprov: 'Msini' }),
    [4, 2]
  );
  assert.deepEqual(planet, {
    id: 'exo-test-1-b',
    name: 'Test-1 b',
    hostId: 'exo-host-test-1',
    status: 'confirmed',
    letter: 'b',
    orbitalPeriodDays: 10,
    semiMajorAxisAu: 0.09,
    radiusEarth: 1.5,
    massEarth: 3,
    massProvenance: 'Msini',
    discoveryYear: 2020,
    discoveryMethod: 'Transit',
    refs: [4, 2],
  });
});

test('normalizePlanet flags controversial and circumbinary planets', () => {
  const planet = normalizePlanet(row({ pl_controv_flag: 1, cb_flag: 1 }));
  assert.equal(planet.controversial, true);
  assert.equal(planet.circumbinary, true);
  assert.equal(planet.status, 'confirmed');
  assert.equal('refs' in planet, false);
});

test('normalizePlanet wraps the argument of periapsis into 0-360 degrees', () => {
  assert.equal(normalizePlanet(row({ pl_orblper: 395.341 })).argumentOfPeriapsisDeg, 35.341);
  assert.equal(normalizePlanet(row({ pl_orblper: -90 })).argumentOfPeriapsisDeg, 270);
});

test('deriveOrbit fills a missing semi-major axis or period with Kepler’s third law', () => {
  assert.deepEqual(deriveOrbit({ orbitalPeriodDays: 365.25 }, 1), {
    orbitalPeriodDays: 365.25,
    semiMajorAxisAu: 1,
  });
  assert.deepEqual(deriveOrbit({ semiMajorAxisAu: 4 }, 1), {
    semiMajorAxisAu: 4,
    orbitalPeriodDays: 2922,
  });
  const withMass = deriveOrbit({ orbitalPeriodDays: 365.25, massEarth: 332946.0487 }, 1);
  assert.equal(withMass.semiMajorAxisAu, Number(Math.cbrt(2).toPrecision(6)));
});

test('deriveOrbit leaves values alone when both exist or the star mass is unknown', () => {
  const complete = { orbitalPeriodDays: 10, semiMajorAxisAu: 0.5 };
  assert.deepEqual(deriveOrbit(complete, 1), complete);
  assert.deepEqual(deriveOrbit({ orbitalPeriodDays: 10 }, null), { orbitalPeriodDays: 10 });
  assert.deepEqual(deriveOrbit({ orbitalPeriodDays: 10 }, 0), { orbitalPeriodDays: 10 });
});

test('normalizeHosts groups planets and resolves conflicting values by consensus', () => {
  const { hosts, conflicts } = normalizeHosts([
    row({ pl_name: 'Test-1 c', st_mass: 1.1, st_spectype: 'G2 V' }),
    row({ pl_name: 'Test-1 b', st_mass: 1.0, st_spectype: 'G2 V' }),
    row({ pl_name: 'Test-1 d', st_mass: 1.1, st_spectype: null }),
    row({ pl_name: 'Other b', hostname: 'Other', hip_name: null, gaia_dr3_id: null }),
  ]);
  assert.deepEqual(
    hosts.map((host) => host.id),
    ['exo-host-other', 'exo-host-test-1']
  );
  const host = hosts[1];
  assert.equal(host.massSolar, 1.1);
  assert.equal(host.spectralType, 'G2 V');
  assert.equal(host.hipId, '123');
  assert.equal(host.gaiaDr3Id, '456789');
  assert.deepEqual(host.planetIds, ['exo-test-1-b', 'exo-test-1-c', 'exo-test-1-d']);
  assert.equal('hipId' in hosts[0], false);
  assert.deepEqual(conflicts, { massSolar: 1 });
});

test('validateCatalog passes a well-formed catalog', () => {
  const catalog = buildCatalog([row(), row({ pl_name: 'Test-1 c' })]);
  assert.deepEqual(validateCatalog(catalog, { planetMinimum: 2, hostMinimum: 1 }), []);
});

test('validateCatalog reports counts, duplicates, ranges, hosts, and reference indexes', () => {
  const catalog = buildCatalog([
    row({ pl_orbeccen: 1, pl_orbper: -1 }),
    row({ pl_name: 'Test 1 b', dec: 95 }),
  ]);
  catalog.planets[0].refs = [99];
  catalog.planets[1].hostId = 'exo-host-missing';
  const errors = validateCatalog(catalog);
  const text = errors.join('\n');
  assert.match(text, /Expected at least 6000 planets, got 2/);
  assert.match(text, /Expected at least 4500 hosts/);
  assert.match(text, /Duplicate planet ID exo-test-1-b/);
  assert.match(text, /eccentricity=1 is out of range/);
  assert.match(text, /orbitalPeriodDays=-1 is out of range/);
  assert.match(text, /decDeg=95 is out of range/);
  assert.match(text, /reference index 99 is out of range/);
  assert.match(text, /unknown host exo-host-missing/);
});

test('validateCatalog rejects non-finite numbers', () => {
  const catalog = buildCatalog([row({ pl_rade: 'not-a-number' })]);
  assert.match(
    validateCatalog(catalog, { planetMinimum: 1, hostMinimum: 1 }).join('\n'),
    /radiusEarth is not a finite number/
  );
});

test('checkShrinkage blocks losses above 2% unless overridden', () => {
  const previous = Array.from({ length: 100 }, (_, index) => `exo-p${index}`);
  const small = checkShrinkage(previous, [...previous.slice(2), 'exo-new']);
  assert.deepEqual(small.removed, ['exo-p0', 'exo-p1']);
  assert.deepEqual(small.added, ['exo-new']);
  assert.equal(small.blocked, false);

  const large = checkShrinkage(previous, previous.slice(3));
  assert.equal(large.exceeded, true);
  assert.equal(large.blocked, true);
  assert.equal(checkShrinkage(previous, previous.slice(3), { allowShrink: true }).blocked, false);
  assert.equal(checkShrinkage([], ['exo-a']).blocked, false);
});

test('isShrinkOverride accepts the CLI flag or the environment variable', () => {
  assert.equal(isShrinkOverride(['--allow-shrink'], {}), true);
  assert.equal(isShrinkOverride([], { EXOPLANET_ALLOW_SHRINK: '1' }), true);
  assert.equal(isShrinkOverride([], { EXOPLANET_ALLOW_SHRINK: '0' }), false);
  assert.equal(isShrinkOverride([], {}), false);
});

test('serializeSnapshot writes valid JSON with one record per line', () => {
  const text = serializeSnapshot({ source: 'Test', recordCount: 2 }, [{ id: 'a' }, { id: 'b' }]);
  assert.deepEqual(JSON.parse(text), {
    source: 'Test',
    recordCount: 2,
    records: [{ id: 'a' }, { id: 'b' }],
  });
  assert.equal(text.split('\n').filter((line) => line.startsWith('    {')).length, 2);
  assert.deepEqual(JSON.parse(serializeSnapshot({ source: 'Empty' }, [])).records, []);
});
