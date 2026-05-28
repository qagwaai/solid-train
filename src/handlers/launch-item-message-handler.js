'use strict';

const { LAUNCH_ITEM_RESPONSE_EVENT } = require('../model/launch-item');
const { INVALID_SESSION_EVENT, INVALID_SESSION_MESSAGE } = require('../model/session');
const {
  ITEM_STATE,
  ITEM_DAMAGE_STATUS,
  ITEM_CONTAINER_TYPE,
} = require('../model/canonical-items');
const { isCanonicalRuntimeItemType } = require('../model/canonical-item-type-registry');
const {
  DEFAULT_STARTER_MISSION_ID,
  MISSION_CATALOG_IDS,
  MISSION_PREREQUISITES_BY_ID,
  MISSION_UNLOCK_SOURCE_STATUSES,
} = require('../model/mission');
const {
  resolveCorrelationId,
  normalizeRequestIdentity,
} = require('./correlation-metadata');

const EXPENDABLE_DART_DRONE_ITEM_TYPE = 'expendable-dart-drone';
const HOTKEY_VALUES = new Set([1, 2, 3, 4, 5]);
const MATERIAL_YIELD_MULTIPLIER_BY_RARITY = {
  Common: 2,
  Uncommon: 2,
  Rare: 2,
  Exotic: 2,
};
const MAX_YIELD_QUANTITY = 100;
const FALLBACK_SHIP_SPATIAL = {
  solarSystemId: 'sol',
  frame: 'barycentric',
  positionKm: { x: 0, y: 0, z: 0 },
  epochMs: 0,
};
const YIELD_MATERIAL_ITEM_TYPE_ALIASES = Object.freeze({
  'nickel-iron': 'iron',
  'platinum-ore': 'platinum',
  'cobalt-ore': 'cobalt',
  'iridium-vein': 'iridium',
  'palladium-core': 'palladium',
  silicate: 'silicon',
  carbonaceous: 'carbon',
  'basaltic-rock': 'iron',
  'crystalline-quartz': 'silicon',
});

class LaunchItemMessageHandler {
  /**
   * @param {Object} context
   */
  constructor(context) {
    this.context = context;
  }

  isValidHotkey(value) {
    return Number.isInteger(value) && HOTKEY_VALUES.has(value);
  }

  buildHydrationShipCandidate(ship) {
    const spatial = ship?.spatial;
    const hasValidSpatial =
      this.context.toNonEmptyString(spatial?.solarSystemId) &&
      this.context.toNonEmptyString(spatial?.frame) === 'barycentric' &&
      this.context.isTriple(spatial?.positionKm) &&
      Number.isFinite(Number(spatial?.epochMs));

    if (hasValidSpatial) {
      return ship;
    }

    return {
      ...ship,
      spatial: FALLBACK_SHIP_SPATIAL,
    };
  }

  normalizeRequestIdentity(requestIdentity, payload) {
    return normalizeRequestIdentity(
      {
        requestIdentity,
        operation: 'launch-item',
        entityTypeCandidates: [payload?.itemType, 'unknown'],
        containerIdCandidates: [payload?.shipId, '-'],
      },
      this.context.toNonEmptyString.bind(this.context)
    );
  }

  logLaunchDiag(stage, correlationId, details = {}) {
    const detailsJson = JSON.stringify(details);
    this.context.log(
      `[launch-item-diag] stage=${stage} correlationId=${this.context.toNonEmptyString(correlationId) || '-'} details=${detailsJson}`
    );
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

  normalizeMaterialToken(material) {
    return this.context
      .toNonEmptyString(material)
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  resolveYieldItemType(material) {
    const normalizedMaterial = this.normalizeMaterialToken(material);
    const aliasedItemType = YIELD_MATERIAL_ITEM_TYPE_ALIASES[normalizedMaterial] || normalizedMaterial;

    if (!aliasedItemType || aliasedItemType.startsWith('raw-material-')) {
      return null;
    }

    return isCanonicalRuntimeItemType(aliasedItemType) ? aliasedItemType : null;
  }

  resolveYieldMaterialItemTypes(yieldedMaterials) {
    return yieldedMaterials.map((entry) => {
      const itemType = this.resolveYieldItemType(entry.material);

      return {
        ...entry,
        itemType,
      };
    });
  }

  buildYieldMaterialFailureResponse(parsed, correlationId, requestIdentity, unresolvedEntries) {
    const unsupportedMaterials = unresolvedEntries
      .map((entry) => this.context.toNonEmptyString(entry.material))
      .filter((value) => Boolean(value));

    return {
      success: false,
      message: `Unsupported launch yield material(s): ${unsupportedMaterials.join(', ') || 'unknown'}`,
      playerName: parsed.player.playerName,
      correlationId,
      requestIdentity,
      characterId: parsed.characterId,
      shipId: parsed.shipId,
      targetCelestialBodyId: parsed.targetCelestialBodyId,
      hotkey: parsed.hotkey,
      itemId: parsed.itemId,
      itemType: parsed.itemType,
    };
  }

  async applyStarterMissionProgressionAsync(parsed, now) {
    const missionId = this.context.toNonEmptyString(parsed?.targetCelestialBody?.missionId);
    if (missionId !== DEFAULT_STARTER_MISSION_ID) {
      return null;
    }

    const missions = await this.context.getMissionsAsync(parsed.player.playerName, parsed.characterId);
    const missionsById = new Map(
      (Array.isArray(missions) ? missions : []).map((mission) => [mission.missionId, mission])
    );
    const existingStarterMission = missionsById.get(DEFAULT_STARTER_MISSION_ID) || {};
    const completedStarterMission = {
      ...existingStarterMission,
      missionId: DEFAULT_STARTER_MISSION_ID,
      status: 'completed',
      startedAt: this.context.toNonEmptyString(existingStarterMission.startedAt) || now,
      completedAt: this.context.toNonEmptyString(existingStarterMission.completedAt) || now,
      updatedAt: now,
    };

    await this.context.addOrUpdateMissionAsync(
      parsed.player.playerName,
      parsed.characterId,
      completedStarterMission
    );
    missionsById.set(DEFAULT_STARTER_MISSION_ID, completedStarterMission);

    const unlockedMissionIds = [];
    for (const candidateMissionId of MISSION_CATALOG_IDS) {
      if (missionsById.has(candidateMissionId)) {
        continue;
      }

      const prerequisites = MISSION_PREREQUISITES_BY_ID[candidateMissionId] || [];
      const allSatisfied = prerequisites.every((prerequisiteId) => {
        const prerequisite = missionsById.get(prerequisiteId);
        return prerequisite && MISSION_UNLOCK_SOURCE_STATUSES.has(prerequisite.status);
      });

      if (!allSatisfied) {
        continue;
      }

      const unlockedMission = {
        missionId: candidateMissionId,
        status: 'available',
        updatedAt: now,
      };
      await this.context.addOrUpdateMissionAsync(
        parsed.player.playerName,
        parsed.characterId,
        unlockedMission
      );
      missionsById.set(candidateMissionId, unlockedMission);
      unlockedMissionIds.push(candidateMissionId);
    }

    return {
      missionId: completedStarterMission.missionId,
      status: completedStarterMission.status,
      completedAt: completedStarterMission.completedAt,
      unlockedMissionIds,
    };
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

  createSeededRandom(seed) {
    let state = seed >>> 0;
    return () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  buildDebrisSpatial(targetCelestialBody, launchSeed, index, now) {
    const targetSpatial = targetCelestialBody?.spatial;
    const targetPositionKm = targetSpatial?.positionKm;
    if (!this.context.isTriple(targetPositionKm)) {
      return null;
    }

    const random = this.createSeededRandom((launchSeed + (index + 1) * 2654435761) >>> 0);
    const radiusKm = 10 + random() * 40;
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(2 * random() - 1);

    const offsetX = radiusKm * Math.sin(phi) * Math.cos(theta);
    const offsetY = radiusKm * Math.sin(phi) * Math.sin(theta);
    const offsetZ = radiusKm * Math.cos(phi);

    return {
      solarSystemId: targetSpatial.solarSystemId,
      frame: 'barycentric',
      positionKm: {
        x: targetPositionKm.x + offsetX,
        y: targetPositionKm.y + offsetY,
        z: targetPositionKm.z + offsetZ,
      },
      epochMs: Date.parse(now),
    };
  }

  buildDebrisMotion(launchSeed, index) {
    const random = this.createSeededRandom((launchSeed + (index + 1) * 1597334677) >>> 0);
    const speed = 0.005 + random() * 0.02;
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(2 * random() - 1);

    return {
      velocityKmPerSec: {
        x: speed * Math.sin(phi) * Math.cos(theta),
        y: speed * Math.sin(phi) * Math.sin(theta),
        z: speed * Math.cos(phi),
      },
    };
  }

  async consumeLaunchedItem(parsed, now, correlationId = '-') {
    this.logLaunchDiag('consume-mutation-write', correlationId, {
      phase: 'begin',
      playerName: parsed.player.playerName,
      characterId: parsed.characterId,
      shipId: parsed.shipId,
      itemId: parsed.itemId,
      itemType: parsed.itemType,
    });

    const updatedItem = await this.context.updateItemAsync(parsed.itemId, {
      state: ITEM_STATE.DESTROYED,
      container: null,
      launchable: false,
      destroyedAt: parsed.item.destroyedAt || now,
      destroyedReason: `expended-on-target:${parsed.targetCelestialBodyId}`,
      updatedAt: now,
    });

    const effectiveUpdatedItem =
      updatedItem || {
        ...parsed.item,
        state: ITEM_STATE.DESTROYED,
        launchable: false,
        destroyedAt: parsed.item.destroyedAt || now,
        destroyedReason: `expended-on-target:${parsed.targetCelestialBodyId}`,
        updatedAt: now,
        container: null,
      };

    await this.context.syncShipInventoryReferenceForItemAsync(
      parsed.player.playerName,
      parsed.item,
      effectiveUpdatedItem,
      {
        correlationId,
      }
    );

    this.logLaunchDiag('consume-mutation-write', correlationId, {
      phase: 'end',
      playerName: parsed.player.playerName,
      characterId: parsed.characterId,
      shipId: parsed.shipId,
      itemId: effectiveUpdatedItem.id,
      itemState: effectiveUpdatedItem.state,
      containerType: this.context.toNonEmptyString(effectiveUpdatedItem?.container?.containerType),
      containerId: this.context.toNonEmptyString(effectiveUpdatedItem?.container?.containerId),
      launchable: Boolean(effectiveUpdatedItem.launchable),
    });

    return effectiveUpdatedItem;
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

    const hydratedShip = await this.context.hydrateShipAsync(this.buildHydrationShipCandidate(ship), {
      playerName: player.playerName,
      characterId,
      correlationId: this.context.toNonEmptyString(payload?.correlationId) || '-',
      owningPlayerId: this.context.toNonEmptyString(player.playerId),
      owningCharacterId: characterId,
    });
    const projectedInventory = Array.isArray(hydratedShip?.inventory) ? hydratedShip.inventory : [];
    const projectedItem = projectedInventory.find((candidate) => candidate?.id === itemId);
    this.logLaunchDiag('membership-check', this.context.toNonEmptyString(payload?.correlationId) || '-', {
      source: 'canonical-ship-projection',
      playerName: player.playerName,
      characterId,
      shipId,
      itemId,
      projectedInventoryItemIds: projectedInventory.map((candidate) =>
        this.context.toNonEmptyString(candidate?.id)
      ),
      hasProjectedMembership: Boolean(projectedItem),
    });
    if (!projectedItem) {
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

    if (item.state === ITEM_STATE.DESTROYED) {
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

  async resolveLaunch(parsed, correlationId = 'missing-correlation-id', requestIdentity = null) {
    const now = this.context.getCurrentTimestamp();
    const launchSeed = this.computeLaunchSeed(parsed);
    const shouldDeployDebris = true;

    if (parsed.itemType !== EXPENDABLE_DART_DRONE_ITEM_TYPE) {
      const launchedItem = await this.consumeLaunchedItem(parsed, now, correlationId);
      return {
        success: true,
        message: `Launch completed with no effect for itemType: ${parsed.itemType}`,
        playerName: parsed.player.playerName,
        correlationId,
        requestIdentity,
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
    const yieldedMaterialEntries = this.resolveYieldMaterialItemTypes(yieldedMaterials);
    const unresolvedEntries = yieldedMaterialEntries.filter((entry) => !entry.itemType);
    if (unresolvedEntries.length > 0) {
      this.logLaunchDiag('yield-material-mapping-failed', correlationId, {
        playerName: parsed.player.playerName,
        characterId: parsed.characterId,
        shipId: parsed.shipId,
        targetCelestialBodyId: parsed.targetCelestialBodyId,
        unresolvedMaterials: unresolvedEntries.map((entry) => entry.material),
      });
      return this.buildYieldMaterialFailureResponse(
        parsed,
        correlationId,
        requestIdentity,
        unresolvedEntries
      );
    }

    const launchedItem = await this.consumeLaunchedItem(parsed, now, correlationId);
    const postConsumeShip = await this.context.hydrateShipAsync(
      this.buildHydrationShipCandidate(parsed.ship),
      {
        playerName: parsed.player.playerName,
        characterId: parsed.characterId,
        correlationId,
        owningPlayerId: this.context.toNonEmptyString(parsed.player.playerId),
        owningCharacterId: parsed.characterId,
      }
    );
    const postConsumeInventoryIds = Array.isArray(postConsumeShip?.inventory)
      ? postConsumeShip.inventory
          .map((item) => this.context.toNonEmptyString(item?.id))
          .filter((value) => Boolean(value))
      : [];
    this.logLaunchDiag('projection-publish', correlationId, {
      source: 'canonical-ship-projection',
      phase: 'post-consume',
      playerName: parsed.player.playerName,
      characterId: parsed.characterId,
      shipId: parsed.shipId,
      consumedItemId: parsed.itemId,
      hasConsumedItemId: postConsumeInventoryIds.includes(parsed.itemId),
      projectedInventoryItemIds: postConsumeInventoryIds,
    });

    const yieldedItemsToCreate = yieldedMaterialEntries.map((entry, index) => {
      const spatial = shouldDeployDebris
        ? this.buildDebrisSpatial(parsed.targetCelestialBody, launchSeed, index, now)
        : null;
      const isDeployedDebris = Boolean(spatial);
      const motion = isDeployedDebris ? this.buildDebrisMotion(launchSeed, index) : null;

      return {
        id: this.context.createId(),
        itemType: entry.itemType,
        displayName: `${entry.material} (Raw Material)`,
        quantity: entry.quantity,
        state: isDeployedDebris ? ITEM_STATE.DEPLOYED : ITEM_STATE.CONTAINED,
        damageStatus: ITEM_DAMAGE_STATUS.INTACT,
        container: isDeployedDebris
          ? null
          : {
              containerType: ITEM_CONTAINER_TYPE.SHIP,
              containerId: parsed.shipId,
            },
        owningPlayerId: parsed.player.playerId,
        owningCharacterId: parsed.characterId,
        spatial,
        motion,
        destroyedAt: null,
        destroyedReason: null,
        launchable: false,
        createdAt: now,
        updatedAt: now,
      };
    });

    const yieldedItems =
      yieldedItemsToCreate.length > 0 ? await this.context.addItemsAsync(yieldedItemsToCreate) : [];

    const debris = yieldedMaterialEntries.map((entry) => ({
      material: entry.material,
      rarity: entry.rarity,
      quantity: entry.quantity,
      itemType: entry.itemType,
    }));

    const destroyedTarget = {
      ...parsed.targetCelestialBody,
      state: ITEM_STATE.DESTROYED,
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
          const yieldedReferences = yieldedItems
            .filter((item) => item.state === ITEM_STATE.CONTAINED)
            .map((item) => ({
              itemId: item.id,
              itemType: item.itemType,
            }));

          return {
            ...ship,
            inventory: [...existingInventory, ...yieldedReferences],
          };
        })
      : [];

    await this.context.updateCharacterAsync(
      parsed.player.playerName,
      parsed.characterId,
      {
        ships: nextShipsWithYield,
      },
      {
        correlationId,
      }
    );

    const missionProgression = await this.applyStarterMissionProgressionAsync(parsed, now);

    return {
      success: true,
      message: 'Launch successful: target destroyed and materials yielded',
      playerName: parsed.player.playerName,
      correlationId,
      requestIdentity,
      characterId: parsed.characterId,
      shipId: parsed.shipId,
      targetCelestialBodyId: parsed.targetCelestialBodyId,
      hotkey: parsed.hotkey,
      itemId: parsed.itemId,
      itemType: parsed.itemType,
      launchedItem,
      ...(missionProgression ? { missionProgression } : {}),
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

  /**
   * Validate launch payload, apply launch side effects, and emit launch-item-response.
   * @param {import('socket.io').Socket} socket
   * @param {Object} payload
   * @returns {Promise<Object>}
   */
  async handle(socket, payload) {
    this.context.logHandlerMessage('launch-item-request', payload);
    const correlationId = resolveCorrelationId(
      payload,
      this.context.toNonEmptyString.bind(this.context)
    );
    const requestIdentity = this.normalizeRequestIdentity(payload?.requestIdentity, payload);
    this.logLaunchDiag('request-ingress', correlationId, {
      playerName: this.context.toNonEmptyString(payload?.playerName),
      characterId: this.context.toNonEmptyString(payload?.characterId),
      shipId: this.context.toNonEmptyString(payload?.shipId),
      targetCelestialBodyId: this.context.toNonEmptyString(payload?.targetCelestialBodyId),
      itemId: this.context.toNonEmptyString(payload?.itemId),
      itemType: this.context.toNonEmptyString(payload?.itemType),
    });

    if (!(await this.context.hasValidSessionAsync(payload))) {
      const response = { message: INVALID_SESSION_MESSAGE };
      socket.emit(INVALID_SESSION_EVENT, response);
      return response;
    }

    this.context.detachIdleGameCharacters();
    this.context.touchJoinedCharacters(payload);

    try {
      const parsed = await this.buildParsed(payload);
      if (parsed.error) {
        this.logLaunchDiag('validation-failed', correlationId, {
          playerName: this.context.toNonEmptyString(parsed.playerName || payload?.playerName),
          characterId: this.context.toNonEmptyString(parsed.characterId || payload?.characterId),
          shipId: this.context.toNonEmptyString(payload?.shipId),
          itemId: this.context.toNonEmptyString(payload?.itemId),
          error: parsed.error,
        });
        const response = {
          success: false,
          message: parsed.error,
          playerName: this.context.toNonEmptyString(parsed.playerName || payload?.playerName),
          correlationId,
          requestIdentity,
          characterId: this.context.toNonEmptyString(parsed.characterId || payload?.characterId),
          shipId: this.context.toNonEmptyString(payload?.shipId),
          targetCelestialBodyId: this.context.toNonEmptyString(payload?.targetCelestialBodyId),
          hotkey: this.isValidHotkey(payload?.hotkey) ? payload.hotkey : 1,
          itemId: this.context.toNonEmptyString(payload?.itemId),
          itemType: this.context.toNonEmptyString(payload?.itemType),
        };
        this.logLaunchDiag('response-emit', correlationId, {
          success: response.success,
          message: response.message,
        });
        socket.emit(LAUNCH_ITEM_RESPONSE_EVENT, response);
        return response;
      }

      this.logLaunchDiag('validation-succeeded', correlationId, {
        playerName: parsed.player.playerName,
        characterId: parsed.characterId,
        shipId: parsed.shipId,
        itemId: parsed.itemId,
        itemType: parsed.itemType,
      });

      const response = await this.resolveLaunch(parsed, correlationId, requestIdentity);
      this.logLaunchDiag('response-emit', correlationId, {
        success: Boolean(response?.success),
        message: this.context.toNonEmptyString(response?.message),
      });
      socket.emit(LAUNCH_ITEM_RESPONSE_EVENT, response);
      return response;
    } catch (error) {
      this.context.log(`[launch-item-handler] Unexpected launch failure: ${error.message}`);
      const response = {
        success: false,
        message: 'Launch failed: internal runtime error',
        playerName: this.context.toNonEmptyString(payload?.playerName),
        correlationId,
        requestIdentity,
        characterId: this.context.toNonEmptyString(payload?.characterId),
        shipId: this.context.toNonEmptyString(payload?.shipId),
        targetCelestialBodyId: this.context.toNonEmptyString(payload?.targetCelestialBodyId),
        hotkey: this.isValidHotkey(payload?.hotkey) ? payload.hotkey : 1,
        itemId: this.context.toNonEmptyString(payload?.itemId),
        itemType: this.context.toNonEmptyString(payload?.itemType),
      };
      this.logLaunchDiag('exception', correlationId, {
        playerName: response.playerName,
        characterId: response.characterId,
        shipId: response.shipId,
        itemId: response.itemId,
        error: error.message,
      });
      this.logLaunchDiag('response-emit', correlationId, {
        success: false,
        message: response.message,
      });
      socket.emit(LAUNCH_ITEM_RESPONSE_EVENT, response);
      return response;
    }
  }
}

module.exports = {
  LaunchItemMessageHandler,
};
