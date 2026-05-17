'use strict';

const { SHIP_LIST_RESPONSE_EVENT } = require('../model/ship-list');
const { INVALID_SESSION_EVENT, INVALID_SESSION_MESSAGE } = require('../model/session');

class ShipListMessageHandler {
  /**
   * @param {Object} context
   */
  constructor(context) {
    this.context = context;
  }

  /**
   * Validate payload and build ship list response for a character.
   * @param {Object} payload
   * @returns {Promise<Object>}
   */
  async buildResponse(payload) {
    const playerName = this.context.toNonEmptyString(payload?.playerName);
    const characterId = this.context.toNonEmptyString(payload?.characterId);

    if (!playerName || !characterId) {
      return {
        success: false,
        message: 'playerName and characterId are required',
        playerName,
        characterId,
        ships: [],
      };
    }

    const player = this.context.getPlayer(playerName);

    if (!player) {
      return {
        success: false,
        message: 'Player is not registered',
        playerName,
        characterId,
        ships: [],
      };
    }

    const character = this.context.findCharacter(playerName, characterId);

    if (!character) {
      return {
        success: false,
        message: 'Character is not in player list',
        playerName: player.playerName,
        characterId,
        ships: [],
      };
    }

    // Hydration resolves item references and normalized ship surface before returning to clients.
    const ships = Array.isArray(character.ships)
      ? await this.context.hydrateShipsAsync(character.ships, {
          playerName: player.playerName,
          characterId,
          owningPlayerId: this.context.toNonEmptyString(player.playerId),
          owningCharacterId: characterId,
        })
      : [];

    return {
      success: true,
      message: 'Ship list retrieved successfully',
      playerName: player.playerName,
      characterId,
      ships,
    };
  }

  /**
   * Enforce session, emit ship-list-response, and return response payload.
   * @param {import('socket.io').Socket} socket
   * @param {Object} payload
   * @returns {Promise<Object>}
   */
  async handle(socket, payload) {
    this.context.logHandlerMessage('ship-list-request', payload);

    if (!(await this.context.hasValidSessionAsync(payload))) {
      const response = { message: INVALID_SESSION_MESSAGE };
      socket.emit(INVALID_SESSION_EVENT, response);
      return response;
    }

    this.context.detachIdleGameCharacters();
    this.context.touchJoinedCharacters(payload);

    const response = await this.buildResponse(payload);
    socket.emit(SHIP_LIST_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  ShipListMessageHandler,
};
