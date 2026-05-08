'use strict';

function hashString(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
}

function toIsoHour(timestamp) {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return new Date(0).toISOString().slice(0, 13);
  }

  return parsed.toISOString().slice(0, 13);
}

function toPrice(value) {
  return Math.max(1, Math.round(value));
}

function calculateDriftMultiplier({ marketId, itemId, timestamp, driftPercentPerHour }) {
  const seed = `${marketId}:${itemId}:${toIsoHour(timestamp)}`;
  const hashed = hashString(seed);
  const normalized = (hashed % 10001) / 10000;
  const spread = driftPercentPerHour / 100;
  return 1 + (normalized * 2 - 1) * spread;
}

function computeMidpointPrice({
  baseMidpointPrice,
  marketMultiplier,
  marketId,
  itemId,
  timestamp,
  driftPercentPerHour,
}) {
  const driftMultiplier = calculateDriftMultiplier({
    marketId,
    itemId,
    timestamp,
    driftPercentPerHour,
  });
  const midpointPrice = toPrice(baseMidpointPrice * marketMultiplier * driftMultiplier);

  return {
    midpointPrice,
    driftMultiplier,
  };
}

module.exports = {
  computeMidpointPrice,
};
