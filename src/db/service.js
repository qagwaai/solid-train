'use strict';

const { CelestialBody, GameStateDocument, Item, JumpGate, Market, Player } = require('./models');
const playerCharacterService = require('./service/player-character-service');
const itemWriteService = require('./service/item-write-service');
const itemQueryService = require('./service/item-query-service');
const marketWriteService = require('./service/market-write-service');
const marketQueryService = require('./service/market-query-service');
const marketSeedStateService = require('./service/market-seed-state-service');
const celestialWriteService = require('./service/celestial-write-service');
const celestialQueryService = require('./service/celestial-query-service');
const celestialSeedStateService = require('./service/celestial-seed-state-service');
const jumpGateQueryService = require('./service/jump-gate-query-service');

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
   * Normalize user-provided string input; returns empty string when invalid.
   * @param {unknown} value
   * @returns {string}
   */
  toNonEmptyString(value) {
    if (typeof value !== 'string') {
      return '';
    }

    return value.trim();
  }

  escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Build a case-insensitive player lookup that supports legacy records.
   * @param {string} playerName
   * @returns {Object|null}
   */
  buildPlayerNameQuery(playerName) {
    const normalized = this.toNonEmptyString(playerName).toLowerCase();
    if (!normalized) {
      return null;
    }

    // Support legacy player documents that predate playerNameNormalized.
    return {
      $or: [
        { playerNameNormalized: normalized },
        { playerName: new RegExp(`^${this.escapeRegExp(normalized)}$`, 'i') },
      ],
    };
  }

  /**
   * Check whether value is a finite number.
   * @param {unknown} value
   * @returns {boolean}
   */
  isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
  }

  isTriple(value) {
    return (
      Boolean(value) &&
      this.isFiniteNumber(value.x) &&
      this.isFiniteNumber(value.y) &&
      this.isFiniteNumber(value.z)
    );
  }

  /**
   * Ensure embedded ship objects always persist shipName for compatibility.
   * @param {Object} ship
   * @returns {Object}
   */
  normalizeCharacterShipForPersistence(ship) {
    if (!ship || typeof ship !== 'object') {
      return ship;
    }

    const shipName = this.toNonEmptyString(ship.shipName) || this.toNonEmptyString(ship.name);
    if (!shipName) {
      return { ...ship };
    }

    return {
      ...ship,
      shipName,
    };
  }

  normalizeCharacterUpdatesForPersistence(updates) {
    if (!updates || typeof updates !== 'object') {
      return updates;
    }

    if (!Array.isArray(updates.ships)) {
      return updates;
    }

    return {
      ...updates,
      ships: updates.ships.map((ship) => this.normalizeCharacterShipForPersistence(ship)),
    };
  }

  calculateDistanceKm(fromPositionKm, toPositionKm) {
    const dx = toPositionKm.x - fromPositionKm.x;
    const dy = toPositionKm.y - fromPositionKm.y;
    const dz = toPositionKm.z - fromPositionKm.z;

    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Register a new player
   * @param {Object} playerData - { playerId, playerName, email, password }
   * @returns {Promise<Object>} Created player document
   */
  async registerPlayer(playerData) {
    return playerCharacterService.registerPlayer(this, Player, playerData);
  }

  /**
   * Get a player by name (case-insensitive)
   * @param {string} playerName
   * @returns {Promise<Object|null>}
   */
  async getPlayerByName(playerName) {
    return playerCharacterService.getPlayerByName(this, Player, playerName);
  }

  /**
   * Get a player by ID
   * @param {string} playerId
   * @returns {Promise<Object|null>}
   */
  async getPlayerById(playerId) {
    return playerCharacterService.getPlayerById(this, Player, playerId);
  }

  /**
   * Update player session and socket info
   * @param {string} playerName
   * @param {Object} updates - { sessionKey?, socketId? }
   * @returns {Promise<Object|null>}
   */
  async updatePlayer(playerName, updates) {
    return playerCharacterService.updatePlayer(this, Player, playerName, updates);
  }

  /**
   * Add a character to a player
   * @param {string} playerName
   * @param {Object} characterData - { id, characterName, createdAt, ships, missions }
   * @returns {Promise<Object|null>}
   */
  async addCharacter(playerName, characterData) {
    return playerCharacterService.addCharacter(this, Player, playerName, characterData);
  }

  /**
   * Get all characters for a player
   * @param {string} playerName
   * @returns {Promise<Array>}
   */
  async getCharacters(playerName) {
    return playerCharacterService.getCharacters(this, Player, playerName);
  }

  /**
   * Delete a character from a player
   * @param {string} playerName
   * @param {string} characterId
   * @returns {Promise<Object|null>}
   */
  async deleteCharacter(playerName, characterId) {
    return playerCharacterService.deleteCharacter(this, Player, playerName, characterId);
  }

  /**
   * Update a character in a player's list
   * @param {string} playerName
   * @param {string} characterId
   * @param {Object} updates - { characterName?, ... }
   * @returns {Promise<Object|null>}
   */
  async updateCharacter(playerName, characterId, updates) {
    return playerCharacterService.updateCharacter(this, Player, playerName, characterId, updates);
  }

  /**
   * Add a ship to a character
   * @param {string} playerName
   * @param {string} characterId
   * @param {Object} shipData - { id, shipName, createdAt }
   * @returns {Promise<Object|null>}
   */
  async addShip(playerName, characterId, shipData) {
    return playerCharacterService.addShip(this, Player, playerName, characterId, shipData);
  }

  /**
   * Create one or more global items.
   * @param {Object[]} itemsData
   * @returns {Promise<Object[]>}
   */
  async addItems(itemsData) {
    return itemWriteService.addItems(this, Item, itemsData);
  }

  /**
   * Delete global items by id.
   * @param {string[]} itemIds
   * @returns {Promise<void>}
   */
  async deleteItemsByIds(itemIds) {
    return itemWriteService.deleteItemsByIds(this, Item, itemIds);
  }

  /**
   * Get global items by id.
   * @param {string[]} itemIds
   * @returns {Promise<Object[]>}
   */
  async getItemsByIds(itemIds) {
    return itemQueryService.getItemsByIds(this, Item, itemIds);
  }

  /**
   * Update a single item by id (full replace of mutable fields).
   * @param {string} itemId
   * @param {Object} updates
   * @returns {Promise<Object|null>}
   */
  async updateItemById(itemId, updates) {
    return itemWriteService.updateItemById(this, Item, itemId, updates);
  }

  /**
   * Get all items for a given container.
   * @param {string} containerType
   * @param {string} containerId
   * @returns {Promise<Object[]>}
   */
  async getItemsByContainer(containerType, containerId) {
    return itemQueryService.getItemsByContainer(this, Item, containerType, containerId);
  }

  /**
   * Add or update a mission for a character
   * @param {string} playerName
   * @param {string} characterId
   * @param {Object} missionData - { missionId, status, updatedAt, ... }
   * @returns {Promise<Object|null>}
   */
  async addOrUpdateMission(playerName, characterId, missionData) {
    return playerCharacterService.addOrUpdateMission(
      this,
      Player,
      playerName,
      characterId,
      missionData
    );
  }

  /**
   * Get all missions for a character
   * @param {string} playerName
   * @param {string} characterId
   * @returns {Promise<Array>}
   */
  async getMissions(playerName, characterId) {
    return playerCharacterService.getMissions(this, Player, playerName, characterId);
  }

  /**
   * Get all ships for a character
   * @param {string} playerName
   * @param {string} characterId
   * @returns {Promise<Array>}
   */
  async getShips(playerName, characterId) {
    return playerCharacterService.getShips(this, Player, playerName, characterId);
  }

  /**
   * Add or update a celestial body in the cb collection using id as the upsert key
   * @param {Object} celestialBodyData
   * @returns {Promise<Object>}
   */
  async addOrUpdateCelestialBody(celestialBodyData) {
    return celestialWriteService.addOrUpdateCelestialBody(this, CelestialBody, celestialBodyData);
  }

  /**
   * Get a celestial body by id.
   * @param {string} celestialBodyId
   * @returns {Promise<Object|null>}
   */
  async getCelestialBodyById(celestialBodyId) {
    return celestialQueryService.getCelestialBodyById(this, CelestialBody, celestialBodyId);
  }

  /**
   * Delete a celestial body by id.
   * @param {string} celestialBodyId
   * @returns {Promise<boolean>}
   */
  async deleteCelestialBodyById(celestialBodyId) {
    return celestialWriteService.deleteCelestialBodyById(this, CelestialBody, celestialBodyId);
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
    return celestialQueryService.findCelestialBodiesNearPosition(this, CelestialBody, query);
  }

  /**
   * Get celestial bodies by optional scope filters.
   * @param {Object} query
   * @param {string} [query.solarSystemId]
   * @param {string} [query.createdByCharacterId]
   * @param {string} [query.missionId]
   * @param {string[]} [query.stateValues]
   * @returns {Promise<Object[]>}
   */
  async getCelestialBodies(query = {}) {
    return celestialQueryService.getCelestialBodies(this, CelestialBody, query);
  }

  /**
   * Find items in a spherical radius around a position.
   * Items are located via spatial.positionKm and spatial.solarSystemId.
   * Uses a bounding-cube query first, then exact spherical distance filtering.
   * @param {Object} query
   * @param {string} query.solarSystemId
   * @param {{x:number,y:number,z:number}} query.positionKm
   * @param {number} query.distanceKm
   * @param {string} [query.itemType]
   * @returns {Promise<Array<{item:Object,distanceKm:number}>>}
   */
  async findItemsNearPosition(query) {
    return itemQueryService.findItemsNearPosition(this, Item, query);
  }

  async upsertMarket(marketData) {
    return marketWriteService.upsertMarket(this, Market, marketData);
  }

  async getMarkets(query = {}) {
    return marketQueryService.getMarkets(this, Market, query);
  }

  async getSolarSystemMarketSeedState(solarSystemId) {
    return marketSeedStateService.getSolarSystemMarketSeedState(
      this,
      GameStateDocument,
      solarSystemId
    );
  }

  async setSolarSystemMarketSeedState(solarSystemId, seedVersion, seededAt) {
    return marketSeedStateService.setSolarSystemMarketSeedState(
      this,
      GameStateDocument,
      solarSystemId,
      seedVersion,
      seededAt
    );
  }

  async getSolarSystemCelestialSeedState(solarSystemId) {
    return celestialSeedStateService.getSolarSystemCelestialSeedState(
      this,
      GameStateDocument,
      solarSystemId
    );
  }

  async setSolarSystemCelestialSeedState(solarSystemId, seedVersion, seededAt) {
    return celestialSeedStateService.setSolarSystemCelestialSeedState(
      this,
      GameStateDocument,
      solarSystemId,
      seedVersion,
      seededAt
    );
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

  /**
   * Retrieve all active jump gates
   * @returns {Promise<Array>} Array of jump gate documents
   */
  async getJumpGatesAsync() {
    return jumpGateQueryService.getJumpGatesAsync(this, JumpGate);
  }
}

module.exports = {
  DatabaseService,
};
