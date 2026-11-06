'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const catalog = require('../src/model/exoplanet-catalog');

function fixtureCatalog(t) {
  const fixtures = {
    'exoplanet-systems': {
      snapshotDate: '2026-11-01',
      records: [
        {
          id: 'exo-test',
          catalogName: 'Test',
          stars: [
            {
              starId: 'exo-star-test',
              source: 'archive-host',
              hostId: 'host-test',
              atHygId: '1',
              planetIds: ['planet-test'],
            },
          ],
        },
      ],
    },
    'exoplanet-hosts': {
      records: [{ id: 'host-test', name: 'Test', massSolar: 1, distancePc: 10 }],
    },
    'exoplanet-hyg-stars': {
      records: [{ atHygId: '1', distancePc: 10, xPc: 10, yPc: 0, zPc: 0 }],
    },
    'exoplanet-planets': {
      records: [
        { id: 'planet-test', hostId: 'host-test', name: 'Test b', refs: [0, 1, 99] },
        { id: 'unrelated', hostId: 'other', name: 'Other b' },
      ],
    },
    'exoplanet-names': { systems: {}, stars: {}, planets: {} },
    'exoplanet-references': {
      adsUrlTemplate: 'https://ui.adsabs.harvard.edu/abs/{bibcode}/abstract',
      records: [
        ['2026Test...1', 'Discovery'],
        ['https://example.test/planet', ''],
      ],
    },
  };
  for (const [name, fixture] of Object.entries(fixtures)) {
    const id = require.resolve(`../data/${name}.json`);
    require(id);
    const original = require.cache[id].exports;
    require.cache[id].exports = fixture;
    t.after(() => {
      require.cache[id].exports = original;
      catalog.clearExoplanetCatalogCache();
    });
  }
  catalog.clearExoplanetCatalogCache();
  return fixtures;
}

test('seed hashes change for each relevant input, but not unrelated planets or snapshot dates', (t) => {
  const fixtures = fixtureCatalog(t);
  const hash = () => {
    catalog.clearExoplanetCatalogCache();
    return catalog.getExoplanetSystemSeedHash('exo-test');
  };
  const baseline = hash();
  assert.match(baseline, /^[0-9a-f]{12}$/);
  const mutations = [
    () => (fixtures['exoplanet-systems'].records[0].catalogName = 'Renamed'),
    () => (fixtures['exoplanet-hosts'].records[0].massSolar = 2),
    () => (fixtures['exoplanet-hyg-stars'].records[0].distancePc = 11),
    () => (fixtures['exoplanet-planets'].records[0].massEarth = 5),
    () => (fixtures['exoplanet-names'].stars['exo-star-test'] = 'Star name'),
    () => (fixtures['exoplanet-names'].planets['planet-test'] = 'Planet name'),
    () => (fixtures['exoplanet-references'].records[0][1] = 'Updated discovery'),
    () =>
      fixtures['exoplanet-hosts'].records.push({
        id: 'default-host',
        resolvedDistance: { source: 'default', distancePc: 500 },
      }),
  ];
  let previous = baseline;
  for (const mutate of mutations) {
    mutate();
    const next = hash();
    assert.notEqual(next, previous, mutate.toString());
    previous = next;
  }
  fixtures['exoplanet-names'].systems['exo-test'] = 'Presentation-only system name';
  assert.equal(hash(), previous, 'system names must not change physical/body seed hashes');
  fixtures['exoplanet-planets'].records[1].massEarth = 50;
  fixtures['exoplanet-systems'].snapshotDate = '2026-12-02';
  assert.equal(hash(), previous);
  assert.equal(catalog.getExoplanetSystemSeedHash('exo-test'), previous);
});

test('system presentation override does not alter exoplanet body labels or physical hash', (t) => {
  const fixtures = fixtureCatalog(t);
  const hash = catalog.getExoplanetSystemSeedHash('exo-test');
  const bodiesBefore = catalog.generateExoplanetSystemBodies('exo-test');
  fixtures['exoplanet-names'].systems['exo-test'] = 'Presentation-only system name';
  catalog.clearExoplanetCatalogCache();
  assert.equal(catalog.getExoplanetSystemSeedHash('exo-test'), hash);
  assert.deepEqual(catalog.generateExoplanetSystemBodies('exo-test'), bodiesBefore);
});

test('cache reset refreshes seed hashes, display names, references and star entries', (t) => {
  const fixtures = fixtureCatalog(t);
  const firstHash = catalog.getExoplanetSystemSeedHash('exo-test');
  const firstStars = catalog.getExoplanetStarEntries();
  const firstRegistry = catalog.getExoplanetRegistryRecords();
  assert.equal(catalog.getExoplanetStarEntries(), firstStars);
  assert.equal(catalog.getExoplanetRegistryRecords(), firstRegistry);
  fixtures['exoplanet-names'].stars['exo-star-test'] = 'New star';
  fixtures['exoplanet-names'].planets['planet-test'] = 'New planet';
  assert.equal(catalog.getExoplanetSystemSeedHash('exo-test'), firstHash);
  catalog.clearExoplanetCatalogCache();
  assert.notEqual(catalog.getExoplanetSystemSeedHash('exo-test'), firstHash);
  assert.notEqual(catalog.getExoplanetStarEntries(), firstStars);
  assert.equal(catalog.getExoplanetStarEntries()[0].properName, 'New star');
  const result = catalog.generateExoplanetSystemBodies('exo-test');
  assert.equal(result.stars[0].displayName, 'New star');
  assert.equal(result.planets[0].displayName, 'New planet');
  assert.deepEqual(result.planets[0].discovery.references, [
    { label: 'Discovery', url: 'https://ui.adsabs.harvard.edu/abs/2026Test...1/abstract' },
    { label: 'https://example.test/planet', url: 'https://example.test/planet' },
  ]);
});

test('unknown systems return the documented absent values', (t) => {
  fixtureCatalog(t);
  assert.equal(catalog.getExoplanetSystemById('missing'), null);
  assert.equal(catalog.getExoplanetSystemSeedHash('missing'), null);
  assert.equal(catalog.generateExoplanetSystemBodies('missing'), null);
  assert.deepEqual(catalog.getExistingSystemCatalogPlanetIds('missing'), []);
  assert.deepEqual(catalog.getExistingSystemCatalogPlanetIds('exo-test'), []);
});
