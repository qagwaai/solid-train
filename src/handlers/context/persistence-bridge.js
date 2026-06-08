'use strict';

const { isCanonicalMissionStatus, MISSION_STATUS_VALUES } = require('../../model/mission');

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

async function updateCharacterAsync(ctx, playerName, characterId, updates, options = {}) {
  const isVersionConflict = (error) => {
    const message = ctx.toNonEmptyString(error?.message).toLowerCase();
    return message.includes('no matching document found') && message.includes('version');
  };
  const correlationId = ctx.toNonEmptyString(options?.correlationId) || '-';

  let attemptsUsed = 0;
  let attemptsRemaining = 2;
  while (attemptsRemaining > 0) {
    attemptsUsed += 1;
    try {
      await ctx.withDb('updating character in DB', (databaseService) =>
        databaseService.updateCharacter(playerName, characterId, updates)
      );

      if (attemptsUsed > 1) {
        ctx.log(
          `[concurrency] update-character-recovered correlationId=${correlationId} player=${ctx.toNonEmptyString(playerName) || '-'} characterId=${ctx.toNonEmptyString(characterId) || '-'} attempts=${attemptsUsed}`,
          { level: 'error' }
        );
      }
      break;
    } catch (error) {
      attemptsRemaining -= 1;
      if (attemptsRemaining > 0 && isVersionConflict(error)) {
        ctx.log(
          `[concurrency] update-character-conflict correlationId=${correlationId} player=${ctx.toNonEmptyString(playerName) || '-'} characterId=${ctx.toNonEmptyString(characterId) || '-'} action=retry attemptsUsed=${attemptsUsed} error=${error.message}`,
          { level: 'error' }
        );
        continue;
      }

      if (isVersionConflict(error)) {
        ctx.log(
          `[concurrency] update-character-conflict correlationId=${correlationId} player=${ctx.toNonEmptyString(playerName) || '-'} characterId=${ctx.toNonEmptyString(characterId) || '-'} action=fail attemptsUsed=${attemptsUsed} error=${error.message}`,
          { level: 'error' }
        );
      }
      throw error;
    }
  }

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

async function updateCharacterBustAsync(ctx, playerName, characterId, descriptor) {
  await ctx.withDb('updating character bust in DB', (databaseService) =>
    databaseService.upsertCharacterBust(playerName, characterId, descriptor)
  );

  const character = ctx.findCharacter(playerName, characterId);
  if (character) {
    character.bust = descriptor;
  }
}

async function getCharacterBustAsync(ctx, playerName, characterId) {
  const descriptor = await ctx.withDbOrNull('fetching character bust from DB', (databaseService) =>
    databaseService.getCharacterBust(playerName, characterId)
  );

  if (descriptor) {
    const character = ctx.findCharacter(playerName, characterId);
    if (character) {
      character.bust = descriptor;
    }
    return descriptor;
  }

  const character = ctx.findCharacter(playerName, characterId);
  return character?.bust || null;
}

async function upsertNpcBustAsync(ctx, npcId, deterministicSeed, descriptor, appliedOverrides) {
  await ctx.withDb('upserting NPC bust in DB', (databaseService) =>
    databaseService.upsertNpcBust(npcId, deterministicSeed, descriptor, appliedOverrides)
  );

  const normalizedNpcId = ctx.toNonEmptyString(npcId);
  if (!normalizedNpcId) {
    return;
  }

  ctx.npcBustsById.set(normalizedNpcId, {
    npcId: normalizedNpcId,
    deterministicSeed,
    descriptor,
    appliedOverrides: Array.isArray(appliedOverrides) ? appliedOverrides : [],
  });
}

async function getNpcBustAsync(ctx, npcId) {
  const record = await ctx.withDbOrNull('fetching NPC bust from DB', (databaseService) =>
    databaseService.getNpcBust(npcId)
  );

  if (record) {
    const normalizedNpcId = ctx.toNonEmptyString(record.npcId || npcId);
    if (normalizedNpcId) {
      ctx.npcBustsById.set(normalizedNpcId, {
        npcId: normalizedNpcId,
        deterministicSeed: record.deterministicSeed,
        descriptor: record.descriptor,
        appliedOverrides: Array.isArray(record.appliedOverrides) ? record.appliedOverrides : [],
      });
    }

    return {
      npcId: normalizedNpcId,
      deterministicSeed: record.deterministicSeed,
      descriptor: record.descriptor,
      appliedOverrides: Array.isArray(record.appliedOverrides) ? record.appliedOverrides : [],
    };
  }

  const normalizedNpcId = ctx.toNonEmptyString(npcId);
  if (!normalizedNpcId) {
    return null;
  }

  return ctx.npcBustsById.get(normalizedNpcId) || null;
}

async function addOrUpdateMissionAsync(ctx, playerName, characterId, missionData) {
  const status = ctx.toNonEmptyString(missionData?.status);
  if (!isCanonicalMissionStatus(status)) {
    throw new Error(
      `Mission persistence rejected unsupported status: ${status || '(empty)'}. Allowed values: ${MISSION_STATUS_VALUES.join(', ')}`
    );
  }

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
  updateCharacterBustAsync,
  getCharacterBustAsync,
  upsertNpcBustAsync,
  getNpcBustAsync,
  addShipAsync,
  addOrUpdateMissionAsync,
  getMissionsAsync,
  ensurePlayerLoadedAsync,
  hasValidSessionAsync,
};
