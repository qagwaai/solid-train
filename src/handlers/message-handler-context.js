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

  cachePlayer(playerData) {
    if (!playerData || !playerData.playerName) {
      return null;
    }

    const normalizedPlayerName = this.normalizePlayerName(playerData.playerName);
    if (!normalizedPlayerName) {
      return null;
    }

    const existing = this.registeredPlayers.get(normalizedPlayerName) || {};
    const merged = {
      ...existing,
      ...playerData,
      sessionKey: playerData.sessionKey ?? existing.sessionKey ?? null,
      socketId: playerData.socketId ?? existing.socketId ?? null
    };

    this.registeredPlayers.set(normalizedPlayerName, merged);
    return merged;
  }

  getCharacters(normalizedPlayerName) {
    return this.charactersByPlayer.get(normalizedPlayerName) || [];
  }

  setCharacters(normalizedPlayerName, characters) {
    this.charactersByPlayer.set(normalizedPlayerName, characters);
  }

  toPlainObject(value) {
    if (value && typeof value.toObject === 'function') {
      return value.toObject();
    }

    return value;
  }

  normalizeDrone(drone) {
    const source = this.toPlainObject(drone) || {};
    const droneName = this.toNonEmptyString(source.droneName) || this.toNonEmptyString(source.name);

    return {
      ...source,
      droneName: droneName || source.droneName || source.name || ''
    };
  }

  normalizeCharacter(character) {
    const source = this.toPlainObject(character) || {};
    const characterName =
      this.toNonEmptyString(source.characterName) || this.toNonEmptyString(source.name);
    const drones = Array.isArray(source.drones)
      ? source.drones.map((drone) => this.normalizeDrone(drone))
      : [];
    const missions = Array.isArray(source.missions)
      ? source.missions.map((mission) => this.normalizeMission(mission))
      : [];

    return {
      ...source,
      characterName: characterName || source.characterName || source.name || '',
      drones,
      missions
    };
  }

  normalizeMission(mission) {
    const source = this.toPlainObject(mission) || {};

    return {
      ...source,
      missionId: this.toNonEmptyString(source.missionId),
      status: this.toNonEmptyString(source.status)
    };
  }

  cacheCharacters(playerName, characters) {
    const normalizedPlayerName = this.normalizePlayerName(playerName);
    if (!normalizedPlayerName) {
      return [];
    }

    const clonedCharacters = Array.isArray(characters)
      ? characters.map((character) => this.normalizeCharacter(character))
      : [];

    this.setCharacters(normalizedPlayerName, clonedCharacters);
    return clonedCharacters;
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
        const player = await this.databaseService.getPlayerByName(playerName);
        if (player) {
          this.cachePlayer(player);
        }
        return player;
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
        const characters = await this.databaseService.getCharacters(playerName);
        return this.cacheCharacters(playerName, characters);
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

  async addOrUpdateMissionAsync(playerName, characterId, missionData) {
    if (this.databaseService) {
      try {
        await this.databaseService.addOrUpdateMission(playerName, characterId, missionData);
      } catch (error) {
        this.log(`[context] Error adding/updating mission in DB: ${error.message}`);
        throw error;
      }
    }

    const character = this.findCharacter(playerName, characterId);
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
      // Update existing mission by index
      character.missions[missionIndex] = missionData;
    } else {
      // Add new mission
      character.missions.push(missionData);
    }
  }

  async getMissionsAsync(playerName, characterId) {
    if (this.databaseService) {
      try {
        const missions = await this.databaseService.getMissions(playerName, characterId);
        const character = this.findCharacter(playerName, characterId);
        const normalizedMissions = Array.isArray(missions)
          ? missions.map((mission) => this.normalizeMission(mission))
          : [];

        if (character) {
          character.missions = normalizedMissions;
        }

        return normalizedMissions;
      } catch (error) {
        this.log(`[context] Error fetching missions from DB: ${error.message}`);
      }
    }

    const character = this.findCharacter(playerName, characterId);
    if (!character || !Array.isArray(character.missions)) {
      return [];
    }

    return character.missions.map((mission) => this.normalizeMission(mission));
  }
}

module.exports = {
  MessageHandlerContext
};