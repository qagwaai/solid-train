'use strict';

const { ITEM_UPSERT_RESPONSE_EVENT } = require('../model/item-upsert');
const {
  getItemByType,
  ITEM_CONTAINER_TYPE_VALUES,
  ITEM_STATE,
  ITEM_DAMAGE_STATUS,
  ITEM_STATE_VALUES,
  ITEM_DAMAGE_STATUS_VALUES,
} = require('../model/canonical-items');
const {
  resolveCorrelationId,
  normalizeRequestIdentity,
} = require('./correlation-metadata');
const { normalizeOwnership } = require('./context/ship-ownership');
const { isFiniteNumber, isTriple } = require('./handler-utils');

const VALID_STATES = ITEM_STATE_VALUES;
const VALID_DAMAGE_STATUSES = ITEM_DAMAGE_STATUS_VALUES;
const VALID_CONTAINER_TYPES = ITEM_CONTAINER_TYPE_VALUES;

class ItemUpsertMessageHandler {
  /**
   * @param {Object} context
   */
  constructor(context) {
    this.context = context;
  }

  normalizeContainer(container) {
    if (!container) {
      return null;
    }

    const containerType = this.context.toNonEmptyString(container.containerType);
    const containerId = this.context.toNonEmptyString(container.containerId);

    if (!VALID_CONTAINER_TYPES.includes(containerType) || !containerId) {
      return null;
    }

    return { containerType, containerId };
  }

  normalizeSpatial(spatial) {
    if (!spatial || typeof spatial !== 'object') {
      return null;
    }

    const solarSystemId = this.context.toNonEmptyString(spatial.solarSystemId);
    const frame = this.context.toNonEmptyString(spatial.frame);
    const positionKm = isTriple(spatial.positionKm)
      ? { x: spatial.positionKm.x, y: spatial.positionKm.y, z: spatial.positionKm.z }
      : null;
    const epochMs = isFiniteNumber(spatial.epochMs) ? spatial.epochMs : null;

    if (!solarSystemId || frame !== 'barycentric' || !positionKm || epochMs === null) {
      return null;
    }

    return {
      solarSystemId,
      frame: 'barycentric',
      positionKm,
      epochMs,
    };
  }

  normalizeMotion(motion) {
    if (!motion || typeof motion !== 'object') {
      return null;
    }

    const velocityKmPerSec = isTriple(motion.velocityKmPerSec)
      ? {
          x: motion.velocityKmPerSec.x,
          y: motion.velocityKmPerSec.y,
          z: motion.velocityKmPerSec.z,
        }
      : null;

    if (!velocityKmPerSec) {
      return null;
    }

    return { velocityKmPerSec };
  }

  normalizeRequestIdentity(requestIdentity, itemPayload) {
    return normalizeRequestIdentity(
      {
        requestIdentity,
        operation: 'item-upsert',
        entityTypeCandidates: [itemPayload?.itemType, 'unknown'],
        containerIdCandidates: [itemPayload?.container?.containerId, '-'],
      },
      this.context.toNonEmptyString.bind(this.context)
    );
  }

  buildParsed(payload) {
    const playerName = this.context.toNonEmptyString(payload?.playerName);
    if (!playerName) {
      return { error: 'playerName is required', playerName: '' };
    }

    const player = this.context.getPlayer(playerName);
    if (!player) {
      return { error: 'Player is not registered', playerName };
    }

    const itemPayload = payload?.item || {};
    const id = this.context.toNonEmptyString(itemPayload.id);
    const existingItem = id ? this.context.getItem(id) : null;
    const isCreating = !existingItem;

    const itemType = this.context.toNonEmptyString(itemPayload.itemType);
    const displayName = this.context.toNonEmptyString(itemPayload.displayName);
    const hasTier = 'tier' in itemPayload;
    const tierPayload = itemPayload.tier;
    const tier =
      hasTier && Number.isInteger(tierPayload) && tierPayload >= 1 && tierPayload <= 20
        ? tierPayload
        : null;

    // Validate itemType against canonical items
    const canonicalItem = itemType ? getItemByType(itemType) : null;
    if (isCreating && (!itemType || !displayName)) {
      return {
        error: 'item.itemType and item.displayName are required to create an item',
        playerName: player.playerName,
      };
    }
    if (itemType && !canonicalItem) {
      return {
        error: `itemType '${itemType}' is not a recognized item in the canonical item list`,
        playerName: player.playerName,
      };
    }

    const state = this.context.toNonEmptyString(itemPayload.state);
    if (state && !VALID_STATES.includes(state)) {
      return {
        error: `item.state must be one of: ${VALID_STATES.join(', ')}`,
        playerName: player.playerName,
      };
    }

    const damageStatus = this.context.toNonEmptyString(itemPayload.damageStatus);
    if (damageStatus && !VALID_DAMAGE_STATUSES.includes(damageStatus)) {
      return {
        error: `item.damageStatus must be one of: ${VALID_DAMAGE_STATUSES.join(', ')}`,
        playerName: player.playerName,
      };
    }

    if (hasTier && tier === null) {
      return {
        error: 'item.tier must be an integer between 1 and 20',
        playerName: player.playerName,
      };
    }

    if ('kinematics' in itemPayload) {
      return {
        error:
          'item.kinematics is no longer accepted; use canonical item.spatial (and optional item.motion) instead',
        playerName: player.playerName,
      };
    }

    const hasSpatial = 'spatial' in itemPayload;
    let spatial;
    if (hasSpatial) {
      if (itemPayload.spatial === null) {
        spatial = null;
      } else {
        spatial = this.normalizeSpatial(itemPayload.spatial);
        if (spatial === null) {
          return {
            error:
              "item.spatial must include solarSystemId, frame:'barycentric', positionKm, and epochMs",
            playerName: player.playerName,
          };
        }
      }
    }

    const hasMotion = 'motion' in itemPayload;
    let motion;
    if (hasMotion) {
      if (itemPayload.motion === null) {
        motion = null;
      } else {
        motion = this.normalizeMotion(itemPayload.motion);
        if (motion === null) {
          return {
            error: 'item.motion must include velocityKmPerSec when provided',
            playerName: player.playerName,
          };
        }
      }
    }

    const hasContainer = 'container' in itemPayload;
    let container;
    if (hasContainer) {
      if (itemPayload.container === null) {
        container = null;
      } else {
        container = this.normalizeContainer(itemPayload.container);
        if (container === null) {
          return {
            error:
              'item.container must include a valid containerType (ship or market) and containerId',
            playerName: player.playerName,
          };
        }
      }
    }

    return {
      playerName: player.playerName,
      id,
      existingItem,
      isCreating,
      itemType,
      displayName,
      hasTier,
      tier,
      state,
      damageStatus,
      hasSpatial,
      spatial,
      hasMotion,
      motion,
      hasContainer,
      container,
      owningPlayerId: this.context.toNonEmptyString(itemPayload.owningPlayerId),
      owningCharacterId: this.context.toNonEmptyString(itemPayload.owningCharacterId),
      ownership: itemPayload.ownership || null,
      destroyedAt: this.context.toNonEmptyString(itemPayload.destroyedAt) || null,
      destroyedReason: this.context.toNonEmptyString(itemPayload.destroyedReason) || null,
      discoveredAt: this.context.toNonEmptyString(itemPayload.discoveredAt) || null,
      discoveredByCharacterId:
        this.context.toNonEmptyString(itemPayload.discoveredByCharacterId) || null,
      hasLaunchable: 'launchable' in itemPayload,
      launchable: itemPayload.launchable != null ? Boolean(itemPayload.launchable) : null,
    };
  }

  /**
   * Create or update an item, sync ship inventory references, and emit item-upsert-response.
   * @param {import('socket.io').Socket} socket
   * @param {Object} payload
   * @returns {Promise<Object>}
   */
  async handle(socket, payload) {
    this.context.logHandlerMessage('item-upsert-request', payload, {
      level: 'debug',
    });
    const correlationId = resolveCorrelationId(
      payload,
      this.context.toNonEmptyString.bind(this.context)
    );
    const requestIdentity = this.normalizeRequestIdentity(payload?.requestIdentity, payload?.item);

    const incomingItemId = this.context.toNonEmptyString(payload?.item?.id);
    const incomingItemType = this.context.toNonEmptyString(payload?.item?.itemType);
    const incomingState = this.context.toNonEmptyString(payload?.item?.state);
    if (
      incomingItemType === 'hull-patch-kit' ||
      incomingState === ITEM_STATE.DESTROYED ||
      this.context.toNonEmptyString(payload?.item?.destroyedAt)
    ) {
      this.context.log(
        `[item-upsert-diag] incoming correlationId=${correlationId} player=${this.context.toNonEmptyString(payload?.playerName) || '-'} itemId=${incomingItemId || '-'} itemType=${incomingItemType || '-'} state=${incomingState || '-'} containerType=${this.context.toNonEmptyString(payload?.item?.container?.containerType) || 'null'} containerId=${this.context.toNonEmptyString(payload?.item?.container?.containerId) || 'null'}`
      );
    }


    const parsed = this.buildParsed(payload);

    // Validate canonical ownership if provided
    if (!parsed.error && parsed.ownership) {
      const ownershipNorm = normalizeOwnership(this.context, parsed.ownership);
      if (ownershipNorm.error) {
        const errResponse = {
          success: false,
          message: ownershipNorm.error,
          reason: 'OWNERSHIP_VALIDATION_FAILED',
          playerName: parsed.playerName,
          correlationId,
          requestIdentity,
        };
        socket.emit(ITEM_UPSERT_RESPONSE_EVENT, errResponse);
        return errResponse;
      }
      if (ownershipNorm.ownerType !== 'player-character') {
        const errResponse = {
          success: false,
          message: 'Only player-character owners can upsert items',
          reason: 'OWNERSHIP_VALIDATION_FAILED',
          playerName: parsed.playerName,
          correlationId,
          requestIdentity,
        };
        socket.emit(ITEM_UPSERT_RESPONSE_EVENT, errResponse);
        return errResponse;
      }
      const actorPlayer = this.context.getPlayer(parsed.playerName);
      const actorPlayerId = actorPlayer ? this.context.toNonEmptyString(actorPlayer.playerId) : null;
      if (ownershipNorm.playerId !== actorPlayerId) {
        const errResponse = {
          success: false,
          message: 'Actor does not have permission to upsert items for another player',
          reason: 'OWNERSHIP_ITEM_FORBIDDEN',
          playerName: parsed.playerName,
          correlationId,
          requestIdentity,
        };
        socket.emit(ITEM_UPSERT_RESPONSE_EVENT, errResponse);
        return errResponse;
      }
      // Normalize the ownership object on parsed for downstream use
      parsed.ownership = {
        ownerType: ownershipNorm.ownerType,
        playerId: ownershipNorm.playerId,
        characterId: ownershipNorm.characterId,
        npcId: ownershipNorm.npcId,
        factionId: ownershipNorm.factionId,
      };
    }

    const response = {
      success: !parsed.error,
      message:
        parsed.error ||
        (parsed.isCreating ? 'Item created successfully' : 'Item updated successfully'),
      playerName: parsed.playerName,
      correlationId,
      requestIdentity,
    };

    if (response.success) {
      try {
        const now = this.context.getCurrentTimestamp();
        const itemId = parsed.id || this.context.createId();
        const existing = parsed.existingItem;
        const canonicalItem = parsed.itemType ? getItemByType(parsed.itemType) : null;
        const resolvedTier = parsed.hasTier
          ? parsed.tier
          : existing?.tier != null
            ? existing.tier
            : canonicalItem?.tier || 1;

        const resolvedState = parsed.state || existing?.state || ITEM_STATE.CONTAINED;
        const resolvedSpatial = parsed.hasSpatial ? parsed.spatial : (existing?.spatial ?? null);
        const resolvedMotion = parsed.hasMotion ? parsed.motion : (existing?.motion ?? null);
        const itemData = {
          id: itemId,
          itemType: parsed.itemType || existing?.itemType || '',
          displayName: parsed.displayName || existing?.displayName || '',
          tier: resolvedTier,
          state: resolvedState,
          damageStatus: parsed.damageStatus || existing?.damageStatus || ITEM_DAMAGE_STATUS.INTACT,
          container: parsed.hasContainer ? parsed.container : (existing?.container ?? null),
          spatial: resolvedSpatial,
          ...(resolvedMotion ? { motion: resolvedMotion } : {}),
          owningPlayerId: parsed.owningPlayerId || existing?.owningPlayerId || '',
          owningCharacterId: parsed.owningCharacterId || existing?.owningCharacterId || '',
          ownership: parsed.ownership !== undefined ? parsed.ownership : (existing?.ownership ?? null),
          destroyedAt:
            parsed.destroyedAt ||
            (resolvedState === ITEM_STATE.DESTROYED && !existing?.destroyedAt ? now : null) ||
            existing?.destroyedAt ||
            null,
          destroyedReason: parsed.destroyedReason || existing?.destroyedReason || null,
          discoveredAt: parsed.discoveredAt || existing?.discoveredAt || null,
          discoveredByCharacterId:
            parsed.discoveredByCharacterId || existing?.discoveredByCharacterId || null,
          launchable: parsed.hasLaunchable
            ? parsed.launchable
            : existing?.launchable != null
              ? existing.launchable
              : true,
          createdAt: existing?.createdAt || now,
          updatedAt: now,
        };

        if (parsed.isCreating) {
          const items = await this.context.addItemsAsync([itemData]);
          response.item = items[0] || itemData;
        } else {
          // Full update path keeps canonical item shape centralized in one place.
          response.item = (await this.context.updateItemAsync(itemId, itemData)) || itemData;
        }

        try {
          await this.context.syncShipInventoryReferenceForItemAsync(
            parsed.playerName,
            existing,
            response.item,
            {
              correlationId,
            }
          );
        } catch (syncError) {
          // Item persistence succeeded; do not fail item-upsert when ship reference sync races.
          this.context.log(
            `[item-upsert-diag] inventory-sync-warning correlationId=${correlationId} player=${parsed.playerName} itemId=${response.item?.id || '-'} itemType=${response.item?.itemType || '-'} error=${syncError.message}`
          );
        }

        if (
          response.item?.itemType === 'hull-patch-kit' ||
          response.item?.state === ITEM_STATE.DESTROYED ||
          response.item?.destroyedAt
        ) {
          this.context.log(
            `[item-upsert-diag] persisted correlationId=${correlationId} player=${parsed.playerName} itemId=${response.item?.id || '-'} itemType=${response.item?.itemType || '-'} state=${response.item?.state || '-'} damageStatus=${response.item?.damageStatus || '-'} containerType=${this.context.toNonEmptyString(response.item?.container?.containerType) || 'null'} containerId=${this.context.toNonEmptyString(response.item?.container?.containerId) || 'null'} destroyedAt=${this.context.toNonEmptyString(response.item?.destroyedAt) || 'null'}`
          );
        }
      } catch (error) {
        this.context.log(
          `[item-upsert-handler] Failed to upsert item: correlationId=${correlationId} error=${error.message}`
        );
        response.success = false;
        response.message = 'Failed to upsert item: database error';
        delete response.item;
      }
    }

    socket.emit(ITEM_UPSERT_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  ItemUpsertMessageHandler,
};
