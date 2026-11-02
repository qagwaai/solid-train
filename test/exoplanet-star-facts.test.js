'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  companionCatalogName,
  companionStarFacts,
  defaultDistancePc,
  hostStarFacts,
  knownDistance,
  matchedCatalogRecord,
  resolveHostDistance,
  roundedPosition,
} = require('../src/model/exoplanet-star-facts');

test('distance defaults ignore unknown values and compute odd and even medians', () => {
  for (const value of [null, undefined, 0, -1, 100000, Infinity, NaN]) {
    assert.equal(knownDistance(value), null);
  }
  assert.equal(knownDistance(99999), 99999);
  assert.equal(defaultDistancePc([]), null);
  assert.equal(defaultDistancePc([{ distancePc: null }]), null);
  assert.equal(defaultDistancePc([10, 30, 20].map((distancePc) => ({ distancePc }))), 20);
  assert.equal(defaultDistancePc([10, 30].map((distancePc) => ({ distancePc }))), 20);
  assert.equal(defaultDistancePc([{ distancePc: 1.23456 }]), 1.235);
});

test('parallax threshold is inclusive and archive distances survive small disagreements', () => {
  assert.deepEqual(resolveHostDistance({ distancePc: 300, parallaxMas: 5 }), {
    distancePc: 200,
    source: 'parallax',
  });
  assert.deepEqual(resolveHostDistance({ distancePc: 300, parallaxMas: 4.999 }), {
    distancePc: 300,
    source: 'archive',
  });
  assert.deepEqual(resolveHostDistance({ distancePc: 205, parallaxMas: 5 }), {
    distancePc: 205,
    source: 'archive',
  });
  assert.deepEqual(resolveHostDistance({ parallaxMas: -1, vMag: NaN }), {
    distancePc: null,
    source: 'none',
  });
});

test('companion names follow the documented catalog fallback order', () => {
  const fields = {
    properName: 'Proper',
    bayer: 'Alpha',
    constellation: 'Cen',
    flamsteed: '1',
    glName: 'Gl 1',
    hipId: '2',
    hdId: '3',
    gaiaDr3Id: '4',
    atHygId: '5',
  };
  for (const [remove, expected] of [
    [null, 'Proper'],
    ['properName', 'Alpha Cen'],
    ['bayer', '1 Cen'],
    ['flamsteed', 'Gl 1'],
    ['glName', 'HIP 2'],
    ['hipId', 'HD 3'],
    ['hdId', 'Gaia DR3 4'],
    ['gaiaDr3Id', 'AT-HYG 5'],
  ]) {
    if (remove) delete fields[remove];
    assert.equal(companionCatalogName(fields), expected);
  }
});

test('companions reconstruct positions when Cartesian coordinates are absent', () => {
  const facts = companionStarFacts({
    atHygId: '5',
    raDeg: 90,
    decDeg: 0,
    distancePc: 10,
    luminositySolar: 100,
  });
  assert.deepEqual(facts.positionPc, { x: 0, y: 10, z: 0 });
  assert.equal(facts.logLuminositySolar, 2);
  assert.equal(companionStarFacts({ atHygId: '5' }).positionPc, null);
  assert.equal(roundedPosition(null), null);
  assert.deepEqual(roundedPosition({ x: NaN, y: 1.123456, z: 0 }, 6), {
    x: null,
    y: 1.123456,
    z: 0,
  });
});

test('missing matched records fall back to archive facts and mark default distances approximate', () => {
  const host = { id: 'h', name: 'Host', match: { decision: 'matched', atHygId: 'missing' } };
  assert.equal(matchedCatalogRecord(host, new Map()), null);
  assert.equal(matchedCatalogRecord({ match: { decision: 'review' } }, new Map()), null);
  const facts = hostStarFacts(host, null, 500);
  assert.equal(facts.distancePc, 500);
  assert.equal(facts.distanceSource, 'default');
  assert.equal(facts.distanceApproximate, true);
  assert.equal(facts.positionPc, null);
});
