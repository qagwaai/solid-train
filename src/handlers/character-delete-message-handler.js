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

    const normalizedPlayerName = playerName.toLowerCase();
    const player = this.context.getPlayer(playerName);

    if (!player) {
      return {
        success: false,
        message: 'Player is not registered',
        playerName
      };
    }

    const characters = this.context.getCharacters(normalizedPlayerName);
    const characterIndex = characters.findIndex(
      (character) => character.id === characterId
    );

    if (characterIndex === -1) {
      return {
        success: false,
        message: 'Character is not in player list',
        playerName: player.playerName,
        characterId
      };
    }

    characters.splice(characterIndex, 1);
    this.context.setCharacters(normalizedPlayerName, characters);

    return {
      success: true,
      message: 'Character deleted successfully',
      playerName: player.playerName,
      characterId
    };
  }

  handle(socket, payload) {
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
      this.context.detachCharacterFromGame(payload?.playerName, payload?.characterId);
    }

    socket.emit(CHARACTER_DELETE_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  CharacterDeleteMessageHandler
};