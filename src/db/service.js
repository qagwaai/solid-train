'use strict';

const mongoose = require('mongoose');
const {
  CelestialBody,
  GameStateDocument,
  Item,
  JumpGate,
  Market,
  NpcBust,
  Player,
  ShipRecord,
  SolarSystem,
  Star,
} = require('./models');
const playerCharacterService = require('./service/player-character-service');
const itemWriteService = require('./service/item-write-service');
const itemQueryService = require('./service/item-query-service');
const marketWriteService = require('./service/market-write-service');
const marketQueryService = require('./service/market-query-service');
const marketSeedStateService = require('./service/market-seed-state-service');
const celestialWriteService = require('./service/celestial-write-service');
const celestialQueryService = require('./service/celestial-query-service');
const celestialSeedStateService = require('./service/celestial-seed-state-service');
const npcSeedStateService = require('./service/npc-seed-state-service');
const jumpGateQueryService = require('./service/jump-gate-query-service');
const starService = require('./service/star-service');
const solarSystemService = require('./service/solar-system-service');
const npcBustService = require('./service/npc-bust-service');
const { createLogger } = require('../logging/logger');

/**
 * Database service layer - provides a clean interface for CRUD operations
 * Bridges between handlers and Mongoose models
 */
class DatabaseService {
  constructor(options = {}) {
    this.useInMemoryFallback = options.useInMemoryFallback || false;
    this.logger =
      options.logger ||
      createLogger({
        minLevel: options.logLevel || process.env.LOG_LEVEL || 'info',
        write:
          typeof options.log === 'function'
            ? (level, line, logOptions = {}) => options.log(line, { level, ...logOptions })
            : undefined,
      });
    this.log = (line, logOptions = {}) => this.logger.log(line, logOptions);
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

  normalizeShipOwnershipForPersistence(ownership) {
    if (!ownership || typeof ownership !== 'object') {
      throw new Error('ship ownership is required');
    }

    const ownerType = this.toNonEmptyString(ownership.ownerType);
    const playerId = this.toNonEmptyString(ownership.playerId) || null;
    const characterId = this.toNonEmptyString(ownership.characterId) || null;
    const npcId = this.toNonEmptyString(ownership.npcId) || null;
    const factionId = this.toNonEmptyString(ownership.factionId) || null;

    if (!['player-character', 'npc-pirate', 'unowned', 'unknown'].includes(ownerType)) {
      throw new Error('ship ownership ownerType is invalid');
    }

    if (ownerType === 'player-character' && (!playerId || !characterId || npcId)) {
      throw new Error('ship ownership is invalid for player-character owner');
    }

    if (ownerType === 'npc-pirate' && (!npcId || playerId || characterId)) {
      throw new Error('ship ownership is invalid for npc-pirate owner');
    }

    if (
      (ownerType === 'unowned' || ownerType === 'unknown') &&
      (playerId || characterId || npcId)
    ) {
      throw new Error(`ship ownership is invalid for ${ownerType} owner`);
    }

    return {
      ownerType,
      playerId,
      characterId,
      npcId,
      factionId,
    };
  }

  async assertNoDanglingShipInventoryReferences(inventory) {
    if (!Array.isArray(inventory) || inventory.length === 0) {
      return;
    }

    const itemIds = inventory
      .map((entry) => this.toNonEmptyString(entry?.itemId))
      .filter((value) => Boolean(value));

    if (itemIds.length === 0) {
      return;
    }

    const existingItems = await Item.find({ id: { $in: itemIds } }, { id: 1 }).lean();
    const existingItemIds = new Set(existingItems.map((item) => item.id));
    const missingId = itemIds.find((itemId) => !existingItemIds.has(itemId));

    if (missingId) {
      throw new Error(`ship inventory contains missing item reference: ${missingId}`);
    }
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
   * Create or update a character-scoped bust descriptor.
   * @param {string} playerName
   * @param {string} characterId
   * @param {Object} descriptor
   * @returns {Promise<Object|null>}
   */
  async upsertCharacterBust(playerName, characterId, descriptor) {
    return playerCharacterService.upsertCharacterBust(
      this,
      Player,
      playerName,
      characterId,
      descriptor
    );
  }

  /**
   * Read a character-scoped bust descriptor.
   * @param {string} playerName
   * @param {string} characterId
   * @returns {Promise<Object|null>}
   */
  async getCharacterBust(playerName, characterId) {
    return playerCharacterService.getCharacterBust(this, Player, playerName, characterId);
  }

  /**
   * Create or update an NPC bust descriptor record.
   * @param {string} npcId
   * @param {string} deterministicSeed
   * @param {Object} descriptor
   * @param {string[]} appliedOverrides
   * @returns {Promise<Object|null>}
   */
  async upsertNpcBust(npcId, deterministicSeed, descriptor, appliedOverrides) {
    return npcBustService.upsertNpcBust(
      this,
      NpcBust,
      npcId,
      deterministicSeed,
      descriptor,
      appliedOverrides
    );
  }

  /**
   * Read an NPC bust descriptor record.
   * @param {string} npcId
   * @returns {Promise<Object|null>}
   */
  async getNpcBust(npcId) {
    return npcBustService.getNpcBust(this, NpcBust, npcId);
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

  async createShip(shipData) {
    try {
      const ownership = this.normalizeShipOwnershipForPersistence(shipData?.ownership);
      await this.assertNoDanglingShipInventoryReferences(shipData?.inventory);

      const createdShip = await ShipRecord.create({
        ...shipData,
        ownership,
      });
      return createdShip.toObject();
    } catch (error) {
      this.log(`[db-service] Error creating ship: ${error.message}`);
      throw error;
    }
  }

  async getShipById(shipId) {
    try {
      const normalizedShipId = this.toNonEmptyString(shipId);
      if (!normalizedShipId) {
        return null;
      }

      return await ShipRecord.findOne({ id: normalizedShipId }).lean();
    } catch (error) {
      this.log(`[db-service] Error fetching ship by id: ${error.message}`);
      throw error;
    }
  }

  async updateShip(shipId, updates) {
    try {
      const normalizedShipId = this.toNonEmptyString(shipId);
      if (!normalizedShipId) {
        return null;
      }

      const nextUpdates = { ...updates };
      if ('ownership' in nextUpdates) {
        nextUpdates.ownership = this.normalizeShipOwnershipForPersistence(nextUpdates.ownership);
      }

      if (Array.isArray(nextUpdates.inventory)) {
        await this.assertNoDanglingShipInventoryReferences(nextUpdates.inventory);
      }

      return await ShipRecord.findOneAndUpdate({ id: normalizedShipId }, nextUpdates, {
        returnDocument: 'after',
      }).lean();
    } catch (error) {
      this.log(`[db-service] Error updating ship: ${error.message}`);
      throw error;
    }
  }

  async deleteShip(shipId) {
    try {
      const normalizedShipId = this.toNonEmptyString(shipId);
      if (!normalizedShipId) {
        return false;
      }

      const result = await ShipRecord.deleteOne({ id: normalizedShipId });
      return result.deletedCount > 0;
    } catch (error) {
      this.log(`[db-service] Error deleting ship: ${error.message}`);
      throw error;
    }
  }

  async listShipsByOwner(ownerQuery) {
    try {
      const normalizedOwner = this.normalizeShipOwnershipForPersistence(ownerQuery);
      const query = { 'ownership.ownerType': normalizedOwner.ownerType };

      if (normalizedOwner.ownerType === 'player-character') {
        query['ownership.playerId'] = normalizedOwner.playerId;
        query['ownership.characterId'] = normalizedOwner.characterId;
      }

      if (normalizedOwner.ownerType === 'npc-pirate') {
        query['ownership.npcId'] = normalizedOwner.npcId;
      }

      return await ShipRecord.find(query).lean();
    } catch (error) {
      this.log(`[db-service] Error listing ships by owner: ${error.message}`);
      throw error;
    }
  }

  async findShipsNearPosition(query = {}) {
    try {
      const solarSystemId = this.toNonEmptyString(query?.solarSystemId);
      const positionKm = query?.positionKm;
      const distanceKm = query?.distanceKm;
      const ownerTypes = Array.isArray(query?.ownerTypes)
        ? query.ownerTypes
            .map((ownerType) => this.toNonEmptyString(ownerType))
            .filter((ownerType) => Boolean(ownerType))
        : [];
      const limit = Number.isInteger(query?.limit) && query.limit > 0 ? query.limit : null;

      if (!solarSystemId || !this.isTriple(positionKm) || !this.isFiniteNumber(distanceKm) || distanceKm < 0) {
        return [];
      }

      const boundsQuery = {
        'spatial.solarSystemId': solarSystemId,
        'spatial.positionKm.x': {
          $gte: positionKm.x - distanceKm,
          $lte: positionKm.x + distanceKm,
        },
        'spatial.positionKm.y': {
          $gte: positionKm.y - distanceKm,
          $lte: positionKm.y + distanceKm,
        },
        'spatial.positionKm.z': {
          $gte: positionKm.z - distanceKm,
          $lte: positionKm.z + distanceKm,
        },
      };

      if (ownerTypes.length > 0) {
        boundsQuery['ownership.ownerType'] = { $in: ownerTypes };
      }

      const candidateShips = await ShipRecord.find(boundsQuery).lean();
      const exactMatches = candidateShips
        .map((ship) => {
          if (!this.isTriple(ship?.spatial?.positionKm)) {
            return null;
          }

          const candidateDistanceKm = this.calculateDistanceKm(positionKm, ship.spatial.positionKm);
          if (candidateDistanceKm > distanceKm) {
            return null;
          }

          return {
            ship,
            distanceKm: candidateDistanceKm,
          };
        })
        .filter((entry) => Boolean(entry))
        .sort((left, right) => left.distanceKm - right.distanceKm);

      if (!limit) {
        return exactMatches;
      }

      return exactMatches.slice(0, limit);
    } catch (error) {
      this.log(`[db-service] Error finding ships near position: ${error.message}`);
      throw error;
    }
  }

  async transferShipOwnership(transfer) {
    try {
      const shipId = this.toNonEmptyString(transfer?.shipId);
      if (!shipId) {
        throw new Error('shipId is required');
      }

      const ship = await ShipRecord.findOne({ id: shipId });
      if (!ship) {
        throw new Error('ship not found');
      }

      const currentOwnership = this.normalizeShipOwnershipForPersistence(ship.ownership);
      const actorPlayerId = this.toNonEmptyString(transfer?.actorPlayerId);
      if (
        currentOwnership.ownerType === 'player-character' &&
        currentOwnership.playerId !== actorPlayerId
      ) {
        throw new Error('unauthorized ownership transfer');
      }

      ship.ownership = this.normalizeShipOwnershipForPersistence(transfer?.toOwner);
      await ship.save();
      return ship.toObject();
    } catch (error) {
      this.log(`[db-service] Error transferring ship ownership: ${error.message}`);
      throw error;
    }
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

  async getSolarSystemNpcSeedState(solarSystemId) {
    return npcSeedStateService.getSolarSystemNpcSeedState(
      this,
      GameStateDocument,
      solarSystemId
    );
  }

  async setSolarSystemNpcSeedState(solarSystemId, seedVersion, seededAt) {
    return npcSeedStateService.setSolarSystemNpcSeedState(
      this,
      GameStateDocument,
      solarSystemId,
      seedVersion,
      seededAt
    );
  }

  async getSeededNpcOwners(query = {}) {
    return npcSeedStateService.getSeededNpcOwners(this, GameStateDocument, query);
  }

  async upsertSeededNpcOwner(ownerRecord) {
    return npcSeedStateService.upsertSeededNpcOwner(this, GameStateDocument, ownerRecord);
  }

  async updateSeededNpcOwnerCredits(npcId, currentCredits, updatedAt) {
    return npcSeedStateService.updateSeededNpcOwnerCredits(
      this,
      GameStateDocument,
      npcId,
      currentCredits,
      updatedAt
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
      if (mongoose.connection.readyState === 1) {
        await ShipRecord.deleteMany({});
      }
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

  // ---------- HYG stars ----------

  async upsertStar(starData) {
    return starService.upsertStar(this, Star, starData);
  }

  async upsertStars(starsData) {
    return starService.upsertStars(this, Star, starsData);
  }

  async getStarByHygId(hygId) {
    return starService.getStarByHygId(this, Star, hygId);
  }

  async getStars(query = {}) {
    return starService.getStars(this, Star, query);
  }

  // ---------- Solar systems ----------

  async upsertSolarSystem(systemData) {
    return solarSystemService.upsertSolarSystem(this, SolarSystem, systemData);
  }

  async upsertSolarSystems(systemsData) {
    return solarSystemService.upsertSolarSystems(this, SolarSystem, systemsData);
  }

  async getSolarSystemById(id) {
    return solarSystemService.getSolarSystemById(this, SolarSystem, id);
  }

  async getSolarSystems(query = {}) {
    return solarSystemService.getSolarSystems(this, SolarSystem, query);
  }
}

module.exports = {
  DatabaseService,
};
