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
    const characterId = this.context.createId();
    const character = {
      id: characterId,
      characterName,
      createdAt: this.context.getCurrentTimestamp()
    };

    characters.push(character);
    this.context.setCharacters(normalizedPlayerName, characters);

    return {
      success: true,
      message: 'Character added successfully',
      playerName: player.playerName,
      characterName: character.characterName,
      characterId: character.id
    };
  }

  handle(socket, payload) {
    if (!this.context.hasValidSession(payload)) {
      const response = { message: INVALID_SESSION_MESSAGE };
      socket.emit(INVALID_SESSION_EVENT, response);
      return response;
    }

    const response = this.buildResponse(payload);
    socket.emit(CHARACTER_ADD_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  CharacterAddMessageHandler
};