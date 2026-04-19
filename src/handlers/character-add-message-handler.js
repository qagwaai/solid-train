'use strict';

const {
  CHARACTER_ADD_RESPONSE_EVENT
} = require('../model/character-add');
const {
  INVALID_SESSION_EVENT,
  INVALID_SESSION_MESSAGE
} = require('../model/session');

class CharacterAddMessageHandler {
  constructor(context) {
    this.context = context;
  }

  buildResponse(payload) {
    const playerName = this.context.toNonEmptyString(payload?.playerName);
    const characterName = this.context.toNonEmptyString(payload?.characterName);

    if (!playerName || !characterName) {
      return {
        success: false,
        message: 'playerName and characterName are required',
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

    const characterId = this.context.createId();

    return {
      success: true,
      message: 'Character added successfully',
      playerName: player.playerName,
      characterName,
      characterId
    };
  }

  async handle(socket, payload) {
    this.context.logHandlerMessage('character-add-request', payload);

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
        const createdAt = this.context.getCurrentTimestamp();
        const characterData = {
          id: response.characterId,
          characterName: response.characterName,
          createdAt,
          drones: [
            {
              id: `${response.characterId}-drone-1`,
              droneName: `${response.characterName} Drone 1`,
              createdAt
            }
          ]
        };
        await this.context.addCharacterAsync(payload?.playerName, characterData);
      } catch (error) {
        this.context.log(`[character-add-handler] Failed to add character: ${error.message}`);
        response.success = false;
        response.message = 'Failed to add character: database error';
        delete response.characterId;
        delete response.characterName;
      }
    }

    socket.emit(CHARACTER_ADD_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  CharacterAddMessageHandler
};