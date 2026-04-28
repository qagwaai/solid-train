'use strict';

const { ITEM_UPSERT_RESPONSE_EVENT } = require('../model/item-upsert');
const {
  INVALID_SESSION_EVENT,
  INVALID_SESSION_MESSAGE
} = require('../model/session');

const VALID_STATES = ['contained', 'deployed', 'destroyed'];
const VALID_DAMAGE_STATUSES = ['intact', 'damaged', 'disabled', 'destroyed'];
const VALID_CONTAINER_TYPES = ['ship', 'market'];

class ItemUpsertMessageHandler {
  constructor(context) {
    this.context = context;
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

  normalizeKinematics(kinematics) {
    if (!kinematics || !this.isTriple(kinematics.position) || !this.isTriple(kinematics.velocity)) {
      return null;
    }

    const reference = kinematics.reference;
    if (
      !reference
      || !this.context.toNonEmptyString(reference.solarSystemId)
      || !['barycentric', 'body-centered'].includes(
        this.context.toNonEmptyString(reference.referenceKind)
      )
      || !this.isFiniteNumber(reference.epochMs)
    ) {
      return null;
    }

    return {
      position: {
        x: kinematics.position.x,
        y: kinematics.position.y,
        z: kinematics.position.z
      },
      velocity: {
        x: kinematics.velocity.x,
        y: kinematics.velocity.y,
        z: kinematics.velocity.z
      },
      reference: {
        solarSystemId: this.context.toNonEmptyString(reference.solarSystemId),
        referenceKind: this.context.toNonEmptyString(reference.referenceKind),
        referenceBodyId: this.context.toNonEmptyString(reference.referenceBodyId) || null,
        distanceUnit: 'km',
        velocityUnit: 'km/s',
        epochMs: reference.epochMs
      }
    };
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

    if (isCreating && (!itemType || !displayName)) {
      return {
        error: 'item.itemType and item.displayName are required to create an item',
        playerName: player.playerName
      };
    }

    const state = this.context.toNonEmptyString(itemPayload.state);
    if (state && !VALID_STATES.includes(state)) {
      return {
        error: `item.state must be one of: ${VALID_STATES.join(', ')}`,
        playerName: player.playerName
      };
    }

    const damageStatus = this.context.toNonEmptyString(itemPayload.damageStatus);
    if (damageStatus && !VALID_DAMAGE_STATUSES.includes(damageStatus)) {
      return {
        error: `item.damageStatus must be one of: ${VALID_DAMAGE_STATUSES.join(', ')}`,
        playerName: player.playerName
      };
    }

    const hasKinematics = Boolean(itemPayload.kinematics);
    const kinematics = hasKinematics ? this.normalizeKinematics(itemPayload.kinematics) : null;
    if (hasKinematics && !kinematics) {
      return {
        error: 'item.kinematics payload is invalid',
        playerName: player.playerName
      };
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
            error: 'item.container must include a valid containerType (ship or market) and containerId',
            playerName: player.playerName
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
      state,
      damageStatus,
      hasKinematics,
      kinematics,
      hasContainer,
      container,
      owningPlayerId: this.context.toNonEmptyString(itemPayload.owningPlayerId),
      owningCharacterId: this.context.toNonEmptyString(itemPayload.owningCharacterId),
      destroyedAt: this.context.toNonEmptyString(itemPayload.destroyedAt) || null,
      destroyedReason: this.context.toNonEmptyString(itemPayload.destroyedReason) || null,
      discoveredAt: this.context.toNonEmptyString(itemPayload.discoveredAt) || null,
      discoveredByCharacterId:
        this.context.toNonEmptyString(itemPayload.discoveredByCharacterId) || null,
      hasLaunchable: 'launchable' in itemPayload,
      launchable: itemPayload.launchable != null ? Boolean(itemPayload.launchable) : null
    };
  }

  async handle(socket, payload) {
    this.context.logHandlerMessage('item-upsert-request', payload);

    if (!await this.context.hasValidSessionAsync(payload)) {
      const response = { message: INVALID_SESSION_MESSAGE };
      socket.emit(INVALID_SESSION_EVENT, response);
      return response;
    }

    const parsed = this.buildParsed(payload);
    const response = {
      success: !parsed.error,
      message: parsed.error ||
        (parsed.isCreating ? 'Item created successfully' : 'Item updated successfully'),
      playerName: parsed.playerName
    };

    if (response.success) {
      try {
        const now = this.context.getCurrentTimestamp();
        const itemId = parsed.id || this.context.createId();
        const existing = parsed.existingItem;

        const resolvedState = parsed.state || existing?.state || 'contained';
        const itemData = {
          id: itemId,
          itemType: parsed.itemType || existing?.itemType || '',
          displayName: parsed.displayName || existing?.displayName || '',
          state: resolvedState,
          damageStatus: parsed.damageStatus || existing?.damageStatus || 'intact',
          container: parsed.hasContainer
            ? parsed.container
            : (existing?.container ?? null),
          kinematics: parsed.hasKinematics
            ? parsed.kinematics
            : (existing?.kinematics ?? null),
          owningPlayerId: parsed.owningPlayerId || existing?.owningPlayerId || '',
          owningCharacterId: parsed.owningCharacterId || existing?.owningCharacterId || '',
          destroyedAt: parsed.destroyedAt
            || (resolvedState === 'destroyed' && !existing?.destroyedAt ? now : null)
            || existing?.destroyedAt
            || null,
          destroyedReason: parsed.destroyedReason || existing?.destroyedReason || null,
          discoveredAt: parsed.discoveredAt || existing?.discoveredAt || null,
          discoveredByCharacterId:
            parsed.discoveredByCharacterId || existing?.discoveredByCharacterId || null,
          launchable: parsed.hasLaunchable
            ? parsed.launchable
            : (existing?.launchable != null ? existing.launchable : true),
          createdAt: existing?.createdAt || now,
          updatedAt: now
        };

        if (parsed.isCreating) {
          const items = await this.context.addItemsAsync([itemData]);
          response.item = items[0] || itemData;
        } else {
          response.item = await this.context.updateItemAsync(itemId, itemData) || itemData;
        }
      } catch (error) {
        this.context.log(`[item-upsert-handler] Failed to upsert item: ${error.message}`);
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
  ItemUpsertMessageHandler
};
