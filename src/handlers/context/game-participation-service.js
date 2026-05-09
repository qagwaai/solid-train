'use strict';

function findCharacter(ctx, playerName, characterId) {
  const normalizedPlayerName = ctx.normalizePlayerName(playerName);
  const normalizedCharacterId = ctx.toNonEmptyString(characterId);

  if (!normalizedPlayerName || !normalizedCharacterId) {
    return null;
  }

  const characters = ctx.getCharacters(normalizedPlayerName);
  return characters.find((character) => character.id === normalizedCharacterId) || null;
}

function joinCharacterToGame(ctx, playerName, character) {
  const normalizedPlayerName = ctx.normalizePlayerName(playerName);
  if (!normalizedPlayerName || !character) {
    return null;
  }

  const now = ctx.getCurrentTimestamp();
  const participant = ctx.game.joinCharacter({
    playerName,
    normalizedPlayerName,
    characterId: character.id,
    characterName: character.characterName,
    timestamp: now,
  });

  character.inGame = true;
  character.gameJoinedAt = participant.joinedAt;
  character.gameLastMessageReceivedAt = participant.lastMessageReceivedAt;

  return participant;
}

function touchJoinedCharacters(ctx, payload) {
  const normalizedPlayerName = ctx.normalizePlayerName(payload?.playerName);
  if (!normalizedPlayerName) {
    return [];
  }

  const now = ctx.getCurrentTimestamp();
  const characterId = ctx.toNonEmptyString(payload?.characterId);
  const touched = ctx.game.touchParticipants({
    normalizedPlayerName,
    characterId: characterId || '',
    timestamp: now,
  });

  for (const participant of touched) {
    const character = findCharacter(ctx, participant.normalizedPlayerName, participant.characterId);

    if (!character) {
      continue;
    }

    character.inGame = true;
    character.gameJoinedAt = participant.joinedAt;
    character.gameLastMessageReceivedAt = participant.lastMessageReceivedAt;
  }

  return touched;
}

function renameJoinedCharacter(ctx, playerName, characterId, characterName) {
  const normalizedPlayerName = ctx.normalizePlayerName(playerName);
  const normalizedCharacterId = ctx.toNonEmptyString(characterId);
  const normalizedCharacterName = ctx.toNonEmptyString(characterName);

  if (!normalizedPlayerName || !normalizedCharacterId || !normalizedCharacterName) {
    return null;
  }

  return ctx.game.updateCharacterName({
    normalizedPlayerName,
    characterId: normalizedCharacterId,
    characterName: normalizedCharacterName,
  });
}

function detachCharacterFromGame(ctx, playerName, characterId) {
  const normalizedPlayerName = ctx.normalizePlayerName(playerName);
  const normalizedCharacterId = ctx.toNonEmptyString(characterId);

  if (!normalizedPlayerName || !normalizedCharacterId) {
    return null;
  }

  const detached = ctx.game.detachCharacter({
    normalizedPlayerName,
    characterId: normalizedCharacterId,
  });

  const character = findCharacter(ctx, normalizedPlayerName, normalizedCharacterId);
  if (character) {
    character.inGame = false;
    character.gameJoinedAt = null;
    character.gameLastMessageReceivedAt = null;
  }

  return detached;
}

function detachIdleGameCharacters(ctx) {
  const now = ctx.getCurrentTimestamp();
  const detached = ctx.game.detachIdleCharacters(now);

  for (const participant of detached) {
    const character = findCharacter(ctx, participant.normalizedPlayerName, participant.characterId);

    if (!character) {
      continue;
    }

    character.inGame = false;
    character.gameJoinedAt = null;
    character.gameLastMessageReceivedAt = null;
  }

  return detached;
}

module.exports = {
  findCharacter,
  joinCharacterToGame,
  touchJoinedCharacters,
  renameJoinedCharacter,
  detachCharacterFromGame,
  detachIdleGameCharacters,
};
