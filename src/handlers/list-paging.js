'use strict';

/**
 * Offset paging shared by solar-system-list, star-list and celestial-body-list
 * (P2, D68). Lists are always paged: a request without offset/limit gets the
 * first DEFAULT_PAGE_LIMIT items plus total and hasMore.
 */

const DEFAULT_PAGE_LIMIT = 100;
const MAX_PAGE_LIMIT = 500;

/**
 * Validate offset and limit. Missing values take defaults; a limit above the
 * maximum is clamped. Nonintegers and out-of-range values are rejected.
 * @param {Object} payload
 * @returns {{ ok: boolean, offset: number, limit: number, message?: string }}
 */
function parsePaging(payload) {
  const rawOffset = payload?.offset;
  const rawLimit = payload?.limit;
  const offsetValid =
    rawOffset === undefined ||
    rawOffset === null ||
    (Number.isSafeInteger(rawOffset) && rawOffset >= 0);
  const limitValid =
    rawLimit === undefined || rawLimit === null || (Number.isSafeInteger(rawLimit) && rawLimit > 0);
  const offset = offsetValid && Number.isSafeInteger(rawOffset) ? rawOffset : 0;
  const limit =
    limitValid && Number.isSafeInteger(rawLimit)
      ? Math.min(rawLimit, MAX_PAGE_LIMIT)
      : DEFAULT_PAGE_LIMIT;
  if (!offsetValid) {
    return {
      ok: false,
      offset,
      limit,
      message: 'offset must be a non-negative integer when provided',
    };
  }
  if (!limitValid) {
    return { ok: false, offset, limit, message: 'limit must be a positive integer when provided' };
  }
  return { ok: true, offset, limit };
}

/**
 * Slice one page from a fully filtered and sorted list.
 * @template T
 * @param {T[]} items
 * @param {{ offset: number, limit: number }} paging
 * @returns {{ items: T[], page: { total: number, offset: number, limit: number, hasMore: boolean } }}
 */
function pageItems(items, { offset, limit }) {
  const total = items.length;
  return {
    items: items.slice(offset, offset + limit),
    page: { total, offset, limit, hasMore: offset + limit < total },
  };
}

/** Paging fields for a failure response. */
function emptyPage(paging) {
  return {
    total: 0,
    offset: paging?.offset ?? 0,
    limit: paging?.limit ?? DEFAULT_PAGE_LIMIT,
    hasMore: false,
  };
}

/** Ordinal string comparison, independent of locale. */
function compareIds(left, right) {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

/** Ascending numeric compare with null or undefined last. */
function compareNullableNumbers(left, right) {
  const leftMissing = left === null || left === undefined;
  const rightMissing = right === null || right === undefined;
  if (leftMissing || rightMissing) return Number(leftMissing) - Number(rightMissing);
  return left - right;
}

const NAME_COLLATOR = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

/** Case-insensitive, accent-insensitive, numeric-aware name compare. */
function compareNames(left, right) {
  return NAME_COLLATOR.compare(left || '', right || '');
}

module.exports = {
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
  compareIds,
  compareNames,
  compareNullableNumbers,
  emptyPage,
  pageItems,
  parsePaging,
};
