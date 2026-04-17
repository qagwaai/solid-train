'use strict';

class MessageHandlerContext {
  constructor(options = {}) {
    this.registeredPlayers = options.registeredPlayers || new Map();
    this.charactersByPlayer = options.charactersByPlayer || new Map();
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
}

module.exports = {
  MessageHandlerContext
};