'use strict';

const { LAUNCH_ITEM_RESPONSE_EVENT } = require('../model/launch-item');
const { INVALID_SESSION_EVENT, INVALID_SESSION_MESSAGE } = require('../model/session');

const EXPENDABLE_DART_DRONE_ITEM_TYPE = 'expendable-dart-drone';
const HOTKEY_VALUES = new Set([1, 2, 3, 4, 5]);
const MATERIAL_YIELD_MULTIPLIER_BY_RARITY = {
  Common: 2,
  Uncommon: 2,
  Rare: 2,
  Exotic: 2,
};
const MAX_YIELD_QUANTITY = 100;

class LaunchItemMessageHandler {
  constructor(context) {
    this.context = context;
  }

  isValidHotkey(value) {
    return Number.isInteger(value) && HOTKEY_VALUES.has(value);
  }

  /**
   * Resolve yielded material quantity from target asteroid mass and rarity.
   *
   * Formula:
   * - baseFromMass = max(1, round(estimatedMassKg / 5,000,000,000))
   * - rarity multiplier: all rarities = 2
   * - quantity = clamp(baseFromMass * multiplier, 1, 100)
   *
   * Distribution: ~1–100 over the range 2.5B–250B kg.
   * An asteroid at 250,000,000,000 kg yields the maximum of 100.
   */
  resolveYieldQuantity(targetCelestialBody) {
    const massKg = Number(targetCelestialBody?.physical?.estimatedMassKg);
    const rarity = this.context.toNonEmptyString(targetCelestialBody?.composition?.rarity);
    const multiplier = MATERIAL_YIELD_MULTIPLIER_BY_RARITY[rarity] || 1;
    const baseFromMass = Number.isFinite(massKg) ? Math.max(1, Math.round(massKg / 5000000000)) : 1;

    return Math.min(MAX_YIELD_QUANTITY, Math.max(1, baseFromMass * multiplier));
  }

  toRawMaterialItemType(material) {
    const normalized = this.context
      .toNonEmptyString(material)
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    return `raw-material-${normalized || 'unknown-composite'}`;
  }

  computeLaunchSeed(parsed) {
    const seedInput = [
      parsed.player.playerId,
      parsed.characterId,
      parsed.shipId,
      parsed.itemId,
      parsed.itemType,
      parsed.targetCelestialBodyId,
      parsed.targetCelestialBody.catalogId,
      parsed.targetCelestialBody.sourceScanId,
    ].join('|');

    let hash = 2166136261;
    for (let index = 0; index < seedInput.length; index += 1) {
      hash ^= seedInput.charCodeAt(index);
      hash = Math.imul(hash, 16777619) >>> 0;
    }

    return hash >>> 0;
  }

  async consumeLaunchedItem(parsed, now) {
    const updatedItem = await this.context.updateItemAsync(parsed.itemId, {
      state: 'destroyed',
      container: null,
      launchable: false,
      destroyedAt: parsed.item.destroyedAt || now,
      destroyedReason: `expended-on-target:${parsed.targetCelestialBodyId}`,
      updatedAt: now,
    });

    const nextShips = Array.isArray(parsed.character.ships)
      ? parsed.character.ships.map((ship) => {
          if (ship.id !== parsed.shipId) {
            return ship;
          }

          const nextInventory = Array.isArray(ship.inventory)
            ? ship.inventory.filter((reference) => reference.itemId !== parsed.itemId)
            : [];

          return {
            ...ship,
            inventory: nextInventory,
          };
        })
      : [];

    await this.context.updateCharacterAsync(parsed.player.playerName, parsed.characterId, {
      ships: nextShips,
    });

    return (
      updatedItem || {
        ...parsed.item,
        state: 'destroyed',
        launchable: false,
        destroyedAt: parsed.item.destroyedAt || now,
        destroyedReason: `expended-on-target:${parsed.targetCelestialBodyId}`,
        updatedAt: now,
        container: null,
      }
    );
  }

  async buildParsed(payload) {
    const playerName = this.context.toNonEmptyString(payload?.playerName);
    const characterId = this.context.toNonEmptyString(payload?.characterId);
    const shipId = this.context.toNonEmptyString(payload?.shipId);
    const targetCelestialBodyId = this.context.toNonEmptyString(payload?.targetCelestialBodyId);
    const itemId = this.context.toNonEmptyString(payload?.itemId);
    const itemType = this.context.toNonEmptyString(payload?.itemType);
    const hotkey = payload?.hotkey;

    if (
      !playerName ||
      !characterId ||
      !shipId ||
      !targetCelestialBodyId ||
      !itemId ||
      !itemType ||
      !this.isValidHotkey(hotkey)
    ) {
      return {
        error:
          'playerName, characterId, shipId, targetCelestialBodyId, hotkey, itemId, and itemType are required',
      };
    }

    const player = await this.context.ensurePlayerLoadedAsync(playerName);
    if (!player) {
      return { error: 'Player is not registered', playerName, characterId };
    }

    await this.context.getCharactersAsync(playerName);
    const character = this.context.findCharacter(playerName, characterId);
    if (!character) {
      return {
        error: 'Character is not in player list',
        playerName: player.playerName,
        characterId,
      };
    }

    const ship = Array.isArray(character.ships)
      ? character.ships.find((candidate) => candidate.id === shipId)
      : null;
    if (!ship) {
      return {
        error: 'Ship is not in character list',
        playerName: player.playerName,
        characterId,
      };
    }

    const inventory = Array.isArray(ship.inventory) ? ship.inventory : [];
    const inventoryReference = inventory.find((reference) => reference.itemId === itemId);
    if (!inventoryReference) {
      return {
        error: 'Item is not in ship inventory',
        playerName: player.playerName,
        characterId,
      };
    }

    const [item] = await this.context.getItemsByIdsAsync([itemId]);
    if (!item) {
      return {
        error: 'Launch item does not exist',
        playerName: player.playerName,
        characterId,
      };
    }

    if (this.context.toNonEmptyString(item.itemType) !== itemType) {
      return {
        error: 'itemType does not match launch item',
        playerName: player.playerName,
        characterId,
      };
    }

    if (!item.launchable) {
      return {
        error: 'Launch item is not launchable',
        playerName: player.playerName,
        characterId,
      };
    }

    if (item.state === 'destroyed') {
      return {
        error: 'Launch item is destroyed',
        playerName: player.playerName,
        characterId,
      };
    }

    const targetCelestialBody = await this.context.getCelestialBodyByIdAsync(targetCelestialBodyId);
    if (!targetCelestialBody) {
      return {
        error: 'Target celestial body does not exist',
        playerName: player.playerName,
        characterId,
      };
    }

    return {
      player,
      character,
      ship,
      item,
      hotkey,
      itemId,
      itemType,
      shipId,
      characterId,
      targetCelestialBody,
      targetCelestialBodyId,
    };
  }

  async resolveLaunch(parsed) {
    const now = this.context.getCurrentTimestamp();
    const launchSeed = this.computeLaunchSeed(parsed);
    const launchedItem = await this.consumeLaunchedItem(parsed, now);

    if (parsed.itemType !== EXPENDABLE_DART_DRONE_ITEM_TYPE) {
      return {
        success: true,
        message: `Launch completed with no effect for itemType: ${parsed.itemType}`,
        playerName: parsed.player.playerName,
        characterId: parsed.characterId,
        shipId: parsed.shipId,
        targetCelestialBodyId: parsed.targetCelestialBodyId,
        hotkey: parsed.hotkey,
        itemId: parsed.itemId,
        itemType: parsed.itemType,
        launchedItem,
        resolution: {
          outcome: 'no-effect',
          targetDestroyed: false,
          yieldedMaterials: [],
          yieldedItems: [],
          launchSeed,
        },
      };
    }

    const yieldedMaterials = [
      {
        material: parsed.targetCelestialBody.composition.material,
        rarity: parsed.targetCelestialBody.composition.rarity,
        quantity: this.resolveYieldQuantity(parsed.targetCelestialBody),
      },
    ];

    const yieldedItemsToCreate = yieldedMaterials.map((entry) => {
      const itemType = this.toRawMaterialItemType(entry.material);

      return {
        id: this.context.createId(),
        itemType,
        displayName: `${entry.material} (Raw Material)`,
        quantity: entry.quantity,
        state: 'contained',
        damageStatus: 'intact',
        container: {
          containerType: 'ship',
          containerId: parsed.shipId,
        },
        owningPlayerId: parsed.player.playerId,
        owningCharacterId: parsed.characterId,
        spatial: null,
        destroyedAt: null,
        destroyedReason: null,
        launchable: false,
        createdAt: now,
        updatedAt: now,
      };
    });

    const yieldedItems =
      yieldedItemsToCreate.length > 0 ? await this.context.addItemsAsync(yieldedItemsToCreate) : [];

    const debris = yieldedMaterials.map((entry) => ({
      material: entry.material,
      rarity: entry.rarity,
      quantity: entry.quantity,
      itemType: this.toRawMaterialItemType(entry.material),
    }));

    const destroyedTarget = {
      ...parsed.targetCelestialBody,
      state: 'destroyed',
      destroyedAt: now,
      destroyedReason: `impacted-by:${parsed.itemType}`,
      updatedAt: now,
      debrisSeed: launchSeed,
      debris,
    };

    await this.context.addOrUpdateCelestialBodyAsync(destroyedTarget);

    const refreshedCharacter = this.context.findCharacter(
      parsed.player.playerName,
      parsed.characterId
    );
    const nextShipsWithYield = Array.isArray(refreshedCharacter?.ships)
      ? refreshedCharacter.ships.map((ship) => {
          if (ship.id !== parsed.shipId) {
            return ship;
          }

          const existingInventory = Array.isArray(ship.inventory) ? ship.inventory : [];
          const yieldedReferences = yieldedItems.map((item) => ({
            itemId: item.id,
            itemType: item.itemType,
          }));

          return {
            ...ship,
            inventory: [...existingInventory, ...yieldedReferences],
          };
        })
      : [];

    await this.context.updateCharacterAsync(parsed.player.playerName, parsed.characterId, {
      ships: nextShipsWithYield,
    });

    return {
      success: true,
      message: 'Launch successful: target destroyed and materials yielded',
      playerName: parsed.player.playerName,
      characterId: parsed.characterId,
      shipId: parsed.shipId,
      targetCelestialBodyId: parsed.targetCelestialBodyId,
      hotkey: parsed.hotkey,
      itemId: parsed.itemId,
      itemType: parsed.itemType,
      launchedItem,
      resolution: {
        outcome: 'target-destroyed',
        targetDestroyed: true,
        yieldedMaterials,
        yieldedItems,
        targetCelestialBody: destroyedTarget,
        launchSeed,
      },
    };
  }

  async handle(socket, payload) {
    this.context.logHandlerMessage('launch-item-request', payload);

    if (!(await this.context.hasValidSessionAsync(payload))) {
      const response = { message: INVALID_SESSION_MESSAGE };
      socket.emit(INVALID_SESSION_EVENT, response);
      return response;
    }

    this.context.detachIdleGameCharacters();
    this.context.touchJoinedCharacters(payload);

    const parsed = await this.buildParsed(payload);
    if (parsed.error) {
      const response = {
        success: false,
        message: parsed.error,
        playerName: this.context.toNonEmptyString(parsed.playerName || payload?.playerName),
        characterId: this.context.toNonEmptyString(parsed.characterId || payload?.characterId),
        shipId: this.context.toNonEmptyString(payload?.shipId),
        targetCelestialBodyId: this.context.toNonEmptyString(payload?.targetCelestialBodyId),
        hotkey: this.isValidHotkey(payload?.hotkey) ? payload.hotkey : 1,
        itemId: this.context.toNonEmptyString(payload?.itemId),
        itemType: this.context.toNonEmptyString(payload?.itemType),
      };
      socket.emit(LAUNCH_ITEM_RESPONSE_EVENT, response);
      return response;
    }

    const response = await this.resolveLaunch(parsed);
    socket.emit(LAUNCH_ITEM_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  LaunchItemMessageHandler,
};
