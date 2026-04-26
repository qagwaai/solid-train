'use strict';

const {
  ITEM_LIST_BY_LOCATION_RESPONSE_EVENT
} = require('../model/item-list-by-location');
const {
  INVALID_SESSION_EVENT,
  INVALID_SESSION_MESSAGE
} = require('../model/session');

class ItemListByLocationMessageHandler {
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

  toPositiveNumberOrZero(value) {
    if (!this.isFiniteNumber(value) || value < 0) {
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

  async buildResponse(payload) {
    const playerName = this.context.toNonEmptyString(payload?.playerName);
    const solarSystemId = this.context.toNonEmptyString(payload?.solarSystemId);
    const positionKm = payload?.positionKm && this.isTriple(payload.positionKm)
      ? {
        x: payload.positionKm.x,
        y: payload.positionKm.y,
        z: payload.positionKm.z
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
        items: []
      };
    }

    if (payload?.limit !== undefined && limit === null) {
      return {
        success: false,
        message: 'limit must be a positive integer when provided',
        playerName,
        solarSystemId,
        items: []
      };
    }

    const player = this.context.getPlayer(playerName);
    if (!player) {
      return {
        success: false,
        message: 'Player is not registered',
        playerName,
        solarSystemId,
        items: []
      };
    }

    const searchResult = await this.context.getItemsNearPositionAsync({
      solarSystemId,
      positionKm,
      distanceKm,
      itemType,
      limit
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
        items: []
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
        distanceKm: entry.distanceKm
      }))
    };
  }

  async handle(socket, payload) {
    this.context.logHandlerMessage('item-list-by-location-request', payload);

    if (!this.context.hasValidSession(payload)) {
      const response = { message: INVALID_SESSION_MESSAGE };
      socket.emit(INVALID_SESSION_EVENT, response);
      return response;
    }

    this.context.detachIdleGameCharacters();
    this.context.touchJoinedCharacters(payload);

    const response = await this.buildResponse(payload);
    socket.emit(ITEM_LIST_BY_LOCATION_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  ItemListByLocationMessageHandler
};
