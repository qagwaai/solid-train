'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { getSolarSystems } = require('../src/db/service/solar-system-service');
const {
  buildSolarSystemSearchTerms,
  matchesSolarSystemSearch,
} = require('../src/model/solar-system-search');

test('persisted system search includes catalog names and aliases like registry search', async () => {
  let capturedQuery;
  const model = {
    find(query) {
      capturedQuery = query;
      return {
        sort() {
          return this;
        },
        async lean() {
          return [];
        },
      };
    },
  };
  const ctx = { toNonEmptyString: (value) => String(value || '').trim(), log() {} };
  await getSolarSystems(ctx, model, { search: 'Lantern Reach' });
  assert.ok(capturedQuery.searchTerms instanceof RegExp);
  assert.equal(capturedQuery.searchTerms.test('lantern reach'), true);
  assert.equal(capturedQuery.searchTerms.test('unrelated'), false);
});

test('persisted system search normalizes Unicode and safely escapes regex metacharacters', async () => {
  let capturedQuery;
  const model = {
    find(query) {
      capturedQuery = query;
      return {
        sort() {
          return this;
        },
        async lean() {
          return [];
        },
      };
    },
  };
  const ctx = { toNonEmptyString: (value) => String(value || '').trim(), log() {} };
  await getSolarSystems(ctx, model, { search: 'Cafe\u0301.*' });
  assert.equal(capturedQuery.searchTerms.test('café.*'), true);
  assert.equal(capturedQuery.searchTerms.test('caféanything'), false);
  assert.equal(capturedQuery.searchTerms.test('cafe\u0301.*'), false);
});

test('solar-system upserts persist normalized search terms without changing source labels', async () => {
  const { upsertSolarSystem } = require('../src/db/service/solar-system-service');
  let update;
  const model = {
    findOneAndUpdate(_filter, value) {
      update = value;
      return { lean: async () => value };
    },
  };
  const ctx = { log() {} };
  const source = { id: 'exo-example', displayName: 'Cafe\u0301 星', catalogName: 'AB.1' };
  await upsertSolarSystem(ctx, model, source);
  assert.equal(update.displayName, 'Cafe\u0301 星');
  assert.deepEqual(update.searchTerms, ['exo-example', 'café 星', 'ab.1']);
});

test('Mongo query projection and registry matcher agree across multilingual labels', async () => {
  const system = {
    id: 'exo-example',
    displayName: 'Cafe\u0301 星港',
    settlementName: 'مرفأ',
    catalogName: 'AB.1',
    aliases: ['प्रकाश पथ', 'İstanbul'],
    primaryStar: { properName: 'Named Star', spectralType: 'G2V' },
  };
  const terms = buildSolarSystemSearchTerms(system);
  const ctx = { toNonEmptyString: (value) => String(value || '').trim(), log() {} };
  const queries = [
    'exo-example',
    '星',
    '星港',
    'Café',
    'مرفأ',
    'प्रकाश',
    'İST',
    'istanbul',
    ' named   star ',
    'AB.*',
    'Star|AB',
  ];

  for (const search of queries) {
    let capturedQuery;
    const model = {
      find(query) {
        capturedQuery = query;
        return {
          sort() {
            return this;
          },
          async lean() {
            return [];
          },
        };
      },
    };
    await getSolarSystems(ctx, model, { search });
    const mongoMatches = capturedQuery.searchTerms
      ? terms.some((term) => capturedQuery.searchTerms.test(term))
      : true;
    assert.equal(mongoMatches, matchesSolarSystemSearch(system, search), search);
  }
});
