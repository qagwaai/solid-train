'use strict';

async function getPlayerAsync(ctx, playerName) {
  if (ctx.databaseService) {
    try {
      const player = await ctx.databaseService.getPlayerByName(playerName);
      if (player) {
        ctx.cachePlayer(player);
      }
      return player;
    } catch (error) {
      ctx.log(`[context] Error fetching player from DB: ${error.message}`);
      return null;
    }
  }
  return ctx.getPlayer(playerName);
}

async function getCharactersAsync(ctx, playerName) {
  if (ctx.databaseService) {
    try {
      const characters = await ctx.databaseService.getCharacters(playerName);
      return ctx.cacheCharacters(playerName, characters);
    } catch (error) {
      ctx.log(`[context] Error fetching characters from DB: ${error.message}`);
      return [];
    }
  }
  const normalizedPlayerName = ctx.normalizePlayerName(playerName);
  return ctx.getCharacters(normalizedPlayerName);
}

async function registerPlayerAsync(ctx, playerData) {
  if (ctx.databaseService) {
    try {
      const result = await ctx.databaseService.registerPlayer(playerData);
      const normalizedPlayerName = playerData.playerName.toLowerCase();
      ctx.registeredPlayers.set(normalizedPlayerName, {
        ...playerData,
        sessionKey: null,
        socketId: null
      });
      ctx.charactersByPlayer.set(normalizedPlayerName, []);
      return result;
    } catch (error) {
      ctx.log(`[context] Error registering player in DB: ${error.message}`);
      throw error;
    }
  }

  const normalizedPlayerName = playerData.playerName.toLowerCase();
  ctx.registeredPlayers.set(normalizedPlayerName, {
    ...playerData,
    sessionKey: null,
    socketId: null
  });
  ctx.charactersByPlayer.set(normalizedPlayerName, []);
  return playerData;
}

async function updatePlayerAsync(ctx, playerName, updates) {
  if (ctx.databaseService) {
    try {
      await ctx.databaseService.updatePlayer(playerName, updates);
    } catch (error) {
      ctx.log(`[context] Error updating player in DB: ${error.message}`);
      throw error;
    }
  }

  const player = ctx.getPlayer(playerName);
  if (player) {
    Object.assign(player, updates);
  }
}

async function addCharacterAsync(ctx, playerName, characterData) {
  if (ctx.databaseService) {
    try {
      await ctx.databaseService.addCharacter(playerName, characterData);
    } catch (error) {
      ctx.log(`[context] Error adding character in DB: ${error.message}`);
      throw error;
    }
  }

  const normalizedPlayerName = ctx.normalizePlayerName(playerName);
  const characters = ctx.getCharacters(normalizedPlayerName);
  characters.push(ctx.normalizeCharacter(characterData));
  ctx.setCharacters(normalizedPlayerName, characters);
}

async function deleteCharacterAsync(ctx, playerName, characterId) {
  if (ctx.databaseService) {
    try {
      await ctx.databaseService.deleteCharacter(playerName, characterId);
    } catch (error) {
      ctx.log(`[context] Error deleting character in DB: ${error.message}`);
      throw error;
    }
  }

  const normalizedPlayerName = ctx.normalizePlayerName(playerName);
  const characters = ctx.getCharacters(normalizedPlayerName);
  const filtered = characters.filter((c) => c.id !== characterId);
  ctx.setCharacters(normalizedPlayerName, filtered);
}

async function updateCharacterAsync(ctx, playerName, characterId, updates) {
  if (ctx.databaseService) {
    try {
      await ctx.databaseService.updateCharacter(playerName, characterId, updates);
    } catch (error) {
      ctx.log(`[context] Error updating character in DB: ${error.message}`);
      throw error;
    }
  }

  const character = ctx.findCharacter(playerName, characterId);
  if (character) {
    Object.assign(character, updates);
  }
}

async function addShipAsync(ctx, playerName, characterId, shipData) {
  if (ctx.databaseService) {
    try {
      await ctx.databaseService.addShip(playerName, characterId, shipData);
    } catch (error) {
      ctx.log(`[context] Error adding ship in DB: ${error.message}`);
      throw error;
    }
  }

  const character = ctx.findCharacter(playerName, characterId);
  if (character) {
    if (!character.ships) {
      character.ships = [];
    }
    character.ships.push(shipData);
  }
}

async function addOrUpdateMissionAsync(ctx, playerName, characterId, missionData) {
  if (ctx.databaseService) {
    try {
      await ctx.databaseService.addOrUpdateMission(playerName, characterId, missionData);
    } catch (error) {
      ctx.log(`[context] Error adding/updating mission in DB: ${error.message}`);
      throw error;
    }
  }

  const character = ctx.findCharacter(playerName, characterId);
  if (!character) {
    return;
  }

  if (!Array.isArray(character.missions)) {
    character.missions = [];
  }

  const missionIndex = character.missions.findIndex(
    (mission) => mission.missionId === missionData.missionId
  );
  if (missionIndex >= 0) {
    character.missions[missionIndex] = missionData;
  } else {
    character.missions.push(missionData);
  }
}

async function getMissionsAsync(ctx, playerName, characterId) {
  if (ctx.databaseService) {
    try {
      const missions = await ctx.databaseService.getMissions(playerName, characterId);
      const character = ctx.findCharacter(playerName, characterId);
      const normalizedMissions = Array.isArray(missions)
        ? missions.map((mission) => ctx.normalizeMission(mission))
        : [];

      if (character) {
        character.missions = normalizedMissions;
      }

      return normalizedMissions;
    } catch (error) {
      ctx.log(`[context] Error fetching missions from DB: ${error.message}`);
    }
  }

  const character = ctx.findCharacter(playerName, characterId);
  if (!character || !Array.isArray(character.missions)) {
    return [];
  }

  return character.missions.map((mission) => ctx.normalizeMission(mission));
}

async function ensurePlayerLoadedAsync(ctx, playerName) {
  const normalizedPlayerName = ctx.normalizePlayerName(playerName);
  if (!normalizedPlayerName) {
    return null;
  }

  let player = ctx.getPlayer(normalizedPlayerName);
  if (player || !ctx.databaseService) {
    return player;
  }

  await getPlayerAsync(ctx, normalizedPlayerName);
  player = ctx.getPlayer(normalizedPlayerName);
  return player;
}

async function hasValidSessionAsync(ctx, payload) {
  const sessionKey = ctx.toNonEmptyString(payload?.sessionKey);
  if (!sessionKey) {
    return false;
  }

  const player = await ensurePlayerLoadedAsync(ctx, payload?.playerName);
  if (!player || !player.sessionKey) {
    return false;
  }

  return player.sessionKey === sessionKey;
}

module.exports = {
  getPlayerAsync,
  getCharactersAsync,
  registerPlayerAsync,
  updatePlayerAsync,
  addCharacterAsync,
  deleteCharacterAsync,
  updateCharacterAsync,
  addShipAsync,
  addOrUpdateMissionAsync,
  getMissionsAsync,
  ensurePlayerLoadedAsync,
  hasValidSessionAsync
};
