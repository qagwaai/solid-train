'use strict';

const { SHIP_UPSERT_RESPONSE_EVENT } = require('../model/ship-upsert');
const { INVALID_SESSION_EVENT, INVALID_SESSION_MESSAGE } = require('../model/session');
const {
  ITEM_STATE,
  ITEM_DAMAGE_STATUS,
  ITEM_DAMAGE_STATUS_VALUES,
} = require('../model/canonical-items');
const { normalizeOwnership } = require('./context/ship-ownership');

class ShipUpsertMessageHandler {
  /**
   * @param {Object} context
   */
  constructor(context) {
    this.context = context;
  }

  findShipAcrossAllCharacters(shipId) {
    const normalizedShipId = this.context.toNonEmptyString(shipId);
    if (!normalizedShipId) {
      return null;
    }

    for (const [normalizedPlayerName, characters] of this.context.charactersByPlayer.entries()) {
      if (!Array.isArray(characters)) {
        continue;
      }

      for (const character of characters) {
        const ships = Array.isArray(character?.ships) ? character.ships : [];
        const ship = ships.find(
          (entry) => this.context.toNonEmptyString(entry?.id) === normalizedShipId
        );
        if (ship) {
          return {
            normalizedPlayerName,
            characterId: this.context.toNonEmptyString(character?.id),
            ship,
          };
        }
      }
    }

    return null;
  }

  buildOwnershipFailure(reason, message, playerName, characterId) {
    return {
      success: false,
      reason,
      message,
      playerName,
      characterId,
    };
  }

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

  normalizeSpatial(spatial) {
    if (!spatial) return null;
    const solarSystemId = this.context.toNonEmptyString(spatial.solarSystemId);
    if (!solarSystemId) return null;
    if (spatial.frame !== 'barycentric') return null;
    if (!this.isTriple(spatial.positionKm)) return null;
    if (!this.isFiniteNumber(spatial.epochMs)) return null;
    return {
      solarSystemId,
      frame: 'barycentric',
      positionKm: { x: spatial.positionKm.x, y: spatial.positionKm.y, z: spatial.positionKm.z },
      epochMs: spatial.epochMs,
    };
  }

  normalizeMotion(motion) {
    if (!motion) return null;
    if (!this.isTriple(motion.velocityKmPerSec)) return null;
    return {
      velocityKmPerSec: {
        x: motion.velocityKmPerSec.x,
        y: motion.velocityKmPerSec.y,
        z: motion.velocityKmPerSec.z,
      },
    };
  }

  normalizeInventoryReferences(inventory) {
    if (!Array.isArray(inventory)) {
      return null;
    }

    const references = [];
    for (const entry of inventory) {
      const fromCanonical = this.context.normalizeInventoryItemReference(entry);
      if (fromCanonical) {
        references.push(fromCanonical);
        continue;
      }

      const fromHydrated = this.context.normalizeInventoryItemReference({
        itemId: this.context.toNonEmptyString(entry?.id),
        itemType: this.context.toNonEmptyString(entry?.itemType),
      });
      if (fromHydrated) {
        references.push(fromHydrated);
        continue;
      }

      return null;
    }

    return references;
  }

  normalizeDamageProfile(raw) {
    const overallStatus = raw?.overallStatus;
    if (!ITEM_DAMAGE_STATUS_VALUES.includes(overallStatus)) {
      return {
        error: 'damageProfile.overallStatus must be one of: intact, damaged, disabled, destroyed',
      };
    }

    const summary = this.context.toNonEmptyString(raw.summary);
    if (!summary) {
      return { error: 'damageProfile.summary must be a non-empty string' };
    }

    const origin = raw.origin;
    if (!['cold-boot-scripted', 'combat', 'wear', 'unknown'].includes(origin)) {
      return {
        error: 'damageProfile.origin must be one of: cold-boot-scripted, combat, wear, unknown',
      };
    }

    const updatedAt = this.context.toNonEmptyString(raw.updatedAt);
    if (!updatedAt) {
      return { error: 'damageProfile.updatedAt must be a non-empty string' };
    }

    if (!Array.isArray(raw.systems)) {
      return { error: 'damageProfile.systems must be an array' };
    }

    const systems = [];
    for (const sys of raw.systems) {
      const code = this.context.toNonEmptyString(sys?.code);
      if (!code) {
        return { error: 'damageProfile.systems[].code must be a non-empty string' };
      }
      const label = this.context.toNonEmptyString(sys.label);
      if (!label) {
        return { error: 'damageProfile.systems[].label must be a non-empty string' };
      }
      const severity = sys.severity;
      if (!['minor', 'major', 'critical'].includes(severity)) {
        return { error: 'damageProfile.systems[].severity must be one of: minor, major, critical' };
      }
      const sysSummary = this.context.toNonEmptyString(sys.summary);
      if (!sysSummary) {
        return { error: 'damageProfile.systems[].summary must be a non-empty string' };
      }
      if (!Number.isInteger(sys.repairPriority)) {
        return { error: 'damageProfile.systems[].repairPriority must be an integer' };
      }
      systems.push({
        code,
        label,
        severity,
        summary: sysSummary,
        repairPriority: sys.repairPriority,
      });
    }

    return { overallStatus, summary, origin, updatedAt, systems };
  }

  isRepairTransition(existingShip, nextShip, hasDamageProfilePatch) {
    if (!hasDamageProfilePatch) {
      return false;
    }

    const previousStatus = this.context
      .toNonEmptyString(existingShip?.damageProfile?.overallStatus)
      .toLowerCase();
    const nextStatus = this.context
      .toNonEmptyString(nextShip?.damageProfile?.overallStatus)
      .toLowerCase();

    return nextStatus === ITEM_DAMAGE_STATUS.INTACT && previousStatus !== ITEM_DAMAGE_STATUS.INTACT;
  }

  async consumeRepairHullPatchKitIfNeeded({
    response,
    existingShip,
    hasInventoryPatch,
    hasDamageProfilePatch,
    correlationId,
  }) {
    if (hasInventoryPatch) {
      return;
    }

    if (!this.isRepairTransition(existingShip, response.ship, hasDamageProfilePatch)) {
      return;
    }

    const currentInventory = Array.isArray(response.ship?.inventory) ? response.ship.inventory : [];
    const hullPatchIndex = currentInventory.findIndex(
      (entry) => this.context.toNonEmptyString(entry?.itemType) === 'hull-patch-kit'
    );

    if (hullPatchIndex < 0) {
      this.context.log(
        `[ship-upsert-diag] repair-auto-consume correlationId=${correlationId} player=${response.playerName} characterId=${response.characterId} shipId=${response.ship.id} action=no-kit-found`
      );
      return;
    }

    const hullPatchRef = currentInventory[hullPatchIndex];
    const hullPatchItemId = this.context.toNonEmptyString(hullPatchRef?.itemId);
    const nextInventory = [
      ...currentInventory.slice(0, hullPatchIndex),
      ...currentInventory.slice(hullPatchIndex + 1),
    ];
    response.ship.inventory = nextInventory;

    this.context.log(
      `[ship-upsert-diag] repair-auto-consume correlationId=${correlationId} player=${response.playerName} characterId=${response.characterId} shipId=${response.ship.id} consumedItemId=${hullPatchItemId || '-'} action=remove-inventory-ref`
    );

    if (!hullPatchItemId) {
      return;
    }

    const [existingItem] = await this.context.getItemsByIdsAsync([hullPatchItemId]);
    if (!existingItem) {
      this.context.log(
        `[ship-upsert-diag] repair-auto-consume correlationId=${correlationId} player=${response.playerName} characterId=${response.characterId} shipId=${response.ship.id} consumedItemId=${hullPatchItemId} action=item-not-found`
      );
      return;
    }

    const now = this.context.getCurrentTimestamp();
    const updatedItem = await this.context.updateItemAsync(hullPatchItemId, {
      state: ITEM_STATE.DESTROYED,
      damageStatus: ITEM_DAMAGE_STATUS.DESTROYED,
      container: null,
      destroyedAt: existingItem.destroyedAt || now,
      destroyedReason: existingItem.destroyedReason || 'consumed-by:repair',
      updatedAt: now,
    });

    if (updatedItem) {
      try {
        await this.context.syncShipInventoryReferenceForItemAsync(
          response.playerName,
          existingItem,
          updatedItem,
          {
            correlationId,
          }
        );
      } catch (error) {
        this.context.log(
          `[ship-upsert-diag] repair-auto-consume correlationId=${correlationId} player=${response.playerName} characterId=${response.characterId} shipId=${response.ship.id} consumedItemId=${hullPatchItemId} action=sync-warning error=${error.message}`
        );
      }
    }
  }

  /**
   * Validate ship-upsert payload and produce canonical response payload.
   * @param {Object} payload
   * @returns {Object}
   */
  buildResponse(payload) {
    const playerName = this.context.toNonEmptyString(payload?.playerName);
    const characterId = this.context.toNonEmptyString(payload?.characterId);
    const shipId = this.context.toNonEmptyString(payload?.ship?.id);
    const shipName =
      this.context.toNonEmptyString(payload?.ship?.shipName) ||
      this.context.toNonEmptyString(payload?.ship?.name);
    const statusRaw = payload?.ship?.status;
    const hasStatusKey = payload?.ship != null && 'status' in payload.ship;
    const hasInventoryKey = payload?.ship != null && 'inventory' in payload.ship;
    const hasDamageProfileKey = payload?.ship != null && 'damageProfile' in payload.ship;
    const hasOwnershipKey = payload?.ship != null && 'ownership' in payload.ship;
    const model = this.context.toNonEmptyString(payload?.ship?.model);
    const tierPayload = payload?.ship?.tier;
    const hasTier = tierPayload !== undefined && tierPayload !== null;
    const tier =
      hasTier && Number.isInteger(tierPayload) && tierPayload >= 1 && tierPayload <= 10
        ? tierPayload
        : null;
    const hasSpatial = Boolean(payload?.ship?.spatial);
    const hasMotion = Boolean(payload?.ship?.motion);
    const spatial = this.normalizeSpatial(payload?.ship?.spatial);
    const motion = hasMotion ? this.normalizeMotion(payload?.ship?.motion) : undefined;
    const hasLaunchable = payload?.ship != null && 'launchable' in payload.ship;
    const launchable = hasLaunchable
      ? payload.ship.launchable != null
        ? Boolean(payload.ship.launchable)
        : null
      : null;

    const inventoryReferences = hasInventoryKey
      ? this.normalizeInventoryReferences(payload?.ship?.inventory)
      : undefined;

    if (!playerName || !characterId || !shipId) {
      return {
        success: false,
        message: 'playerName, characterId, and ship.id are required',
        playerName,
        characterId,
      };
    }

    if (payload?.ship?.location !== undefined) {
      return {
        success: false,
        message: "ShipUpsert: legacy field 'location' is not supported. Use 'spatial' instead.",
        playerName,
        characterId,
      };
    }

    if (payload?.ship?.kinematics !== undefined) {
      return {
        success: false,
        message: "ShipUpsert: legacy field 'kinematics' is not supported. Use 'motion' instead.",
        playerName,
        characterId,
      };
    }

    if (
      !hasSpatial &&
      !hasMotion &&
      !model &&
      !hasTier &&
      !hasStatusKey &&
      !hasDamageProfileKey &&
      !hasInventoryKey
    ) {
      return {
        success: false,
        message:
          'ship.spatial, ship.motion, ship.model, ship.inventory, and/or ship.tier is required',
        playerName,
        characterId,
      };
    }

    if (hasInventoryKey && inventoryReferences === null) {
      return {
        success: false,
        message:
          'ship.inventory must be an array of item references ({ itemId, itemType }) or hydrated item rows ({ id, itemType })',
        playerName,
        characterId,
      };
    }

    if (hasTier && tier === null) {
      return {
        success: false,
        message: 'ship.tier must be an integer between 1 and 10',
        playerName,
        characterId,
      };
    }

    if ((hasSpatial && !spatial) || (hasMotion && !motion)) {
      return {
        success: false,
        message: 'ship spatial/motion payload is invalid',
        playerName,
        characterId,
      };
    }

    if (hasStatusKey && typeof statusRaw !== 'string') {
      return {
        success: false,
        message: 'ship.status must be a string',
        playerName,
        characterId,
      };
    }

    const status = hasStatusKey ? statusRaw.trim() || null : undefined;

    let normalizedDamageProfile;
    if (hasDamageProfileKey) {
      if (payload.ship.damageProfile === null) {
        normalizedDamageProfile = null;
      } else {
        const validation = this.normalizeDamageProfile(payload.ship.damageProfile);
        if (validation?.error) {
          return {
            success: false,
            message: validation.error,
            playerName,
            characterId,
          };
        }
        normalizedDamageProfile = validation;
      }
    }

    const player = this.context.getPlayer(playerName);
    if (!player) {
      return {
        success: false,
        message: 'Player is not registered',
        playerName,
        characterId,
      };
    }

    const character = this.context.findCharacter(playerName, characterId);
    if (!character) {
      return {
        success: false,
        message: 'Character is not in player list',
        playerName: player.playerName,
        characterId,
      };
    }

    const existingShip = Array.isArray(character.ships)
      ? character.ships.find((ship) => ship.id === shipId)
      : null;

    if (!existingShip) {
      const locatedElsewhere = this.findShipAcrossAllCharacters(shipId);
      if (locatedElsewhere) {
        return this.buildOwnershipFailure(
          'SHIP_OWNERSHIP_MISMATCH',
          'Ship ownership mismatch for requested mutation',
          player.playerName,
          characterId
        );
      }
      // Allow adding a new ship with ownerType 'unknown' (and no playerId/characterId/npcId)
      const normalizedOwnership = hasOwnershipKey
        ? normalizeOwnership(this.context, payload.ship.ownership)
        : null;
      if (
        normalizedOwnership &&
        normalizedOwnership.ownerType === 'unknown' &&
        !normalizedOwnership.playerId &&
        !normalizedOwnership.characterId &&
        !normalizedOwnership.npcId
      ) {
        const newShip = {
          ...payload.ship,
          ownership: { ...normalizedOwnership },
        };
        if (!Array.isArray(character.ships)) character.ships = [];
        character.ships.push(newShip);
        const response = {
          success: true,
          message: 'Ship added successfully',
          playerName: player.playerName,
          characterId,
          ship: newShip,
        };
        if (arguments[0] && typeof arguments[0].emit === 'function') {
          arguments[0].emit(SHIP_UPSERT_RESPONSE_EVENT, response);
        }
        return response;
      }
      return {
        success: false,
        message: 'Ship is not in character list',
        playerName: player.playerName,
        characterId,
      };
    }

    const existingOwnershipValidation = normalizeOwnership(this.context, existingShip.ownership);
    if (existingOwnershipValidation.error) {
      return this.buildOwnershipFailure(
        'OWNERSHIP_VALIDATION_FAILED',
        existingOwnershipValidation.error,
        player.playerName,
        characterId
      );
    }
    const existingOwnership = existingOwnershipValidation;

    let nextOwnership = {
      ownerType: existingOwnership.ownerType,
      playerId: existingOwnership.playerId,
      characterId: existingOwnership.characterId,
      npcId: existingOwnership.npcId,
      factionId: existingOwnership.factionId,
    };

    if (hasOwnershipKey) {
      const normalizedOwnership = normalizeOwnership(this.context, payload.ship.ownership);
      if (normalizedOwnership.error) {
        const reason = normalizedOwnership.error.includes('must not include')
          ? 'OWNERSHIP_CONFLICT'
          : 'OWNERSHIP_VALIDATION_FAILED';
        return this.buildOwnershipFailure(
          reason,
          normalizedOwnership.error,
          player.playerName,
          characterId
        );
      }

      if (
        existingOwnership.ownerType === 'unknown' &&
        normalizedOwnership.ownerType === 'player-character' &&
        !this.context.toNonEmptyString(normalizedOwnership.claimToken)
      ) {
        return this.buildOwnershipFailure(
          'OWNERSHIP_CLAIM_TOKEN_REQUIRED',
          'Ownership transition unknown -> player-character requires claimToken',
          player.playerName,
          characterId
        );
      }

      nextOwnership = {
        ownerType: normalizedOwnership.ownerType,
        playerId: normalizedOwnership.playerId,
        characterId: normalizedOwnership.characterId,
        npcId: normalizedOwnership.npcId,
        factionId: normalizedOwnership.factionId,
      };
    }

    const nextShip = {
      ...existingShip,
      id: shipId,
      shipName: shipName || existingShip.shipName || existingShip.name || '',
      status: hasStatusKey ? status : (existingShip.status ?? null),
      model: model || existingShip.model,
      tier: tier !== null ? tier : existingShip.tier,
      spatial: spatial || existingShip.spatial,
      motion: hasMotion ? motion || null : existingShip.motion,
      inventory: hasInventoryKey ? inventoryReferences : existingShip.inventory,
      launchable:
        hasLaunchable && launchable !== null
          ? launchable
          : existingShip.launchable != null
            ? existingShip.launchable
            : true,
      damageProfile: hasDamageProfileKey
        ? normalizedDamageProfile
        : (existingShip.damageProfile ?? null),
      ownership: nextOwnership,
    };
    delete nextShip.location;
    delete nextShip.kinematics;

    return {
      success: true,
      message: 'Ship updated successfully',
      playerName: player.playerName,
      characterId,
      ship: { ...nextShip },
    };
  }

  /**
   * Enforce session, persist ship update, and emit ship-upsert-response.
   * @param {import('socket.io').Socket} socket
   * @param {Object} payload
   * @returns {Promise<Object>}
   */
  async handle(socket, payload) {
    this.context.logHandlerMessage('ship-upsert-request', payload);
    const correlationId =
      this.context.toNonEmptyString(payload?.correlationId) ||
      this.context.toNonEmptyString(payload?.requestId) ||
      this.context.toNonEmptyString(payload?.messageId) ||
      '-';
    const hasInventoryPatch = payload?.ship != null && 'inventory' in payload.ship;
    const hasDamageProfilePatch = payload?.ship != null && 'damageProfile' in payload.ship;

    if (Array.isArray(payload?.ship?.inventory)) {
      const incomingInventoryIds = payload.ship.inventory
        .map((entry) => this.context.toNonEmptyString(entry?.itemId || entry?.id))
        .filter((value) => Boolean(value));
      const inventoryPatchPayload = payload.ship.inventory.map((entry) => ({
        itemId: this.context.toNonEmptyString(entry?.itemId),
        id: this.context.toNonEmptyString(entry?.id),
        itemType: this.context.toNonEmptyString(entry?.itemType),
      }));
      this.context.log(
        `[ship-upsert-diag] incoming correlationId=${correlationId} player=${this.context.toNonEmptyString(payload?.playerName) || '-'} characterId=${this.context.toNonEmptyString(payload?.characterId) || '-'} shipId=${this.context.toNonEmptyString(payload?.ship?.id) || '-'} hasInventoryPatch=${hasInventoryPatch} inventoryItemIds=${incomingInventoryIds.join(',') || '-'}`
      );
      this.context.log(
        `[ship-upsert-diag] incoming-patch correlationId=${correlationId} shipId=${this.context.toNonEmptyString(payload?.ship?.id) || '-'} inventoryPatchPayload=${JSON.stringify(inventoryPatchPayload)}`
      );
    } else {
      this.context.log(
        `[ship-upsert-diag] incoming correlationId=${correlationId} player=${this.context.toNonEmptyString(payload?.playerName) || '-'} characterId=${this.context.toNonEmptyString(payload?.characterId) || '-'} shipId=${this.context.toNonEmptyString(payload?.ship?.id) || '-'} hasInventoryPatch=${hasInventoryPatch} inventoryItemIds=-`
      );
    }

    if (!(await this.context.hasValidSessionAsync(payload))) {
      const response = { message: INVALID_SESSION_MESSAGE };
      socket.emit(INVALID_SESSION_EVENT, response);
      return response;
    }

    this.context.detachIdleGameCharacters();
    this.context.touchJoinedCharacters(payload);

    const response = this.buildResponse(payload);

    if (response.success) {
      try {
        const character = this.context.findCharacter(response.playerName, response.characterId);
        const existingShip = Array.isArray(character?.ships)
          ? character.ships.find((ship) => ship.id === response.ship.id)
          : null;

        await this.consumeRepairHullPatchKitIfNeeded({
          response,
          existingShip,
          hasInventoryPatch,
          hasDamageProfilePatch,
          correlationId,
        });

        // Replace only the targeted ship while preserving other ship entries.
        const nextShips = Array.isArray(character?.ships)
          ? character.ships.map((ship) => (ship.id === response.ship.id ? response.ship : ship))
          : [];
        const previousShip = existingShip;
        const previousInventoryIds = Array.isArray(previousShip?.inventory)
          ? previousShip.inventory
              .map((entry) => this.context.toNonEmptyString(entry?.itemId))
              .filter((value) => Boolean(value))
          : [];
        const prePersistShip = nextShips.find((ship) => ship.id === response.ship.id);
        const prePersistInventoryIds = Array.isArray(prePersistShip?.inventory)
          ? prePersistShip.inventory
              .map((entry) => this.context.toNonEmptyString(entry?.itemId))
              .filter((value) => Boolean(value))
          : [];
        this.context.log(
          `[ship-upsert-diag] pre-persist correlationId=${correlationId} player=${response.playerName} characterId=${response.characterId} shipId=${response.ship.id} hasInventoryPatch=${hasInventoryPatch} previousInventoryItemIds=${previousInventoryIds.join(',') || '-'} prePersistInventoryItemIds=${prePersistInventoryIds.join(',') || '-'}`
        );

        await this.context.updateCharacterAsync(
          response.playerName,
          response.characterId,
          {
            ships: nextShips,
          },
          {
            correlationId,
          }
        );

        await this.context.getCharactersAsync(response.playerName);
        const refreshedCharacter = this.context.findCharacter(
          response.playerName,
          response.characterId
        );
        const persistedShip = Array.isArray(refreshedCharacter?.ships)
          ? refreshedCharacter.ships.find((ship) => ship.id === response.ship.id)
          : null;
        const persistedInventoryIds = Array.isArray(persistedShip?.inventory)
          ? persistedShip.inventory
              .map((entry) => this.context.toNonEmptyString(entry?.itemId))
              .filter((value) => Boolean(value))
          : [];
        this.context.log(
          `[ship-upsert-diag] persisted correlationId=${correlationId} player=${response.playerName} characterId=${response.characterId} shipId=${response.ship.id} hasInventoryPatch=${hasInventoryPatch} inventoryItemIds=${persistedInventoryIds.join(',') || '-'}`
        );
      } catch (error) {
        this.context.log(
          `[ship-upsert-handler] Failed to upsert ship: correlationId=${correlationId} error=${error.message}`
        );
        response.success = false;
        response.message = 'Failed to update ship: database error';
        delete response.ship;
      }
    }

    if (response.success && response.ship) {
      const player = this.context.getPlayer(response.playerName);
      response.ship = await this.context.hydrateShipAsync(response.ship, {
        correlationId,
        playerName: response.playerName,
        characterId: response.characterId,
        owningPlayerId: this.context.toNonEmptyString(player?.playerId),
        owningCharacterId: response.characterId,
      });
    }

    socket.emit(SHIP_UPSERT_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  ShipUpsertMessageHandler,
};
