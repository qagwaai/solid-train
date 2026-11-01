'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { decodeHtml, parseJplSatellites } = require('../scripts/import-sol-catalog-data');

test('decodeHtml extracts text and decodes entities only once', () => {
  assert.equal(decodeHtml('<p>Moon &amp; Earth</p>'), 'Moon & Earth');
  assert.equal(
    decodeHtml('&amp;#60;script&amp;#62;alert(1)&amp;#60;/script&amp;#62;'),
    '&#60;script&#62;alert(1)&#60;/script&#62;'
  );
});

test('parseJplSatellites preserves nested encoded markup as text', () => {
  const cells = Array.from({ length: 20 }, () => '<td></td>');
  cells[0] = '<td>1</td>';
  cells[1] = '<td>Saturn</td>';
  cells[2] = '<td>&amp;#60;script&amp;#62;</td>';
  cells[3] = '<td>1</td>';
  cells[5] = '<td>J2000</td>';
  cells[6] = '<td>2025-01-01</td>';
  cells[7] = '<td>100000</td>';
  cells[8] = '<td>0.1</td>';
  cells[9] = '<td>0</td>';
  cells[10] = '<td>0</td>';
  cells[11] = '<td>0</td>';
  cells[12] = '<td>0</td>';
  cells[13] = '<td>10</td>';

  const satellites = parseJplSatellites(`<table><tr>${cells.join('')}</tr></table>`);

  assert.equal(satellites.length, 1);
  assert.equal(satellites[0].name, '&#60;script&#62;');
});
