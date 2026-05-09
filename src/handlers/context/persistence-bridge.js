'use strict';

/**
 * Resolve player from DB when available, then hydrate in-memory cache.
 * @param {Object} ctx
 * @param {string} playerName
 * @returns {Promise<Object|null>}
 */
async function getPlayerAsync(ctx, playerName) {
  const player = await ctx.withDbOrNull('fetching player from DB', (databaseService) =>
    databaseService.getPlayerByName(playerName)
  );
  if (player) {
    ctx.cachePlayer(player);
    return player;
  }
  return ctx.getPlayer(playerName);
}

/**
 * Resolve characters with DB-first semantics and update cache when found.
 * @param {Object} ctx
 * @param {string} playerName
 * @returns {Promise<Object[]>}
 */
async function getCharactersAsync(ctx, playerName) {
  const characters = await ctx.withDbOrNull('fetching characters from DB', (databaseService) =>
    databaseService.getCharacters(playerName)
  );
  if (Array.isArray(characters)) {
    return ctx.cacheCharacters(playerName, characters);
  }
  const normalizedPlayerName = ctx.normalizePlayerName(playerName);
  return ctx.getCharacters(normalizedPlayerName);
}

async function registerPlayerAsync(ctx, playerData) {
  const result = await ctx.withDb('registering player in DB', (databaseService) =>
    databaseService.registerPlayer(playerData)
  );

  const normalizedPlayerName = playerData.playerName.toLowerCase();
  ctx.registeredPlayers.set(normalizedPlayerName, {
    ...playerData,
    sessionKey: null,
    socketId: null,
  });
  ctx.charactersByPlayer.set(normalizedPlayerName, []);
  return result || playerData;
}

async function updatePlayerAsync(ctx, playerName, updates) {
  await ctx.withDb('updating player in DB', (databaseService) =>
    databaseService.updatePlayer(playerName, updates)
  );

  const player = ctx.getPlayer(playerName);
  if (player) {
    Object.assign(player, updates);
  }
}

async function addCharacterAsync(ctx, playerName, characterData) {
  await ctx.withDb('adding character in DB', (databaseService) =>
    databaseService.addCharacter(playerName, characterData)
  );

  const normalizedPlayerName = ctx.normalizePlayerName(playerName);
  const characters = ctx.getCharacters(normalizedPlayerName);
  characters.push(ctx.normalizeCharacter(characterData));
  ctx.setCharacters(normalizedPlayerName, characters);
}

async function deleteCharacterAsync(ctx, playerName, characterId) {
  await ctx.withDb('deleting character in DB', (databaseService) =>
    databaseService.deleteCharacter(playerName, characterId)
  );

  const normalizedPlayerName = ctx.normalizePlayerName(playerName);
  const characters = ctx.getCharacters(normalizedPlayerName);
  const filtered = characters.filter((c) => c.id !== characterId);
  ctx.setCharacters(normalizedPlayerName, filtered);
}

async function updateCharacterAsync(ctx, playerName, characterId, updates) {
  await ctx.withDb('updating character in DB', (databaseService) =>
    databaseService.updateCharacter(playerName, characterId, updates)
  );

  const character = ctx.findCharacter(playerName, characterId);
  if (character) {
    Object.assign(character, updates);
  }
}

async function addShipAsync(ctx, playerName, characterId, shipData) {
  await ctx.withDb('adding ship in DB', (databaseService) =>
    databaseService.addShip(playerName, characterId, shipData)
  );

  const character = ctx.findCharacter(playerName, characterId);
  if (character) {
    if (!character.ships) {
      character.ships = [];
    }
    character.ships.push(shipData);
  }
}

async function addOrUpdateMissionAsync(ctx, playerName, characterId, missionData) {
  await ctx.withDb('adding/updating mission in DB', (databaseService) =>
    databaseService.addOrUpdateMission(playerName, characterId, missionData)
  );

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
  const missions = await ctx.withDbOrNull('fetching missions from DB', (databaseService) =>
    databaseService.getMissions(playerName, characterId)
  );

  if (Array.isArray(missions)) {
    const character = ctx.findCharacter(playerName, characterId);
    const normalizedMissions = missions.map((mission) => ctx.normalizeMission(mission));

    if (character) {
      character.missions = normalizedMissions;
    }

    return normalizedMissions;
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

/**
 * Session validation helper used by handlers to enforce authenticated operations.
 * @param {Object} ctx
 * @param {Object} payload
 * @returns {Promise<boolean>}
 */
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
  hasValidSessionAsync,
};
