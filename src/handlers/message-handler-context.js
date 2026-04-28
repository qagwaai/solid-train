'use strict';

const { GameState } = require('../model/game');

class MessageHandlerContext {
  constructor(options = {}) {
    this.registeredPlayers = options.registeredPlayers || new Map();
    this.charactersByPlayer = options.charactersByPlayer || new Map();
    this.celestialBodiesById = options.celestialBodiesById || new Map();
    this.itemsById = options.itemsById || new Map();
    this.databaseService = options.databaseService || null;
    this.game = options.game || new GameState();
    this.log = options.log || ((line) => process.stdout.write(`${line}\n`));
    this.createId = options.createId || (() => {
      throw new Error('createId is required');
    });
    this.getCurrentTimestamp =
      options.getCurrentTimestamp || (() => new Date().toISOString());
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

  normalizeShip(ship) {
    const source = this.toPlainObject(ship) || {};
    const shipName = this.toNonEmptyString(source.shipName) || this.toNonEmptyString(source.name);
    const inventory = Array.isArray(source.inventory)
      ? source.inventory
        .map((entry) => this.normalizeInventoryItemReference(entry))
        .filter((entry) => Boolean(entry))
      : [];

    return {
      ...source,
      inventory,
      shipName: shipName || source.shipName || source.name || '',
      launchable: source.launchable != null ? Boolean(source.launchable) : true
    };
  }

  normalizeInventoryItemReference(reference) {
    const source = this.toPlainObject(reference) || {};
    const itemId = this.toNonEmptyString(source.itemId);
    const itemType = this.toNonEmptyString(source.itemType);

    if (!itemId || !itemType) {
      return null;
    }

    return {
      itemId,
      itemType
    };
  }

  normalizeItem(item) {
    const source = this.toPlainObject(item) || {};
    const normalizedKinematics = source.kinematics ? {
      position: source.kinematics.position ? { ...source.kinematics.position } : null,
      velocity: source.kinematics.velocity ? { ...source.kinematics.velocity } : null,
      reference: source.kinematics.reference ? { ...source.kinematics.reference } : null
    } : null;
    const normalizedContainer = source.container ? {
      containerType: this.toNonEmptyString(source.container.containerType),
      containerId: this.toNonEmptyString(source.container.containerId)
    } : null;

    return {
      ...source,
      id: this.toNonEmptyString(source.id),
      itemType: this.toNonEmptyString(source.itemType),
      displayName: this.toNonEmptyString(source.displayName),
      state: this.toNonEmptyString(source.state),
      damageStatus: this.toNonEmptyString(source.damageStatus),
      container: normalizedContainer,
      owningPlayerId: this.toNonEmptyString(source.owningPlayerId),
      owningCharacterId: this.toNonEmptyString(source.owningCharacterId),
      kinematics: normalizedKinematics,
      createdAt: this.toNonEmptyString(source.createdAt),
      updatedAt: this.toNonEmptyString(source.updatedAt),
      destroyedAt: this.toNonEmptyString(source.destroyedAt) || null,
      destroyedReason: this.toNonEmptyString(source.destroyedReason) || null,
      launchable: source.launchable != null ? Boolean(source.launchable) : true
    };
  }

  normalizeCharacter(character) {
    const source = this.toPlainObject(character) || {};
    const characterName =
      this.toNonEmptyString(source.characterName) || this.toNonEmptyString(source.name);
    const ships = Array.isArray(source.ships)
      ? source.ships.map((ship) => this.normalizeShip(ship))
      : [];
    const missions = Array.isArray(source.missions)
      ? source.missions.map((mission) => this.normalizeMission(mission))
      : [];

    return {
      ...source,
      characterName: characterName || source.characterName || source.name || '',
      ships,
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

  normalizeCelestialBody(celestialBody) {
    const source = this.toPlainObject(celestialBody) || {};

    return {
      ...source,
      id: this.toNonEmptyString(source.id),
      catalogId: this.toNonEmptyString(source.catalogId),
      solarSystemId: this.toNonEmptyString(source.solarSystemId),
      sourceScanId: this.toNonEmptyString(source.sourceScanId),
      createdByCharacterId: this.toNonEmptyString(source.createdByCharacterId),
      createdAt: this.toNonEmptyString(source.createdAt),
      updatedAt: this.toNonEmptyString(source.updatedAt),
      location: source.location ? {
        positionKm: source.location.positionKm ? { ...source.location.positionKm } : null
      } : null,
      kinematics: source.kinematics ? {
        velocityKmPerSec: source.kinematics.velocityKmPerSec
          ? { ...source.kinematics.velocityKmPerSec }
          : null,
        angularVelocityRadPerSec: source.kinematics.angularVelocityRadPerSec
          ? { ...source.kinematics.angularVelocityRadPerSec }
          : null,
        estimatedMassKg: source.kinematics.estimatedMassKg,
        estimatedDiameterM: source.kinematics.estimatedDiameterM
      } : null,
      composition: source.composition ? {
        rarity: this.toNonEmptyString(source.composition.rarity),
        material: this.toNonEmptyString(source.composition.material),
        textureColor: this.toNonEmptyString(source.composition.textureColor)
      } : null
    };
  }

  getCelestialBody(celestialBodyId) {
    const normalizedCelestialBodyId = this.toNonEmptyString(celestialBodyId);

    if (!normalizedCelestialBodyId) {
      return null;
    }

    return this.celestialBodiesById.get(normalizedCelestialBodyId) || null;
  }

  getItem(itemId) {
    const normalizedItemId = this.toNonEmptyString(itemId);

    if (!normalizedItemId) {
      return null;
    }

    return this.itemsById.get(normalizedItemId) || null;
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

  cacheItems(items) {
    const normalizedItems = Array.isArray(items)
      ? items.map((item) => this.normalizeItem(item)).filter((item) => Boolean(item.id))
      : [];

    for (const item of normalizedItems) {
      this.itemsById.set(item.id, item);
    }

    return normalizedItems;
  }

  async getItemsByIdsAsync(itemIds) {
    const normalizedItemIds = Array.isArray(itemIds)
      ? itemIds.map((itemId) => this.toNonEmptyString(itemId)).filter((itemId) => Boolean(itemId))
      : [];

    if (normalizedItemIds.length === 0) {
      return [];
    }

    if (this.databaseService) {
      try {
        const items = await this.databaseService.getItemsByIds(normalizedItemIds);
        return this.cacheItems(items);
      } catch (error) {
        this.log(`[context] Error fetching items from DB: ${error.message}`);
        return [];
      }
    }

    return normalizedItemIds
      .map((itemId) => this.getItem(itemId))
      .filter((item) => Boolean(item))
      .map((item) => this.normalizeItem(item));
  }

  async addItemsAsync(items) {
    const normalizedItems = this.cacheItems(items);

    if (this.databaseService) {
      try {
        await this.databaseService.addItems(normalizedItems);
      } catch (error) {
        for (const item of normalizedItems) {
          this.itemsById.delete(item.id);
        }
        this.log(`[context] Error adding items in DB: ${error.message}`);
        throw error;
      }
    }

    return normalizedItems;
  }

  async deleteItemsAsync(itemIds) {
    const normalizedItemIds = Array.isArray(itemIds)
      ? itemIds.map((itemId) => this.toNonEmptyString(itemId)).filter((itemId) => Boolean(itemId))
      : [];

    if (normalizedItemIds.length === 0) {
      return;
    }

    if (this.databaseService) {
      try {
        await this.databaseService.deleteItemsByIds(normalizedItemIds);
      } catch (error) {
        this.log(`[context] Error deleting items in DB: ${error.message}`);
        throw error;
      }
    }

    for (const itemId of normalizedItemIds) {
      this.itemsById.delete(itemId);
    }
  }

  async updateItemAsync(itemId, updates) {
    const normalizedItemId = this.toNonEmptyString(itemId);
    if (!normalizedItemId) {
      return null;
    }

    const existing = this.getItem(normalizedItemId);
    if (!existing) {
      return null;
    }

    const updatedItem = this.normalizeItem({ ...existing, ...updates });
    this.itemsById.set(normalizedItemId, updatedItem);

    if (this.databaseService) {
      try {
        await this.databaseService.updateItemById(normalizedItemId, updatedItem);
      } catch (error) {
        this.log(`[context] Error updating item in DB: ${error.message}`);
      }
    }

    return updatedItem;
  }

  async getItemsByContainerAsync(containerType, containerId) {
    const normalizedContainerType = this.toNonEmptyString(containerType);
    const normalizedContainerId = this.toNonEmptyString(containerId);

    if (!normalizedContainerType || !normalizedContainerId) {
      return [];
    }

    if (this.databaseService) {
      try {
        const items = await this.databaseService.getItemsByContainer(
          normalizedContainerType,
          normalizedContainerId
        );

        return this.cacheItems(items);
      } catch (error) {
        this.log(`[context] Error fetching items by container from DB: ${error.message}`);
      }
    }

    return [...this.itemsById.values()].filter(
      (item) =>
        item.container?.containerType === normalizedContainerType &&
        item.container?.containerId === normalizedContainerId
    );
  }

  async hydrateShipAsync(ship) {
    const normalizedShip = this.normalizeShip(ship);
    const inventoryReferences = Array.isArray(normalizedShip.inventory)
      ? normalizedShip.inventory
      : [];
    const inventoryItemIds = inventoryReferences.map((reference) => reference.itemId);
    const items = await this.getItemsByIdsAsync(inventoryItemIds);
    const itemsById = new Map(items.map((item) => [item.id, item]));

    return {
      ...normalizedShip,
      inventory: inventoryReferences
        .map((reference) => itemsById.get(reference.itemId) || null)
        .filter((item) => Boolean(item))
    };
  }

  async hydrateShipsAsync(ships) {
    if (!Array.isArray(ships) || ships.length === 0) {
      return [];
    }

    return Promise.all(ships.map((ship) => this.hydrateShipAsync(ship)));
  }

  hasValidSession(payload) {
    const player = this.getPlayer(payload?.playerName);
    const sessionKey = this.toNonEmptyString(payload?.sessionKey);

    if (!player || !sessionKey || !player.sessionKey) {
      return false;
    }

    return player.sessionKey === sessionKey;
  }

  async ensurePlayerLoadedAsync(playerName) {
    const normalizedPlayerName = this.normalizePlayerName(playerName);
    if (!normalizedPlayerName) {
      return null;
    }

    let player = this.getPlayer(normalizedPlayerName);
    if (player || !this.databaseService) {
      return player;
    }

    await this.getPlayerAsync(normalizedPlayerName);
    player = this.getPlayer(normalizedPlayerName);
    return player;
  }

  async hasValidSessionAsync(payload) {
    const sessionKey = this.toNonEmptyString(payload?.sessionKey);
    if (!sessionKey) {
      return false;
    }

    const player = await this.ensurePlayerLoadedAsync(payload?.playerName);
    if (!player || !player.sessionKey) {
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

  async addShipAsync(playerName, characterId, shipData) {
    if (this.databaseService) {
      try {
        await this.databaseService.addShip(playerName, characterId, shipData);
      } catch (error) {
        this.log(`[context] Error adding ship in DB: ${error.message}`);
        throw error;
      }
    }
    // Also update in-memory
    const character = this.findCharacter(playerName, characterId);
    if (character) {
      if (!character.ships) {
        character.ships = [];
      }
      character.ships.push(shipData);
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

  async addOrUpdateCelestialBodyAsync(celestialBody) {
    const normalizedCelestialBody = this.normalizeCelestialBody(celestialBody);

    if (this.databaseService) {
      try {
        await this.databaseService.addOrUpdateCelestialBody(normalizedCelestialBody);
      } catch (error) {
        this.log(`[context] Error adding/updating celestial body in DB: ${error.message}`);
        throw error;
      }
    }

    this.celestialBodiesById.set(normalizedCelestialBody.id, normalizedCelestialBody);
    return normalizedCelestialBody;
  }

  async getCelestialBodiesNearPositionAsync(query) {
    const solarSystemId = this.toNonEmptyString(query?.solarSystemId);
    const positionKm = query?.positionKm;
    const distanceKm = query?.distanceKm;
    const limit = query?.limit;

    if (!solarSystemId || !this.isTriple(positionKm) || !this.isFiniteNumber(distanceKm) || distanceKm < 0) {
      return [];
    }

    let results = [];

    if (this.databaseService) {
      try {
        const fromDb = await this.databaseService.findCelestialBodiesNearPosition({
          solarSystemId,
          positionKm,
          distanceKm
        });

        results = fromDb.map((entry) => {
          const normalizedCelestialBody = this.normalizeCelestialBody(entry.celestialBody);
          this.celestialBodiesById.set(normalizedCelestialBody.id, normalizedCelestialBody);
          return {
            celestialBody: normalizedCelestialBody,
            distanceKm: entry.distanceKm
          };
        });
      } catch (error) {
        this.log(`[context] Error finding celestial bodies from DB: ${error.message}`);
      }
    } else {
      results = Array.from(this.celestialBodiesById.values())
        .map((celestialBody) => this.normalizeCelestialBody(celestialBody))
        .filter((celestialBody) => celestialBody.solarSystemId === solarSystemId)
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
    }

    if (!Number.isInteger(limit) || limit <= 0) {
      return results;
    }

    return results.slice(0, limit);
  }

  async getItemsNearPositionAsync(query) {
    const solarSystemId = this.toNonEmptyString(query?.solarSystemId);
    const positionKm = query?.positionKm;
    const distanceKm = query?.distanceKm;
    const itemType = this.toNonEmptyString(query?.itemType);
    const limit = query?.limit;

    if (!solarSystemId || !this.isTriple(positionKm) || !this.isFiniteNumber(distanceKm) || distanceKm < 0) {
      return [];
    }

    let results = [];

    if (this.databaseService) {
      try {
        const fromDb = await this.databaseService.findItemsNearPosition({
          solarSystemId,
          positionKm,
          distanceKm,
          itemType: itemType || undefined
        });

        results = fromDb.map((entry) => {
          const normalizedItem = this.normalizeItem(entry.item);
          this.itemsById.set(normalizedItem.id, normalizedItem);
          return {
            item: normalizedItem,
            distanceKm: entry.distanceKm
          };
        });
      } catch (error) {
        this.log(`[context] Error finding items from DB: ${error.message}`);
      }
    } else {
      results = Array.from(this.itemsById.values())
        .map((item) => this.normalizeItem(item))
        .filter((item) => {
          if (item.kinematics?.reference?.solarSystemId !== solarSystemId) {
            return false;
          }

          if (itemType && item.itemType !== itemType) {
            return false;
          }

          return true;
        })
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
    }

    if (!Number.isInteger(limit) || limit <= 0) {
      return results;
    }

    return results.slice(0, limit);
  }
}

module.exports = {
  MessageHandlerContext
};