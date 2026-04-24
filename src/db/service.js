'use strict';

const { CelestialBody, Player } = require('./models');

/**
 * Database service layer - provides a clean interface for CRUD operations
 * Bridges between handlers and Mongoose models
 */
class DatabaseService {
  constructor(options = {}) {
    this.useInMemoryFallback = options.useInMemoryFallback || false;
    this.log = options.log || ((line) => process.stdout.write(`${line}\n`));
  }

  isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
  }

  isTriple(value) {
    return Boolean(value)
      && this.isFiniteNumber(value.x)
      && this.isFiniteNumber(value.y)
      && this.isFiniteNumber(value.z);
  }

  calculateDistanceKm(fromPositionKm, toPositionKm) {
    const dx = toPositionKm.x - fromPositionKm.x;
    const dy = toPositionKm.y - fromPositionKm.y;
    const dz = toPositionKm.z - fromPositionKm.z;

    return Math.sqrt((dx * dx) + (dy * dy) + (dz * dz));
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
    * @param {Object} characterData - { id, characterName, createdAt, ships, missions }
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
      const player = await Player.findOne({ playerNameNormalized }, { characters: 1 }).lean();
      return player && Array.isArray(player.characters) ? player.characters : [];
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
   * Add a ship to a character
   * @param {string} playerName
   * @param {string} characterId
   * @param {Object} shipData - { id, shipName, createdAt }
   * @returns {Promise<Object|null>}
   */
  async addShip(playerName, characterId, shipData) {
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

      if (!character.ships) {
        character.ships = [];
      }
      character.ships.push(shipData);
      player.updatedAt = new Date();
      await player.save();
      return player.toObject();
    } catch (error) {
      this.log(`[db-service] Error adding ship: ${error.message}`);
      throw error;
    }
  }

  /**
   * Add or update a mission for a character
   * @param {string} playerName
   * @param {string} characterId
   * @param {Object} missionData - { missionId, status, updatedAt, ... }
   * @returns {Promise<Object|null>}
   */
  async addOrUpdateMission(playerName, characterId, missionData) {
    try {
      const playerNameNormalized = playerName.toLowerCase();
      const player = await Player.findOne({ playerNameNormalized });

      if (!player) {
        return null;
      }

      const character = player.characters.find((c) => c.id === characterId);
      if (!character) {
        return null;
      }

      if (!Array.isArray(character.missions)) {
        character.missions = [];
      }

      const missionIndex = character.missions.findIndex(
        (mission) => mission.missionId === missionData.missionId
      );

      if (missionIndex >= 0) {
        // Update existing mission using array index to ensure Mongoose tracks the change
        character.missions[missionIndex] = missionData;
        player.markModified(`characters.${player.characters.indexOf(character)}.missions`);
      } else {
        // Add new mission
        character.missions.push(missionData);
      }

      player.updatedAt = new Date();
      await player.save();
      return player.toObject();
    } catch (error) {
      this.log(`[db-service] Error adding/updating mission: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all missions for a character
   * @param {string} playerName
   * @param {string} characterId
   * @returns {Promise<Array>}
   */
  async getMissions(playerName, characterId) {
    try {
      const playerNameNormalized = playerName.toLowerCase();
      const player = await Player.findOne({ playerNameNormalized });

      if (!player) {
        return [];
      }

      const character = player.characters.find((c) => c.id === characterId);
      if (!character || !Array.isArray(character.missions)) {
        return [];
      }

      return character.missions;
    } catch (error) {
      this.log(`[db-service] Error fetching missions: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all ships for a character
   * @param {string} playerName
   * @param {string} characterId
   * @returns {Promise<Array>}
   */
  async getShips(playerName, characterId) {
    try {
      const playerNameNormalized = playerName.toLowerCase();
      const player = await Player.findOne({ playerNameNormalized });
      
      if (!player) {
        return [];
      }

      const character = player.characters.find(c => c.id === characterId);
      return character && character.ships ? character.ships : [];
    } catch (error) {
      this.log(`[db-service] Error fetching ships: ${error.message}`);
      throw error;
    }
  }

  /**
   * Add or update a celestial body in the cb collection using id as the upsert key
   * @param {Object} celestialBodyData
   * @returns {Promise<Object>}
   */
  async addOrUpdateCelestialBody(celestialBodyData) {
    try {
      const celestialBody = await CelestialBody.findOneAndUpdate(
        { id: celestialBodyData.id },
        celestialBodyData,
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true
        }
      );
      return celestialBody ? celestialBody.toObject() : null;
    } catch (error) {
      this.log(`[db-service] Error adding/updating celestial body: ${error.message}`);
      throw error;
    }
  }

  /**
   * Find celestial bodies in a spherical radius around a position.
   * Uses a bounding-cube query first, then exact spherical distance filtering.
   *
   * Future optimization plan: migrate location to GeoJSON and add a 2dsphere index.
   * @param {Object} query
   * @param {string} query.solarSystemId
   * @param {{x:number,y:number,z:number}} query.positionKm
   * @param {number} query.distanceKm
   * @returns {Promise<Array<{celestialBody:Object,distanceKm:number}>>}
   */
  async findCelestialBodiesNearPosition(query) {
    const solarSystemId = typeof query?.solarSystemId === 'string'
      ? query.solarSystemId.trim()
      : '';
    const positionKm = query?.positionKm;
    const distanceKm = query?.distanceKm;

    if (!solarSystemId || !this.isTriple(positionKm) || !this.isFiniteNumber(distanceKm) || distanceKm < 0) {
      return [];
    }

    try {
      const boundsQuery = {
        solarSystemId,
        'location.positionKm.x': {
          $gte: positionKm.x - distanceKm,
          $lte: positionKm.x + distanceKm
        },
        'location.positionKm.y': {
          $gte: positionKm.y - distanceKm,
          $lte: positionKm.y + distanceKm
        },
        'location.positionKm.z': {
          $gte: positionKm.z - distanceKm,
          $lte: positionKm.z + distanceKm
        }
      };

      const candidates = await CelestialBody.find(boundsQuery).lean();

      return candidates
        .map((celestialBody) => {
          const bodyPositionKm = celestialBody?.location?.positionKm;
          if (!this.isTriple(bodyPositionKm)) {
            return null;
          }

          const candidateDistanceKm = this.calculateDistanceKm(positionKm, bodyPositionKm);
          if (candidateDistanceKm > distanceKm) {
            return null;
          }

          return {
            celestialBody,
            distanceKm: candidateDistanceKm
          };
        })
        .filter((entry) => Boolean(entry))
        .sort((left, right) => left.distanceKm - right.distanceKm);
    } catch (error) {
      this.log(`[db-service] Error finding celestial bodies near position: ${error.message}`);
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
      await CelestialBody.deleteMany({});
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
