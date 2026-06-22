'use strict';

const { CHARACTER_LIST_RESPONSE_EVENT } = require('../model/character-list');
const { INVALID_SESSION_EVENT, INVALID_SESSION_MESSAGE } = require('../model/session');

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
   * @returns {Object}
   */
  buildResponse(payload) {
    const playerName = this.context.toNonEmptyString(payload?.playerName);

    if (!playerName) {
      return {
        success: false,
        message: 'playerName is required',
        playerName: '',
        characters: [],
      };
    }

    const normalizedPlayerName = playerName.toLowerCase();
    const player = this.context.getPlayer(playerName);

    if (!player) {
      return {
        success: false,
        message: 'Player is not registered',
        playerName,
        characters: [],
      };
    }

    const characters = this.context.getCharacters(normalizedPlayerName);

    return {
      success: true,
      message: 'Character list retrieved successfully',
      playerName: player.playerName,
      characters: characters.map((character) => ({ ...character })),
    };
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

    const response = this.buildResponse(payload);
    socket.emit(CHARACTER_LIST_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  CharacterListMessageHandler,
};
