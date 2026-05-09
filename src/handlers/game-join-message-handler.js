'use strict';

const { GAME_JOIN_RESPONSE_EVENT } = require('../model/game-join');
const { INVALID_SESSION_EVENT, INVALID_SESSION_MESSAGE } = require('../model/session');

class GameJoinMessageHandler {
  /**
   * @param {Object} context
   */
  constructor(context) {
    this.context = context;
  }

  /**
   * Validate payload and produce base game-join response.
   * @param {Object} payload
   * @returns {Object}
   */
  buildResponse(payload) {
    const playerName = this.context.toNonEmptyString(payload?.playerName);
    const characterId = this.context.toNonEmptyString(payload?.characterId);

    if (!playerName || !characterId) {
      return {
        success: false,
        message: 'playerName and characterId are required',
        playerName,
        characterId,
      };
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

    return {
      success: true,
      message: 'Character joined game successfully',
      playerName: player.playerName,
      characterId,
    };
  }

  /**
   * Join an existing character to runtime game state and emit game-join-response.
   * @param {import('socket.io').Socket} socket
   * @param {Object} payload
   * @returns {Promise<Object>}
   */
  async handle(socket, payload) {
    this.context.logHandlerMessage('game-join', payload);

    if (!(await this.context.hasValidSessionAsync(payload))) {
      const response = { message: INVALID_SESSION_MESSAGE };
      socket.emit(INVALID_SESSION_EVENT, response);
      return response;
    }

    this.context.detachIdleGameCharacters();
    this.context.touchJoinedCharacters(payload);

    const response = this.buildResponse(payload);

    if (response.success) {
      const character = this.context.findCharacter(payload?.playerName, payload?.characterId);
      if (character) {
        // Join operation only mutates runtime game state; character data remains unchanged.
        this.context.joinCharacterToGame(payload?.playerName, character);
      }
    }

    socket.emit(GAME_JOIN_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  GameJoinMessageHandler,
};
