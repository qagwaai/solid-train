'use strict';

const { GameState } = require('../model/game');

class MessageHandlerContext {
  constructor(options = {}) {
    this.registeredPlayers = options.registeredPlayers || new Map();
    this.charactersByPlayer = options.charactersByPlayer || new Map();
    this.databaseService = options.databaseService || null;
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

  /**
   * Async database methods - use MongoDB if available, fall back to in-memory
   */

  async getPlayerAsync(playerName) {
    if (this.databaseService) {
      try {
        return await this.databaseService.getPlayerByName(playerName);
      } catch (error) {
        this.log(`[context] Error fetching player from DB: ${error.message}`);
        return null;
      }
    }
    return this.getPlayer(playerName);
  }

  async getCharactersAsync(playerName) {
    if (this.databaseService) {
      try {
        return await this.databaseService.getCharacters(playerName);
      } catch (error) {
        this.log(`[context] Error fetching characters from DB: ${error.message}`);
        return [];
      }
    }
    const normalizedPlayerName = this.normalizePlayerName(playerName);
    return this.getCharacters(normalizedPlayerName);
  }

  async registerPlayerAsync(playerData) {
    if (this.databaseService) {
      try {
        const result = await this.databaseService.registerPlayer(playerData);
        // Also cache in memory for session tracking
        const normalizedPlayerName = playerData.playerName.toLowerCase();
        this.registeredPlayers.set(normalizedPlayerName, {
          ...playerData,
          sessionKey: null,
          socketId: null
        });
        this.charactersByPlayer.set(normalizedPlayerName, []);
        return result;
      } catch (error) {
        this.log(`[context] Error registering player in DB: ${error.message}`);
        throw error;
      }
    }
    // Fallback: in-memory registration
    const normalizedPlayerName = playerData.playerName.toLowerCase();
    this.registeredPlayers.set(normalizedPlayerName, {
      ...playerData,
      sessionKey: null,
      socketId: null
    });
    this.charactersByPlayer.set(normalizedPlayerName, []);
    return playerData;
  }

  async updatePlayerAsync(playerName, updates) {
    if (this.databaseService) {
      try {
        await this.databaseService.updatePlayer(playerName, updates);
      } catch (error) {
        this.log(`[context] Error updating player in DB: ${error.message}`);
        throw error;
      }
    }
    // Also update in-memory for session tracking
    const player = this.getPlayer(playerName);
    if (player) {
      Object.assign(player, updates);
    }
  }

  async addCharacterAsync(playerName, characterData) {
    if (this.databaseService) {
      try {
        await this.databaseService.addCharacter(playerName, characterData);
      } catch (error) {
        this.log(`[context] Error adding character in DB: ${error.message}`);
        throw error;
      }
    }
    // Also update in-memory
    const normalizedPlayerName = this.normalizePlayerName(playerName);
    const characters = this.getCharacters(normalizedPlayerName);
    characters.push(characterData);
    this.setCharacters(normalizedPlayerName, characters);
  }

  async deleteCharacterAsync(playerName, characterId) {
    if (this.databaseService) {
      try {
        await this.databaseService.deleteCharacter(playerName, characterId);
      } catch (error) {
        this.log(`[context] Error deleting character in DB: ${error.message}`);
        throw error;
      }
    }
    // Also update in-memory
    const normalizedPlayerName = this.normalizePlayerName(playerName);
    const characters = this.getCharacters(normalizedPlayerName);
    const filtered = characters.filter((c) => c.id !== characterId);
    this.setCharacters(normalizedPlayerName, filtered);
  }

  async updateCharacterAsync(playerName, characterId, updates) {
    if (this.databaseService) {
      try {
        await this.databaseService.updateCharacter(playerName, characterId, updates);
      } catch (error) {
        this.log(`[context] Error updating character in DB: ${error.message}`);
        throw error;
      }
    }
    // Also update in-memory
    const character = this.findCharacter(playerName, characterId);
    if (character) {
      Object.assign(character, updates);
    }
  }

  async addDroneAsync(playerName, characterId, droneData) {
    if (this.databaseService) {
      try {
        await this.databaseService.addDrone(playerName, characterId, droneData);
      } catch (error) {
        this.log(`[context] Error adding drone in DB: ${error.message}`);
        throw error;
      }
    }
    // Also update in-memory
    const character = this.findCharacter(playerName, characterId);
    if (character) {
      if (!character.drones) {
        character.drones = [];
      }
      character.drones.push(droneData);
    }
  }
}

module.exports = {
  MessageHandlerContext
};