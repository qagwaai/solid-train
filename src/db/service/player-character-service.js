'use strict';

const { preserveNavigationPlacements } = require('../../model/navigation-placement');

const { isCanonicalMissionStatus, MISSION_STATUS_VALUES } = require('../../model/mission');

/**
 * Player/character persistence operations used by DatabaseService.
 * Functions return plain objects to keep handler-facing payloads serialization-safe.
 */

/**
 * Create a player document after enforcing case-insensitive uniqueness.
 * @param {Object} ctx
 * @param {Object} Player
 * @param {{ playerId: string, playerName: string, email: string, password: string, preferredLocale?: string }} playerData
 * @returns {Promise<Object>}
 */
async function registerPlayer(ctx, Player, playerData) {
  try {
    const { playerId, playerName, email, password, preferredLocale = 'en' } = playerData;
    const playerNameNormalized = ctx.toNonEmptyString(playerName).toLowerCase();

    const existing = await Player.findOne({ playerNameNormalized });
    if (existing) {
      throw new Error('Player already exists');
    }

    const player = new Player({
      playerId,
      playerName,
      playerNameNormalized,
      email,
      password,
      preferredLocale,
      characters: [],
    });

    await player.save();
    ctx.log(`[db-service] Player registered: ${playerId}`);
    return player.toObject();
  } catch (error) {
    ctx.log(`[db-service] Error registering player: ${error.message}`);
    throw error;
  }
}

/**
 * Lookup by normalized player name with legacy-document backfill.
 * @param {Object} ctx
 * @param {Object} Player
 * @param {string} playerName
 * @returns {Promise<Object|null>}
 */
async function getPlayerByName(ctx, Player, playerName) {
  try {
    const playerNameQuery = ctx.buildPlayerNameQuery(playerName);
    if (!playerNameQuery) {
      return null;
    }

    const normalizedPlayerName = ctx.toNonEmptyString(playerName).toLowerCase();
    const player = await Player.findOne(playerNameQuery);

    if (player && !player.playerNameNormalized && normalizedPlayerName) {
      player.playerNameNormalized = normalizedPlayerName;
      await player.save();
    }

    return player ? player.toObject() : null;
  } catch (error) {
    ctx.log(`[db-service] Error fetching player: ${error.message}`);
    throw error;
  }
}

async function getPlayerById(ctx, Player, playerId) {
  try {
    const player = await Player.findOne({ playerId });
    return player ? player.toObject() : null;
  } catch (error) {
    ctx.log(`[db-service] Error fetching player by ID: ${error.message}`);
    throw error;
  }
}

async function updatePlayer(ctx, Player, playerName, updates) {
  try {
    const playerNameQuery = ctx.buildPlayerNameQuery(playerName);
    if (!playerNameQuery) {
      return null;
    }

    let query = playerNameQuery;
    let write = { ...updates, updatedAt: new Date() };
    if (Array.isArray(updates.characters)) {
      const original = await Player.findOne(playerNameQuery).lean();
      if (!original) throw new Error('Player character replacement target was not found');
      const previous = new Map(original.characters.map((character) => [character.id, character]));
      const { __v: _untrustedVersion, ...fields } = updates;
      query = { ...playerNameQuery, __v: original.__v };
      write = {
        $set: {
          ...fields,
          updatedAt: new Date(),
          characters: updates.characters.map((character) => ({
            ...character,
            ships: preserveNavigationPlacements(
              previous.get(character.id)?.ships,
              character.ships || []
            ),
          })),
        },
        $inc: { __v: 1 },
      };
    }
    const player = await Player.findOneAndUpdate(query, write, { returnDocument: 'after' });
    if (!player && Array.isArray(updates.characters)) {
      throw new Error('Player character replacement conflicted with persisted state');
    }
    return player ? player.toObject() : null;
  } catch (error) {
    ctx.log(`[db-service] Error updating player: ${error.message}`);
    throw error;
  }
}

async function addCharacter(ctx, Player, playerName, characterData) {
  try {
    const playerNameQuery = ctx.buildPlayerNameQuery(playerName);
    if (!playerNameQuery) {
      return null;
    }

    const player = await Player.findOneAndUpdate(
      playerNameQuery,
      {
        $push: {
          characters: {
            ...characterData,
            ships: preserveNavigationPlacements([], characterData.ships || []),
          },
        },
        updatedAt: new Date(),
      },
      { returnDocument: 'after' }
    );
    return player ? player.toObject() : null;
  } catch (error) {
    ctx.log(`[db-service] Error adding character: ${error.message}`);
    throw error;
  }
}

async function getCharacters(ctx, Player, playerName) {
  try {
    const playerNameQuery = ctx.buildPlayerNameQuery(playerName);
    if (!playerNameQuery) {
      return [];
    }

    const player = await Player.findOne(playerNameQuery, { characters: 1 }).lean();
    return player && Array.isArray(player.characters) ? player.characters : [];
  } catch (error) {
    ctx.log(`[db-service] Error fetching characters: ${error.message}`);
    throw error;
  }
}

async function deleteCharacter(ctx, Player, playerName, characterId) {
  try {
    const playerNameQuery = ctx.buildPlayerNameQuery(playerName);
    if (!playerNameQuery) {
      return null;
    }

    const player = await Player.findOneAndUpdate(
      playerNameQuery,
      {
        $pull: { characters: { id: characterId } },
        updatedAt: new Date(),
      },
      { returnDocument: 'after' }
    );
    return player ? player.toObject() : null;
  } catch (error) {
    ctx.log(`[db-service] Error deleting character: ${error.message}`);
    throw error;
  }
}

async function updateCharacter(ctx, Player, playerName, characterId, updates) {
  try {
    const playerNameQuery = ctx.buildPlayerNameQuery(playerName);
    if (!playerNameQuery) {
      return null;
    }

    const player = await Player.findOne(playerNameQuery);

    if (!player) {
      return null;
    }

    const character = player.characters.find((c) => c.id === characterId);
    if (!character) {
      return null;
    }

    // Normalize embedded ship naming before persisting mixed legacy/current payloads.
    const normalized = ctx.normalizeCharacterUpdatesForPersistence(updates);
    if (Array.isArray(normalized.ships)) {
      normalized.ships = preserveNavigationPlacements(character.toObject().ships, normalized.ships);
    }
    Object.assign(character, normalized);
    player.updatedAt = new Date();
    await player.save();
    return player.toObject();
  } catch (error) {
    ctx.log(`[db-service] Error updating character: ${error.message}`);
    throw error;
  }
}

async function commitNavigationPlacement(ctx, Player, playerName, characterId, ship, attestation) {
  const spatial = ship.spatial;
  const owner = ship.ownership;
  const match = {
    id: ship.id,
    'spatial.solarSystemId': spatial.solarSystemId,
    'spatial.frame': spatial.frame,
    'spatial.epochMs': spatial.epochMs,
    'spatial.positionKm.x': spatial.positionKm.x,
    'spatial.positionKm.y': spatial.positionKm.y,
    'spatial.positionKm.z': spatial.positionKm.z,
    'ownership.ownerType': owner.ownerType,
    'ownership.playerId': owner.playerId,
    'ownership.characterId': owner.characterId,
    'ownership.npcId': owner.npcId || null,
    'ownership.factionId': owner.factionId || null,
    navigationPlacement: { $exists: false },
  };
  const result = await Player.findOneAndUpdate(
    {
      ...ctx.buildPlayerNameQuery(playerName),
      characters: {
        $elemMatch: {
          id: characterId,
          ships: { $elemMatch: match },
          creditLedger: { $elemMatch: { type: 'take', referenceId: attestation.transactionId } },
        },
      },
    },
    {
      $inc: { __v: 1 },
      $set: {
        'characters.$[character].ships.$[ship].navigationPlacement': attestation,
        updatedAt: new Date(),
      },
    },
    {
      arrayFilters: [
        { 'character.id': characterId },
        Object.fromEntries(Object.entries(match).map(([key, value]) => [`ship.${key}`, value])),
      ],
      returnDocument: 'after',
      runValidators: true,
    }
  );
  return result ? result.toObject() : null;
}

async function upsertCharacterBust(ctx, Player, playerName, characterId, descriptor) {
  try {
    const playerNameQuery = ctx.buildPlayerNameQuery(playerName);
    if (!playerNameQuery) {
      return null;
    }

    const player = await Player.findOneAndUpdate(
      {
        ...playerNameQuery,
        'characters.id': characterId,
      },
      {
        $set: {
          'characters.$.bust': descriptor,
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after', runValidators: true }
    );
    return player ? player.toObject() : null;
  } catch (error) {
    ctx.log(`[db-service] Error upserting character bust: ${error.message}`);
    throw error;
  }
}

async function getCharacterBust(ctx, Player, playerName, characterId) {
  try {
    const playerNameQuery = ctx.buildPlayerNameQuery(playerName);
    if (!playerNameQuery) {
      return null;
    }

    const player = await Player.findOne(playerNameQuery, { characters: 1 }).lean();
    if (!player || !Array.isArray(player.characters)) {
      return null;
    }

    const character = player.characters.find((entry) => entry.id === characterId);
    return character?.bust || null;
  } catch (error) {
    ctx.log(`[db-service] Error fetching character bust: ${error.message}`);
    throw error;
  }
}

async function addShip(ctx, Player, playerName, characterId, shipData) {
  try {
    const playerNameQuery = ctx.buildPlayerNameQuery(playerName);
    if (!playerNameQuery) {
      return null;
    }

    const player = await Player.findOne(playerNameQuery);

    if (!player) {
      return null;
    }

    const character = player.characters.find((c) => c.id === characterId);
    if (!character) {
      return null;
    }

    if (!character.ships) {
      character.ships = [];
    }
    character.ships.push(preserveNavigationPlacements([], [shipData])[0]);
    player.updatedAt = new Date();
    await player.save();
    return player.toObject();
  } catch (error) {
    ctx.log(`[db-service] Error adding ship: ${error.message}`);
    throw error;
  }
}

async function addOrUpdateMission(ctx, Player, playerName, characterId, missionData) {
  try {
    const status = ctx.toNonEmptyString(missionData?.status);
    if (!isCanonicalMissionStatus(status)) {
      throw new Error(
        `Mission persistence rejected unsupported status: ${status || '(empty)'}. Allowed values: ${MISSION_STATUS_VALUES.join(', ')}`
      );
    }

    const playerNameQuery = ctx.buildPlayerNameQuery(playerName);
    if (!playerNameQuery) {
      return null;
    }

    const player = await Player.findOne(playerNameQuery);

    if (!player) {
      return null;
    }

    const character = player.characters.find((c) => c.id === characterId);
    if (!character) {
      return null;
    }

    if (!Array.isArray(character.missions)) {
      character.missions = [];
    }

    const missionIndex = character.missions.findIndex(
      (mission) => mission.missionId === missionData.missionId
    );

    if (missionIndex >= 0) {
      character.missions[missionIndex] = missionData;
      player.markModified(`characters.${player.characters.indexOf(character)}.missions`);
    } else {
      character.missions.push(missionData);
    }

    player.updatedAt = new Date();
    await player.save();
    return player.toObject();
  } catch (error) {
    ctx.log(`[db-service] Error adding/updating mission: ${error.message}`);
    throw error;
  }
}

async function getMissions(ctx, Player, playerName, characterId) {
  try {
    const playerNameQuery = ctx.buildPlayerNameQuery(playerName);
    if (!playerNameQuery) {
      return [];
    }

    const player = await Player.findOne(playerNameQuery);

    if (!player) {
      return [];
    }

    const character = player.characters.find((c) => c.id === characterId);
    if (!character || !Array.isArray(character.missions)) {
      return [];
    }

    return character.missions;
  } catch (error) {
    ctx.log(`[db-service] Error fetching missions: ${error.message}`);
    throw error;
  }
}

async function getShips(ctx, Player, playerName, characterId) {
  try {
    const playerNameQuery = ctx.buildPlayerNameQuery(playerName);
    if (!playerNameQuery) {
      return [];
    }

    const player = await Player.findOne(playerNameQuery);

    if (!player) {
      return [];
    }

    const character = player.characters.find((c) => c.id === characterId);
    return character && character.ships ? character.ships : [];
  } catch (error) {
    ctx.log(`[db-service] Error fetching ships: ${error.message}`);
    throw error;
  }
}

module.exports = {
  registerPlayer,
  getPlayerByName,
  getPlayerById,
  updatePlayer,
  addCharacter,
  getCharacters,
  deleteCharacter,
  updateCharacter,
  commitNavigationPlacement,
  addShip,
  upsertCharacterBust,
  getCharacterBust,
  addOrUpdateMission,
  getMissions,
  getShips,
};
