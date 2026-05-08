'use strict';

const SUPPORTED_LOCALES = new Set(['en', 'it']);

function toPlainObject(_ctx, value) {
  if (value && typeof value.toObject === 'function') {
    return value.toObject();
  }

  return value;
}

function isFiniteNumber(_ctx, value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function isTriple(ctx, value) {
  return (
    Boolean(value) &&
    isFiniteNumber(ctx, value.x) &&
    isFiniteNumber(ctx, value.y) &&
    isFiniteNumber(ctx, value.z)
  );
}

function normalizeTriple(ctx, value) {
  if (!isTriple(ctx, value)) {
    return null;
  }

  return {
    x: value.x,
    y: value.y,
    z: value.z,
  };
}

function toNonEmptyString(_ctx, value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}

function normalizeLocale(ctx, value) {
  const raw = toNonEmptyString(ctx, value).toLowerCase();
  if (!raw) {
    return 'en';
  }

  const base = raw.split('-')[0];
  return SUPPORTED_LOCALES.has(base) ? base : 'en';
}

function normalizePlayerName(ctx, value) {
  const playerName = toNonEmptyString(ctx, value);

  if (!playerName) {
    return '';
  }

  return playerName.toLowerCase();
}

module.exports = {
  toPlainObject,
  isFiniteNumber,
  isTriple,
  normalizeTriple,
  toNonEmptyString,
  normalizeLocale,
  normalizePlayerName,
};
