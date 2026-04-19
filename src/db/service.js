'use strict';

const { Player } = require('./models');

/**
 * Database service layer - provides a clean interface for CRUD operations
 * Bridges between handlers and Mongoose models
 */
class DatabaseService {
  constructor(options = {}) {
    this.useInMemoryFallback = options.useInMemoryFallback || false;
    this.log = options.log || ((line) => process.stdout.write(`${line}\n`));
  }

  /**
   * Register a new player
   * @param {Object} playerData - { playerId, playerName, email, password }
   * @returns {Promise<Object>} Created player document
   */
  async registerPlayer(playerData) {
    try {
      const { playerId, playerName, email, password } = playerData;
      const playerNameNormalized = playerName.toLowerCase();

      // Check if player already exists
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
        characters: []
      });

      await player.save();
      this.log(`[db-service] Player registered: ${playerId}`);
      return player.toObject();
    } catch (error) {
      this.log(`[db-service] Error registering player: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get a player by name (case-insensitive)
   * @param {string} playerName
   * @returns {Promise<Object|null>}
   */
  async getPlayerByName(playerName) {
    try {
      const playerNameNormalized = playerName.toLowerCase();
      const player = await Player.findOne({ playerNameNormalized });
      return player ? player.toObject() : null;
    } catch (error) {
      this.log(`[db-service] Error fetching player: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get a player by ID
   * @param {string} playerId
   * @returns {Promise<Object|null>}
   */
  async getPlayerById(playerId) {
    try {
      const player = await Player.findOne({ playerId });
      return player ? player.toObject() : null;
    } catch (error) {
      this.log(`[db-service] Error fetching player by ID: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update player session and socket info
   * @param {string} playerName
   * @param {Object} updates - { sessionKey?, socketId? }
   * @returns {Promise<Object|null>}
   */
  async updatePlayer(playerName, updates) {
    try {
      const playerNameNormalized = playerName.toLowerCase();
      const player = await Player.findOneAndUpdate(
        { playerNameNormalized },
        { ...updates, updatedAt: new Date() },
        { new: true }
      );
      return player ? player.toObject() : null;
    } catch (error) {
      this.log(`[db-service] Error updating player: ${error.message}`);
      throw error;
    }
  }

  /**
   * Add a character to a player
   * @param {string} playerName
   * @param {Object} characterData - { id, characterName, createdAt, drones }
   * @returns {Promise<Object|null>}
   */
  async addCharacter(playerName, characterData) {
    try {
      const playerNameNormalized = playerName.toLowerCase();
      const player = await Player.findOneAndUpdate(
        { playerNameNormalized },
        {
          $push: { characters: characterData },
          updatedAt: new Date()
        },
        { new: true }
      );
      return player ? player.toObject() : null;
    } catch (error) {
      this.log(`[db-service] Error adding character: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all characters for a player
   * @param {string} playerName
   * @returns {Promise<Array>}
   */
  async getCharacters(playerName) {
    try {
      const playerNameNormalized = playerName.toLowerCase();
      const player = await Player.findOne({ playerNameNormalized }, { characters: 1 });
      return player ? player.characters : [];
    } catch (error) {
      this.log(`[db-service] Error fetching characters: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete a character from a player
   * @param {string} playerName
   * @param {string} characterId
   * @returns {Promise<Object|null>}
   */
  async deleteCharacter(playerName, characterId) {
    try {
      const playerNameNormalized = playerName.toLowerCase();
      const player = await Player.findOneAndUpdate(
        { playerNameNormalized },
        {
          $pull: { characters: { id: characterId } },
          updatedAt: new Date()
        },
        { new: true }
      );
      return player ? player.toObject() : null;
    } catch (error) {
      this.log(`[db-service] Error deleting character: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update a character in a player's list
   * @param {string} playerName
   * @param {string} characterId
   * @param {Object} updates - { characterName?, ... }
   * @returns {Promise<Object|null>}
   */
  async updateCharacter(playerName, characterId, updates) {
    try {
      const playerNameNormalized = playerName.toLowerCase();
      const player = await Player.findOne({ playerNameNormalized });
      
      if (!player) {
        return null;
      }

      const character = player.characters.find(c => c.id === characterId);
      if (!character) {
        return null;
      }

      Object.assign(character, updates);
      player.updatedAt = new Date();
      await player.save();
      return player.toObject();
    } catch (error) {
      this.log(`[db-service] Error updating character: ${error.message}`);
      throw error;
    }
  }

  /**
   * Add a drone to a character
   * @param {string} playerName
   * @param {string} characterId
   * @param {Object} droneData - { id, droneName, createdAt }
   * @returns {Promise<Object|null>}
   */
  async addDrone(playerName, characterId, droneData) {
    try {
      const playerNameNormalized = playerName.toLowerCase();
      const player = await Player.findOne({ playerNameNormalized });
      
      if (!player) {
        return null;
      }

      const character = player.characters.find(c => c.id === characterId);
      if (!character) {
        return null;
      }

      if (!character.drones) {
        character.drones = [];
      }
      character.drones.push(droneData);
      player.updatedAt = new Date();
      await player.save();
      return player.toObject();
    } catch (error) {
      this.log(`[db-service] Error adding drone: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all drones for a character
   * @param {string} playerName
   * @param {string} characterId
   * @returns {Promise<Array>}
   */
  async getDrones(playerName, characterId) {
    try {
      const playerNameNormalized = playerName.toLowerCase();
      const player = await Player.findOne({ playerNameNormalized });
      
      if (!player) {
        return [];
      }

      const character = player.characters.find(c => c.id === characterId);
      return character && character.drones ? character.drones : [];
    } catch (error) {
      this.log(`[db-service] Error fetching drones: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete all players (useful for testing)
   * @returns {Promise<void>}
   */
  async clearAllPlayers() {
    try {
      await Player.deleteMany({});
      this.log('[db-service] All players cleared');
    } catch (error) {
      this.log(`[db-service] Error clearing players: ${error.message}`);
      throw error;
    }
  }
}

module.exports = {
  DatabaseService
};
