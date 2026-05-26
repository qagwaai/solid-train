'use strict';

const { ALL_ITEMS } = require('./canonical-items');

const RUNTIME_FORBIDDEN_ITEMTYPE_PREFIXES = Object.freeze(['raw-material-']);

const CANONICAL_ITEM_TYPES = Object.freeze(
  [...new Set(ALL_ITEMS.map((item) => String(item?.itemType || '').trim()).filter(Boolean))].sort()
);

const CANONICAL_ITEM_TYPE_SET = new Set(CANONICAL_ITEM_TYPES);

function isCanonicalItemType(itemType) {
  const normalized = String(itemType || '').trim();
  if (!normalized) {
    return false;
  }

  return CANONICAL_ITEM_TYPE_SET.has(normalized);
}

function hasForbiddenRuntimePrefix(itemType) {
  const normalized = String(itemType || '').trim();
  if (!normalized) {
    return false;
  }

  return RUNTIME_FORBIDDEN_ITEMTYPE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function isCanonicalRuntimeItemType(itemType) {
  return isCanonicalItemType(itemType) && !hasForbiddenRuntimePrefix(itemType);
}

function assertCanonicalRuntimeItemType(itemType) {
  if (!isCanonicalRuntimeItemType(itemType)) {
    throw new Error(`Unsupported runtime item type: ${String(itemType || '(missing itemType)')}`);
  }
}

module.exports = {
  CANONICAL_ITEM_TYPES,
  RUNTIME_FORBIDDEN_ITEMTYPE_PREFIXES,
  isCanonicalItemType,
  hasForbiddenRuntimePrefix,
  isCanonicalRuntimeItemType,
  assertCanonicalRuntimeItemType,
};
