'use strict';

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

    const player = await Player.findOneAndUpdate(
      playerNameQuery,
      { ...updates, updatedAt: new Date() },
      { returnDocument: 'after' }
    );
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
        $push: { characters: characterData },
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
    Object.assign(character, ctx.normalizeCharacterUpdatesForPersistence(updates));
    player.updatedAt = new Date();
    await player.save();
    return player.toObject();
  } catch (error) {
    ctx.log(`[db-service] Error updating character: ${error.message}`);
    throw error;
  }
}

async function upsertCharacterBust(ctx, Player, playerName, characterId, descriptor) {
  try {
    const playerNameQuery = ctx.buildPlayerNameQuery(playerName);
    if (!playerNameQuery) {
      return null;
    }

    const player = await Player.findOne(playerNameQuery);
    if (!player) {
      return null;
    }

    const characterIndex = player.characters.findIndex((character) => character.id === characterId);
    if (characterIndex < 0) {
      return null;
    }

    player.characters[characterIndex].bust = descriptor;
    player.markModified(`characters.${characterIndex}.bust`);
    player.updatedAt = new Date();
    await player.save();
    return player.toObject();
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
    character.ships.push(shipData);
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
  addShip,
  upsertCharacterBust,
  getCharacterBust,
  addOrUpdateMission,
  getMissions,
  getShips,
};
