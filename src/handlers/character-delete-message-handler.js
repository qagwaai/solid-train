'use strict';

const {
  CHARACTER_DELETE_RESPONSE_EVENT
} = require('../model/character-delete');
const {
  INVALID_SESSION_EVENT,
  INVALID_SESSION_MESSAGE
} = require('../model/session');

class CharacterDeleteMessageHandler {
  constructor(context) {
    this.context = context;
  }

  buildResponse(payload) {
    const playerName = this.context.toNonEmptyString(payload?.playerName);
    const characterId = this.context.toNonEmptyString(payload?.characterId);

    if (!playerName || !characterId) {
      return {
        success: false,
        message: 'playerName and characterId are required',
        playerName
      };
    }

    const player = this.context.getPlayer(playerName);

    if (!player) {
      return {
        success: false,
        message: 'Player is not registered',
        playerName
      };
    }

    const character = this.context.findCharacter(playerName, characterId);

    if (!character) {
      return {
        success: false,
        message: 'Character is not in player list',
        playerName: player.playerName,
        characterId
      };
    }

    return {
      success: true,
      message: 'Character deleted successfully',
      playerName: player.playerName,
      characterId
    };
  }

  async handle(socket, payload) {
    this.context.logHandlerMessage('character-delete-request', payload);

    if (!this.context.hasValidSession(payload)) {
      const response = { message: INVALID_SESSION_MESSAGE };
      socket.emit(INVALID_SESSION_EVENT, response);
      return response;
    }

    this.context.detachIdleGameCharacters();
    this.context.touchJoinedCharacters(payload);

    const response = this.buildResponse(payload);

    if (response.success) {
      try {
        await this.context.deleteCharacterAsync(payload?.playerName, payload?.characterId);
        this.context.detachCharacterFromGame(payload?.playerName, payload?.characterId);
      } catch (error) {
        this.context.log(`[character-delete-handler] Failed to delete character: ${error.message}`);
        response.success = false;
        response.message = 'Failed to delete character: database error';
      }
    }

    socket.emit(CHARACTER_DELETE_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  CharacterDeleteMessageHandler
};