'use strict';

const { ITEM_LIST_BY_LOCATION_RESPONSE_EVENT } = require('../model/item-list-by-location');
const { INVALID_SESSION_EVENT, INVALID_SESSION_MESSAGE } = require('../model/session');
const { isFiniteNumber, isTriple } = require('./handler-utils');

class ItemListByLocationMessageHandler {
  /**
   * @param {Object} context
   */
  constructor(context) {
    this.context = context;
  }

  toPositiveNumberOrZero(value) {
    if (!isFiniteNumber(value) || value < 0) {
      return null;
    }

    return value;
  }

  toValidLimit(value) {
    if (value === undefined || value === null) {
      return null;
    }

    if (!Number.isInteger(value) || value <= 0) {
      return null;
    }

    return value;
  }

  /**
   * Validate location query and fetch nearby items.
   * @param {Object} payload
   * @returns {Promise<Object>}
   */
  async buildResponse(payload) {
    const playerName = this.context.toNonEmptyString(payload?.playerName);
    const solarSystemId = this.context.toNonEmptyString(payload?.solarSystemId);
    const positionKm =
      payload?.positionKm && isTriple(payload.positionKm)
        ? {
            x: payload.positionKm.x,
            y: payload.positionKm.y,
            z: payload.positionKm.z,
          }
        : null;
    const distanceKm = this.toPositiveNumberOrZero(payload?.distanceKm);
    const limit = this.toValidLimit(payload?.limit);
    const itemType = this.context.toNonEmptyString(payload?.itemType) || null;

    if (!playerName || !solarSystemId || !positionKm || distanceKm === null) {
      return {
        success: false,
        message: 'playerName, solarSystemId, positionKm, and distanceKm are required',
        playerName,
        solarSystemId,
        items: [],
      };
    }

    if (payload?.limit !== undefined && limit === null) {
      return {
        success: false,
        message: 'limit must be a positive integer when provided',
        playerName,
        solarSystemId,
        items: [],
      };
    }

    const player = this.context.getPlayer(playerName);
    if (!player) {
      return {
        success: false,
        message: 'Player is not registered',
        playerName,
        solarSystemId,
        items: [],
      };
    }

    const searchResult = await this.context.getItemsNearPositionAsync({
      solarSystemId,
      positionKm,
      distanceKm,
      itemType,
      limit,
    });

    if (!searchResult.length) {
      return {
        success: true,
        message: 'No items found within distance',
        playerName: player.playerName,
        solarSystemId,
        positionKm,
        distanceKm,
        itemType,
        items: [],
      };
    }

    return {
      success: true,
      message: 'Item list retrieved successfully',
      playerName: player.playerName,
      solarSystemId,
      positionKm,
      distanceKm,
      itemType,
      items: searchResult.map((entry) => ({
        ...entry.item,
        distanceKm: entry.distanceKm,
      })),
    };
  }

  /**
   * Enforce session and emit item-list-by-location-response.
   * @param {import('socket.io').Socket} socket
   * @param {Object} payload
   * @returns {Promise<Object>}
   */
  async handle(socket, payload) {
    this.context.logHandlerMessage('item-list-by-location-request', payload);
    this.context.refreshCharacterPresence(payload);

    const response = await this.buildResponse(payload);
    socket.emit(ITEM_LIST_BY_LOCATION_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  ItemListByLocationMessageHandler,
};
