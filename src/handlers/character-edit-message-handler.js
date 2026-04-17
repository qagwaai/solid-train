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

    character.characterName = characterName;
    this.context.setCharacters(normalizedPlayerName, characters);

    return {
      success: true,
      message: 'Character edited successfully',
      playerName: player.playerName,
      characterId,
      characterName: character.characterName
    };
  }

  handle(socket, payload) {
    if (!this.context.hasValidSession(payload)) {
      const response = { message: INVALID_SESSION_MESSAGE };
      socket.emit(INVALID_SESSION_EVENT, response);
      return response;
    }

    const response = this.buildResponse(payload);
    socket.emit(CHARACTER_EDIT_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  CharacterEditMessageHandler
};