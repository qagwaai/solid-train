'use strict';

const { CHARACTER_LIST_RESPONSE_EVENT } = require('../model/character-list');
const { validRequest, failure, projectRoster } = require('../model/character-roster');

class CharacterListMessageHandler {
  /**
   * @param {Object} context
   */
  constructor(context) {
    this.context = context;
  }

  /**
   * Validate payload and build character-list response.
   * @param {Object} payload
   * @returns {Promise<Object>}
   */
  async buildResponse(payload) {
    if (!validRequest(payload)) {
      return failure(payload, 'invalid_request', 'Invalid character list request');
    }

    const playerName = this.context.toNonEmptyString(payload?.playerName);

    const normalizedPlayerName = playerName.toLowerCase();
    const player = await this.context.getPlayerAsync(playerName, { strict: true });

    if (!player) {
      return {
        success: false,
        message: 'Player is not registered',
        reason: 'player_not_registered',
        playerName,
        characters: [],
        correlationId: payload.correlationId,
        requestIdentity: payload.requestIdentity,
      };
    }

    try {
      const characters = await this.context.getCharactersAsync(normalizedPlayerName, {
        strict: true,
      });
      const roster = projectRoster(characters);

      return {
        success: true,
        message: 'Character list retrieved successfully',
        playerName: player.playerName,
        characters: roster,
        correlationId: payload.correlationId,
        requestIdentity: payload.requestIdentity,
      };
    } catch (error) {
      this.context.log(
        `[character-list-handler] Failed to build complete roster: ${error.message}`
      );
      return {
        success: false,
        message: 'Character roster is unavailable',
        reason: 'incomplete_roster',
        playerName,
        characters: [],
        correlationId: payload.correlationId,
        requestIdentity: payload.requestIdentity,
      };
    }
  }

  /**
   * Enforce session, emit character-list-response, and return response payload.
   * @param {import('socket.io').Socket} socket
   * @param {Object} payload
   * @returns {Promise<Object>}
   */
  async handle(socket, payload) {
    this.context.logHandlerMessage('character-list-request', payload);

    this.context.refreshCharacterPresence(payload);

    const response = await this.buildResponse(payload);
    socket.emit(CHARACTER_LIST_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  CharacterListMessageHandler,
};
