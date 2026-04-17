'use strict';

const {
  GAME_JOIN_RESPONSE_EVENT
} = require('../model/game-join');
const {
  INVALID_SESSION_EVENT,
  INVALID_SESSION_MESSAGE
} = require('../model/session');

class GameJoinMessageHandler {
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
        playerName,
        characterId
      };
    }

    const normalizedPlayerName = playerName.toLowerCase();
    const player = this.context.getPlayer(playerName);

    if (!player) {
      return {
        success: false,
        message: 'Player is not registered',
        playerName,
        characterId
      };
    }

    const characters = this.context.getCharacters(normalizedPlayerName);
    const character = characters.find((candidate) => candidate.id === characterId);

    if (!character) {
      return {
        success: false,
        message: 'Character is not in player list',
        playerName: player.playerName,
        characterId
      };
    }

    this.context.joinCharacterToGame(player.playerName, character);

    return {
      success: true,
      message: 'Character joined game successfully',
      playerName: player.playerName,
      characterId
    };
  }

  handle(socket, payload) {
    this.context.logHandlerMessage('game-join', payload);

    if (!this.context.hasValidSession(payload)) {
      const response = { message: INVALID_SESSION_MESSAGE };
      socket.emit(INVALID_SESSION_EVENT, response);
      return response;
    }

    this.context.detachIdleGameCharacters();
    this.context.touchJoinedCharacters(payload);

    const response = this.buildResponse(payload);
    socket.emit(GAME_JOIN_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  GameJoinMessageHandler
};