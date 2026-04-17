'use strict';

const { GameState } = require('../model/game');

class MessageHandlerContext {
  constructor(options = {}) {
    this.registeredPlayers = options.registeredPlayers || new Map();
    this.charactersByPlayer = options.charactersByPlayer || new Map();
    this.game = options.game || new GameState();
    this.log = options.log || ((line) => process.stdout.write(`${line}\n`));
    this.createId = options.createId || (() => {
      throw new Error('createId is required');
    });
    this.getCurrentTimestamp =
      options.getCurrentTimestamp || (() => new Date().toISOString());
  }

  toNonEmptyString(value) {
    if (typeof value !== 'string') {
      return '';
    }

    return value.trim();
  }

  normalizePlayerName(value) {
    const playerName = this.toNonEmptyString(value);

    if (!playerName) {
      return '';
    }

    return playerName.toLowerCase();
  }

  getPlayer(playerName) {
    const normalizedPlayerName = this.normalizePlayerName(playerName);

    if (!normalizedPlayerName) {
      return null;
    }

    return this.registeredPlayers.get(normalizedPlayerName) || null;
  }

  getCharacters(normalizedPlayerName) {
    return this.charactersByPlayer.get(normalizedPlayerName) || [];
  }

  setCharacters(normalizedPlayerName, characters) {
    this.charactersByPlayer.set(normalizedPlayerName, characters);
  }

  hasValidSession(payload) {
    const player = this.getPlayer(payload?.playerName);
    const sessionKey = this.toNonEmptyString(payload?.sessionKey);

    if (!player || !sessionKey || !player.sessionKey) {
      return false;
    }

    return player.sessionKey === sessionKey;
  }

  logHandlerMessage(messageType, payload) {
    const player = this.toNonEmptyString(payload?.playerName) || '-';
    const character =
      this.toNonEmptyString(payload?.characterId) ||
      this.toNonEmptyString(payload?.characterName) ||
      '-';
    const sessionId = this.toNonEmptyString(payload?.sessionKey) || '-';

    this.log(
      `[handler] messageType=${messageType} player=${player} character=${character} sessionId=${sessionId}`
    );
  }

  findCharacter(playerName, characterId) {
    const normalizedPlayerName = this.normalizePlayerName(playerName);
    const normalizedCharacterId = this.toNonEmptyString(characterId);

    if (!normalizedPlayerName || !normalizedCharacterId) {
      return null;
    }

    const characters = this.getCharacters(normalizedPlayerName);
    return characters.find((character) => character.id === normalizedCharacterId) || null;
  }

  joinCharacterToGame(playerName, character) {
    const normalizedPlayerName = this.normalizePlayerName(playerName);
    if (!normalizedPlayerName || !character) {
      return null;
    }

    const now = this.getCurrentTimestamp();
    const participant = this.game.joinCharacter({
      playerName,
      normalizedPlayerName,
      characterId: character.id,
      characterName: character.characterName,
      timestamp: now
    });

    character.inGame = true;
    character.gameJoinedAt = participant.joinedAt;
    character.gameLastMessageReceivedAt = participant.lastMessageReceivedAt;

    return participant;
  }

  touchJoinedCharacters(payload) {
    const normalizedPlayerName = this.normalizePlayerName(payload?.playerName);
    if (!normalizedPlayerName) {
      return [];
    }

    const now = this.getCurrentTimestamp();
    const characterId = this.toNonEmptyString(payload?.characterId);
    const touched = this.game.touchParticipants({
      normalizedPlayerName,
      characterId: characterId || '',
      timestamp: now
    });

    for (const participant of touched) {
      const character = this.findCharacter(
        participant.normalizedPlayerName,
        participant.characterId
      );

      if (!character) {
        continue;
      }

      character.inGame = true;
      character.gameJoinedAt = participant.joinedAt;
      character.gameLastMessageReceivedAt = participant.lastMessageReceivedAt;
    }

    return touched;
  }

  renameJoinedCharacter(playerName, characterId, characterName) {
    const normalizedPlayerName = this.normalizePlayerName(playerName);
    const normalizedCharacterId = this.toNonEmptyString(characterId);
    const normalizedCharacterName = this.toNonEmptyString(characterName);

    if (!normalizedPlayerName || !normalizedCharacterId || !normalizedCharacterName) {
      return null;
    }

    return this.game.updateCharacterName({
      normalizedPlayerName,
      characterId: normalizedCharacterId,
      characterName: normalizedCharacterName
    });
  }

  detachCharacterFromGame(playerName, characterId) {
    const normalizedPlayerName = this.normalizePlayerName(playerName);
    const normalizedCharacterId = this.toNonEmptyString(characterId);

    if (!normalizedPlayerName || !normalizedCharacterId) {
      return null;
    }

    const detached = this.game.detachCharacter({
      normalizedPlayerName,
      characterId: normalizedCharacterId
    });

    const character = this.findCharacter(normalizedPlayerName, normalizedCharacterId);
    if (character) {
      character.inGame = false;
      character.gameJoinedAt = null;
      character.gameLastMessageReceivedAt = null;
    }

    return detached;
  }

  detachIdleGameCharacters() {
    const now = this.getCurrentTimestamp();
    const detached = this.game.detachIdleCharacters(now);

    for (const participant of detached) {
      const character = this.findCharacter(
        participant.normalizedPlayerName,
        participant.characterId
      );

      if (!character) {
        continue;
      }

      character.inGame = false;
      character.gameJoinedAt = null;
      character.gameLastMessageReceivedAt = null;
    }

    return detached;
  }
}

module.exports = {
  MessageHandlerContext
};