'use strict';

const persistenceBridge = require('./persistence-bridge');

function getPlayer(ctx, playerName) {
  const normalizedPlayerName = ctx.normalizePlayerName(playerName);

  if (!normalizedPlayerName) {
    return null;
  }

  return ctx.registeredPlayers.get(normalizedPlayerName) || null;
}

function cachePlayer(ctx, playerData) {
  if (!playerData || !playerData.playerName) {
    return null;
  }

  const normalizedPlayerName = ctx.normalizePlayerName(playerData.playerName);
  if (!normalizedPlayerName) {
    return null;
  }

  const existing = ctx.registeredPlayers.get(normalizedPlayerName) || {};
  const merged = {
    ...existing,
    ...playerData,
    sessionKey: playerData.sessionKey ?? existing.sessionKey ?? null,
    socketId: playerData.socketId ?? existing.socketId ?? null,
    preferredLocale: ctx.normalizeLocale(playerData.preferredLocale ?? existing.preferredLocale),
  };

  ctx.registeredPlayers.set(normalizedPlayerName, merged);
  return merged;
}

function getCharacters(ctx, normalizedPlayerName) {
  return ctx.charactersByPlayer.get(normalizedPlayerName) || [];
}

function setCharacters(ctx, normalizedPlayerName, characters) {
  ctx.charactersByPlayer.set(normalizedPlayerName, characters);
}

function cacheCharacters(ctx, playerName, characters) {
  const normalizedPlayerName = ctx.normalizePlayerName(playerName);
  if (!normalizedPlayerName) {
    return [];
  }

  const clonedCharacters = Array.isArray(characters)
    ? characters.map((character) => ctx.normalizeCharacter(character))
    : [];

  setCharacters(ctx, normalizedPlayerName, clonedCharacters);
  return clonedCharacters;
}

function hasValidSession(ctx, payload) {
  const player = getPlayer(ctx, payload?.playerName);
  const sessionKey = ctx.toNonEmptyString(payload?.sessionKey);

  if (!player || !sessionKey || !player.sessionKey) {
    return false;
  }

  return player.sessionKey === sessionKey;
}

async function ensurePlayerLoadedAsync(ctx, playerName) {
  return persistenceBridge.ensurePlayerLoadedAsync(ctx, playerName);
}

async function hasValidSessionAsync(ctx, payload) {
  return persistenceBridge.hasValidSessionAsync(ctx, payload);
}

async function getPlayerAsync(ctx, playerName) {
  return persistenceBridge.getPlayerAsync(ctx, playerName);
}

async function getCharactersAsync(ctx, playerName) {
  return persistenceBridge.getCharactersAsync(ctx, playerName);
}

async function registerPlayerAsync(ctx, playerData) {
  return persistenceBridge.registerPlayerAsync(ctx, playerData);
}

async function updatePlayerAsync(ctx, playerName, updates) {
  return persistenceBridge.updatePlayerAsync(ctx, playerName, updates);
}

async function addCharacterAsync(ctx, playerName, characterData) {
  return persistenceBridge.addCharacterAsync(ctx, playerName, characterData);
}

async function deleteCharacterAsync(ctx, playerName, characterId) {
  return persistenceBridge.deleteCharacterAsync(ctx, playerName, characterId);
}

async function updateCharacterAsync(ctx, playerName, characterId, updates, options = {}) {
  return persistenceBridge.updateCharacterAsync(ctx, playerName, characterId, updates, options);
}

async function addShipAsync(ctx, playerName, characterId, shipData) {
  return persistenceBridge.addShipAsync(ctx, playerName, characterId, shipData);
}

async function addOrUpdateMissionAsync(ctx, playerName, characterId, missionData) {
  return persistenceBridge.addOrUpdateMissionAsync(ctx, playerName, characterId, missionData);
}

async function getMissionsAsync(ctx, playerName, characterId) {
  return persistenceBridge.getMissionsAsync(ctx, playerName, characterId);
}

module.exports = {
  getPlayer,
  cachePlayer,
  getCharacters,
  setCharacters,
  cacheCharacters,
  hasValidSession,
  ensurePlayerLoadedAsync,
  hasValidSessionAsync,
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
};
