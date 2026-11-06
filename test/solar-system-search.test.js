'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  buildSolarSystemSearchTerms,
  matchesSolarSystemSearch,
} = require('../src/model/solar-system-search');

test('system search supports literal one- and two-character CJK substrings', () => {
  const system = { displayName: '星港' };
  assert.equal(matchesSolarSystemSearch(system, '星'), true);
  assert.equal(matchesSolarSystemSearch(system, '港'), true);
  assert.equal(matchesSolarSystemSearch(system, '星港'), true);
});

test('system search preserves literal Arabic and Devanagari substrings', () => {
  assert.equal(matchesSolarSystemSearch({ settlementName: 'مرفأ النجوم' }, 'مرفأ'), true);
  assert.equal(matchesSolarSystemSearch({ aliases: ['प्रकाश पथ'] }, 'प्रकाश'), true);
});

test('system search matches canonically equivalent composed and decomposed Unicode', () => {
  const composed = { displayName: 'Café' };
  const decomposedQuery = 'Cafe\u0301';
  const decomposed = { aliases: ['Cafe\u0301'] };
  assert.equal(matchesSolarSystemSearch(composed, decomposedQuery), true);
  assert.equal(matchesSolarSystemSearch(decomposed, 'Café'), true);
  assert.ok(buildSolarSystemSearchTerms(composed).includes('café'));
});

test('system search uses English locale casing without Turkish dotted-I or accent folding', () => {
  assert.equal(matchesSolarSystemSearch({ displayName: 'İstanbul' }, 'İST'), true);
  assert.equal(matchesSolarSystemSearch({ displayName: 'İstanbul' }, 'istanbul'), false);
  assert.equal(matchesSolarSystemSearch({ displayName: 'Café' }, 'cafe'), false);
});

test('system search collapses whitespace and matches each searchable field independently', () => {
  const system = {
    id: 'exo-ab-1',
    displayName: 'North   Harbor (AB 1)',
    settlementName: 'North Harbor',
    catalogName: 'AB 1',
    aliases: ['Old   Harbor'],
    primaryStar: { properName: 'Named Star', spectralType: 'G2V' },
  };
  assert.equal(matchesSolarSystemSearch(system, 'exo-ab'), true);
  assert.equal(matchesSolarSystemSearch(system, ' NORTH  HARBOR '), true);
  assert.equal(matchesSolarSystemSearch(system, 'ab 1'), true);
  assert.equal(matchesSolarSystemSearch(system, 'old harbor'), true);
  assert.equal(matchesSolarSystemSearch(system, 'named star'), true);
  assert.equal(matchesSolarSystemSearch(system, 'g2v'), true);
  // Distinct fields cannot join to create a false substring match.
  assert.equal(
    matchesSolarSystemSearch({ displayName: 'alpha', catalogName: 'beta' }, 'a|b'),
    false
  );
});

test('system search treats regex metacharacters as literal text', () => {
  assert.equal(matchesSolarSystemSearch({ catalogName: 'A.* (B)' }, '.* ('), true);
  assert.equal(matchesSolarSystemSearch({ catalogName: 'Axyz (B)' }, '.* ('), false);
});

test('blank searches do not filter systems', () => {
  assert.equal(matchesSolarSystemSearch({ displayName: 'Any system' }, '   '), true);
});
