'use strict';

const {
  CHARACTER_EDIT_RESPONSE_EVENT
} = require('../model/character-edit');
const {
  INVALID_SESSION_EVENT,
  INVALID_SESSION_MESSAGE
} = require('../model/session');

class CharacterEditMessageHandler {
  constructor(context) {
    this.context = context;
  }

  buildResponse(payload) {
    const playerName = this.context.toNonEmptyString(payload?.playerName);
    const characterId = this.context.toNonEmptyString(payload?.characterId);
    const characterName = this.context.toNonEmptyString(payload?.characterName);

    if (!playerName || !characterId || !characterName) {
      return {
        success: false,
        message: 'playerName, characterId, and characterName are required',
        playerName,
        characterId
      };
    }

    const player = this.context.getPlayer(playerName);

    if (!player) {
      return {
        success: false,
        message: 'Player is not registered',
        playerName,
        characterId
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
      message: 'Character edited successfully',
      playerName: player.playerName,
      characterId,
      characterName
    };
  }

  async handle(socket, payload) {
    this.context.logHandlerMessage('character-edit', payload);

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
        await this.context.updateCharacterAsync(
          payload?.playerName,
          payload?.characterId,
          { characterName: payload?.characterName }
        );
        this.context.renameJoinedCharacter(
          payload?.playerName,
          payload?.characterId,
          payload?.characterName
        );
      } catch (error) {
        this.context.log(`[character-edit-handler] Failed to edit character: ${error.message}`);
        response.success = false;
        response.message = 'Failed to edit character: database error';
      }
    }

    socket.emit(CHARACTER_EDIT_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  CharacterEditMessageHandler
};