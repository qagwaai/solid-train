'use strict';

const OWNER_TYPES = new Set(['player-character', 'npc-pirate', 'unowned', 'unknown']);

function normalizeOwnership(ctx, raw) {
  const source = raw && typeof raw === 'object' ? raw : null;
  if (!source) {
    return { error: 'ship.ownership is required' };
  }

  const ownerType = ctx.toNonEmptyString(source.ownerType);
  const playerId = ctx.toNonEmptyString(source.playerId) || null;
  const characterId = ctx.toNonEmptyString(source.characterId) || null;
  const npcId = ctx.toNonEmptyString(source.npcId) || null;
  const factionId = ctx.toNonEmptyString(source.factionId) || null;
  const claimToken = ctx.toNonEmptyString(source.claimToken) || null;

  if (!OWNER_TYPES.has(ownerType)) {
    return {
      error:
        'ship.ownership.ownerType must be one of: player-character, npc-pirate, unowned, unknown',
    };
  }

  if (ownerType === 'player-character') {
    if (!playerId || !characterId) {
      return {
        error:
          'ship.ownership.playerId and ship.ownership.characterId are required when ownerType is player-character',
      };
    }

    if (npcId) {
      return { error: 'ship.ownership must not include npcId when ownerType is player-character' };
    }
  }

  if (ownerType === 'npc-pirate') {
    if (!npcId) {
      return { error: 'ship.ownership.npcId is required when ownerType is npc-pirate' };
    }

    if (characterId) {
      return { error: 'ship.ownership must not include characterId when ownerType is npc-pirate' };
    }

    if (playerId) {
      return { error: 'ship.ownership must not include playerId when ownerType is npc-pirate' };
    }
  }

  if (ownerType === 'unowned' || ownerType === 'unknown') {
    if (playerId || characterId || npcId) {
      return {
        error: `ship.ownership must not include playerId, characterId, or npcId when ownerType is ${ownerType}`,
      };
    }
  }

  return {
    ownerType,
    playerId,
    characterId,
    npcId,
    factionId,
    claimToken,
  };
}

function matchesOwner(ownership, queryOwner) {
  if (!ownership || !queryOwner) {
    return false;
  }

  if (ownership.ownerType !== queryOwner.ownerType) {
    return false;
  }

  if (queryOwner.ownerType === 'player-character') {
    return (
      ownership.playerId === queryOwner.playerId && ownership.characterId === queryOwner.characterId
    );
  }

  if (queryOwner.ownerType === 'npc-pirate') {
    return ownership.npcId === queryOwner.npcId;
  }

  return true;
}

module.exports = {
  normalizeOwnership,
  matchesOwner,
};
