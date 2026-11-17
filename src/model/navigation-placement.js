'use strict';

const { createHash } = require('node:crypto');

const BASIS_ID = 'stellar:sol:catalog-cartesian:v1';
const MODEL_ID = 'sol-catalog-kepler-position-v1';
const PLACEMENT_RULE = 'station-docked-zero-offset-v1';

function canonical(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])])
    );
  }
  return value;
}

function revision(value) {
  return createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');
}

function shipRevision(ship) {
  const spatial = ship.spatial;
  const owner = ship.ownership;
  return revision({
    id: ship.id,
    spatial: spatial && {
      solarSystemId: spatial.solarSystemId,
      frame: spatial.frame,
      epochMs: spatial.epochMs,
      positionKm: {
        x: spatial.positionKm?.x,
        y: spatial.positionKm?.y,
        z: spatial.positionKm?.z,
      },
    },
    ownership: owner && {
      ownerType: owner.ownerType,
      playerId: owner.playerId || null,
      characterId: owner.characterId || null,
      npcId: owner.npcId || null,
      factionId: owner.factionId || null,
    },
  });
}

function preserveNavigationPlacements(previousShips, nextShips) {
  const previous = new Map((previousShips || []).map((ship) => [ship.id, ship]));
  return nextShips.map((ship) => {
    const { navigationPlacement: _untrusted, ...next } = ship;
    const original = previous.get(ship.id);
    if (original?.navigationPlacement && shipRevision(original) === shipRevision(next)) {
      next.navigationPlacement = structuredClone(original.navigationPlacement);
    }
    return next;
  });
}

module.exports = {
  BASIS_ID,
  MODEL_ID,
  PLACEMENT_RULE,
  revision,
  shipRevision,
  preserveNavigationPlacements,
};
