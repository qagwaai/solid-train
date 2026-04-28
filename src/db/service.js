'use strict';

const { CelestialBody, Item, Player } = require('./models');

/**
 * Database service layer - provides a clean interface for CRUD operations
 * Bridges between handlers and Mongoose models
 */
class DatabaseService {
  constructor(options = {}) {
    this.useInMemoryFallback = options.useInMemoryFallback || false;
    this.log = options.log || ((line) => process.stdout.write(`${line}\n`));
  }

  toNonEmptyString(value) {
    if (typeof value !== 'string') {
      return '';
    }

    return value.trim();
  }

  escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  buildPlayerNameQuery(playerName) {
    const normalized = this.toNonEmptyString(playerName).toLowerCase();
    if (!normalized) {
      return null;
    }

    // Support legacy player documents that predate playerNameNormalized.
    return {
      $or: [
        { playerNameNormalized: normalized },
        { playerName: new RegExp(`^${this.escapeRegExp(normalized)}$`, 'i') }
      ]
    };
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
      const playerNameNormalized = this.toNonEmptyString(playerName).toLowerCase();

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
      const playerNameQuery = this.buildPlayerNameQuery(playerName);
      if (!playerNameQuery) {
        return null;
      }

      const normalizedPlayerName = this.toNonEmptyString(playerName).toLowerCase();
      const player = await Player.findOne(playerNameQuery);

      if (player && !player.playerNameNormalized && normalizedPlayerName) {
        player.playerNameNormalized = normalizedPlayerName;
        await player.save();
      }

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
      const playerNameQuery = this.buildPlayerNameQuery(playerName);
      if (!playerNameQuery) {
        return null;
      }

      const player = await Player.findOneAndUpdate(
        playerNameQuery,
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
      const playerNameQuery = this.buildPlayerNameQuery(playerName);
      if (!playerNameQuery) {
        return null;
      }

      const player = await Player.findOneAndUpdate(
        playerNameQuery,
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
      const playerNameQuery = this.buildPlayerNameQuery(playerName);
      if (!playerNameQuery) {
        return [];
      }

      const player = await Player.findOne(playerNameQuery, { characters: 1 }).lean();
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
      const playerNameQuery = this.buildPlayerNameQuery(playerName);
      if (!playerNameQuery) {
        return null;
      }

      const player = await Player.findOneAndUpdate(
        playerNameQuery,
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
      const playerNameQuery = this.buildPlayerNameQuery(playerName);
      if (!playerNameQuery) {
        return null;
      }

      const player = await Player.findOne(playerNameQuery);
      
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
      const playerNameQuery = this.buildPlayerNameQuery(playerName);
      if (!playerNameQuery) {
        return null;
      }

      const player = await Player.findOne(playerNameQuery);
      
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
   * Create one or more global items.
   * @param {Object[]} itemsData
   * @returns {Promise<Object[]>}
   */
  async addItems(itemsData) {
    try {
      if (!Array.isArray(itemsData) || itemsData.length === 0) {
        return [];
      }

      const items = await Item.insertMany(itemsData, { ordered: true });
      return items.map((item) => item.toObject());
    } catch (error) {
      this.log(`[db-service] Error adding items: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete global items by id.
   * @param {string[]} itemIds
   * @returns {Promise<void>}
   */
  async deleteItemsByIds(itemIds) {
    try {
      if (!Array.isArray(itemIds) || itemIds.length === 0) {
        return;
      }

      await Item.deleteMany({ id: { $in: itemIds } });
    } catch (error) {
      this.log(`[db-service] Error deleting items: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get global items by id.
   * @param {string[]} itemIds
   * @returns {Promise<Object[]>}
   */
  async getItemsByIds(itemIds) {
    try {
      if (!Array.isArray(itemIds) || itemIds.length === 0) {
        return [];
      }

      return await Item.find({ id: { $in: itemIds } }).lean();
    } catch (error) {
      this.log(`[db-service] Error fetching items: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update a single item by id (full replace of mutable fields).
   * @param {string} itemId
   * @param {Object} updates
   * @returns {Promise<Object|null>}
   */
  async updateItemById(itemId, updates) {
    try {
      const result = await Item.findOneAndUpdate(
        { id: itemId },
        { $set: updates },
        { new: true }
      ).lean();

      return result;
    } catch (error) {
      this.log(`[db-service] Error updating item: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all items for a given container.
   * @param {string} containerType
   * @param {string} containerId
   * @returns {Promise<Object[]>}
   */
  async getItemsByContainer(containerType, containerId) {
    try {
      return await Item.find({
        'container.containerType': containerType,
        'container.containerId': containerId
      }).lean();
    } catch (error) {
      this.log(`[db-service] Error fetching items by container: ${error.message}`);
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
      const playerNameQuery = this.buildPlayerNameQuery(playerName);
      if (!playerNameQuery) {
        return null;
      }

      const player = await Player.findOne(playerNameQuery);

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
      const playerNameQuery = this.buildPlayerNameQuery(playerName);
      if (!playerNameQuery) {
        return [];
      }

      const player = await Player.findOne(playerNameQuery);

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
      const playerNameQuery = this.buildPlayerNameQuery(playerName);
      if (!playerNameQuery) {
        return [];
      }

      const player = await Player.findOne(playerNameQuery);
      
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
   * Get a celestial body by id.
   * @param {string} celestialBodyId
   * @returns {Promise<Object|null>}
   */
  async getCelestialBodyById(celestialBodyId) {
    try {
      if (!celestialBodyId || typeof celestialBodyId !== 'string') {
        return null;
      }

      const celestialBody = await CelestialBody.findOne({ id: celestialBodyId.trim() }).lean();
      return celestialBody || null;
    } catch (error) {
      this.log(`[db-service] Error fetching celestial body by id: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete a celestial body by id.
   * @param {string} celestialBodyId
   * @returns {Promise<boolean>}
   */
  async deleteCelestialBodyById(celestialBodyId) {
    try {
      if (!celestialBodyId || typeof celestialBodyId !== 'string') {
        return false;
      }

      const result = await CelestialBody.deleteOne({ id: celestialBodyId.trim() });
      return result.deletedCount > 0;
    } catch (error) {
      this.log(`[db-service] Error deleting celestial body by id: ${error.message}`);
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
   * Find items in a spherical radius around a position.
   * Items are located via kinematics.position and kinematics.reference.solarSystemId.
   * Uses a bounding-cube query first, then exact spherical distance filtering.
   * @param {Object} query
   * @param {string} query.solarSystemId
   * @param {{x:number,y:number,z:number}} query.positionKm
   * @param {number} query.distanceKm
   * @param {string} [query.itemType]
   * @returns {Promise<Array<{item:Object,distanceKm:number}>>}
   */
  async findItemsNearPosition(query) {
    const solarSystemId = typeof query?.solarSystemId === 'string'
      ? query.solarSystemId.trim()
      : '';
    const positionKm = query?.positionKm;
    const distanceKm = query?.distanceKm;
    const itemType = typeof query?.itemType === 'string' ? query.itemType.trim() : '';

    if (!solarSystemId || !this.isTriple(positionKm) || !this.isFiniteNumber(distanceKm) || distanceKm < 0) {
      return [];
    }

    try {
      const boundsQuery = {
        'kinematics.reference.solarSystemId': solarSystemId,
        'kinematics.position.x': {
          $gte: positionKm.x - distanceKm,
          $lte: positionKm.x + distanceKm
        },
        'kinematics.position.y': {
          $gte: positionKm.y - distanceKm,
          $lte: positionKm.y + distanceKm
        },
        'kinematics.position.z': {
          $gte: positionKm.z - distanceKm,
          $lte: positionKm.z + distanceKm
        }
      };

      if (itemType) {
        boundsQuery.itemType = itemType;
      }

      const candidates = await Item.find(boundsQuery).lean();

      return candidates
        .map((item) => {
          const itemPositionKm = item?.kinematics?.position;
          if (!this.isTriple(itemPositionKm)) {
            return null;
          }

          const candidateDistanceKm = this.calculateDistanceKm(positionKm, itemPositionKm);
          if (candidateDistanceKm > distanceKm) {
            return null;
          }

          return {
            item,
            distanceKm: candidateDistanceKm
          };
        })
        .filter((entry) => Boolean(entry))
        .sort((left, right) => left.distanceKm - right.distanceKm);
    } catch (error) {
      this.log(`[db-service] Error finding items near position: ${error.message}`);
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
      await Item.deleteMany({});
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
