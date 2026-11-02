'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
  compareNames,
  compareNullableNumbers,
  emptyPage,
  pageItems,
  parsePaging,
} = require('../src/handlers/list-paging');

test('parsePaging defaults, clamps, and rejects invalid values', () => {
  assert.deepEqual(parsePaging({}), { ok: true, offset: 0, limit: DEFAULT_PAGE_LIMIT });
  assert.deepEqual(parsePaging(undefined), { ok: true, offset: 0, limit: 100 });
  assert.deepEqual(parsePaging({ offset: 20, limit: 5 }), { ok: true, offset: 20, limit: 5 });
  assert.deepEqual(parsePaging({ limit: 10_000 }), { ok: true, offset: 0, limit: MAX_PAGE_LIMIT });
  for (const offset of [-1, 1.5, '3']) {
    assert.equal(parsePaging({ offset }).ok, false, `offset ${offset}`);
  }
  for (const limit of [0, -5, 2.5, '10']) {
    const result = parsePaging({ limit });
    assert.equal(result.ok, false, `limit ${limit}`);
    assert.equal(result.message, 'limit must be a positive integer when provided');
  }
});

test('pageItems reports total and hasMore and tolerates offsets past the end', () => {
  const items = Array.from({ length: 7 }, (_, i) => i);
  assert.deepEqual(pageItems(items, { offset: 0, limit: 3 }), {
    items: [0, 1, 2],
    page: { total: 7, offset: 0, limit: 3, hasMore: true },
  });
  assert.deepEqual(pageItems(items, { offset: 6, limit: 3 }).page.hasMore, false);
  assert.deepEqual(pageItems(items, { offset: 50, limit: 3 }), {
    items: [],
    page: { total: 7, offset: 50, limit: 3, hasMore: false },
  });
  assert.deepEqual(emptyPage({ offset: 4, limit: 9 }), {
    total: 0,
    offset: 4,
    limit: 9,
    hasMore: false,
  });
});

test('comparators sort nulls last and names naturally', () => {
  assert.deepEqual([3, null, 1].sort(compareNullableNumbers), [1, 3, null]);
  assert.deepEqual(['HD 10', 'hd 9', 'Ève'].sort(compareNames), ['Ève', 'hd 9', 'HD 10']);
});
