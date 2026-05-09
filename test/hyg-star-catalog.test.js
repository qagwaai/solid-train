'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseHygCsv,
  loadHygFixture,
  getHygSystems,
  colorHexFromBv,
  spectralClassLetter,
  spectralSubclass,
  massSolarFromSpectral,
} = require('../src/model/hyg-star-catalog');

test('parseHygCsv extracts canonical fields from header row', () => {
  const csv = [
    'id,hip,hd,proper,ra,dec,dist,mag,absmag,spect,ci,x,y,z,lum,system_id,system_role',
    '0,,,Sol,0,0,0.0000001,-26.7,4.85,G2V,0.656,0,0,0,1,sol,primary',
  ].join('\n');
  const records = parseHygCsv(csv);
  assert.equal(records.length, 1);
  const sol = records[0];
  assert.equal(sol.hygId, '0');
  assert.equal(sol.properName, 'Sol');
  assert.equal(sol.spectralType, 'G2V');
  assert.equal(sol.spectralClass, 'G');
  assert.equal(sol.spectralSubclass, 2);
  assert.equal(sol.systemId, 'sol');
  assert.equal(sol.systemRole, 'primary');
  assert.ok(typeof sol.colorHex === 'string' && sol.colorHex.startsWith('#'));
  assert.ok(sol.massKg > 0);
  assert.ok(sol.radiusKm > 0);
});

test('loadHygFixture returns Sol + Alpha Centauri stars', () => {
  const records = loadHygFixture();
  const ids = records.map((r) => r.hygId);
  assert.ok(ids.includes('0'));
  assert.ok(ids.includes('71456')); // α Cen A
  assert.ok(ids.includes('71460')); // α Cen B
  assert.ok(ids.includes('70890')); // Proxima
  assert.ok(records.length >= 6);
});

test('getHygSystems groups Alpha Centauri into a single multi-star system', () => {
  const systems = getHygSystems();
  const alpha = systems.find((s) => s.systemId === 'alpha-centauri');
  assert.ok(alpha);
  assert.equal(alpha.isMultiStar, true);
  assert.equal(alpha.stars.length, 3);
  assert.equal(alpha.stars[0].systemRole, 'primary');
});

test('colorHexFromBv covers blue-to-red spectrum', () => {
  const blue = colorHexFromBv(-0.3);
  const sun = colorHexFromBv(0.65);
  const red = colorHexFromBv(1.9);
  assert.notEqual(blue, sun);
  assert.notEqual(sun, red);
  for (const hex of [blue, sun, red]) {
    assert.match(hex, /^#[0-9a-f]{6}$/);
  }
});

test('spectralClassLetter and spectralSubclass parse mixed strings', () => {
  assert.equal(spectralClassLetter('M5.5Ve'), 'M');
  assert.equal(spectralClassLetter('K1V'), 'K');
  assert.equal(spectralSubclass('M5.5Ve'), 5.5);
  assert.equal(spectralSubclass('G2V'), 2);
  assert.equal(spectralSubclass('unknown'), 5);
});

test('massSolarFromSpectral returns higher mass for hotter classes', () => {
  const oMass = massSolarFromSpectral('O', 5);
  const gMass = massSolarFromSpectral('G', 5);
  const mMass = massSolarFromSpectral('M', 5);
  assert.ok(oMass > gMass);
  assert.ok(gMass > mMass);
});
