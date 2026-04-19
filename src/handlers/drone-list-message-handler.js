'use strict';

const {
  DRONE_LIST_RESPONSE_EVENT
} = require('../model/drone-list');
const {
  INVALID_SESSION_EVENT,
  INVALID_SESSION_MESSAGE
} = require('../model/session');

class DroneListMessageHandler {
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
        characterId,
        drones: []
      };
    }

    const player = this.context.getPlayer(playerName);

    if (!player) {
      return {
        success: false,
        message: 'Player is not registered',
        playerName,
        characterId,
        drones: []
      };
    }

    const character = this.context.findCharacter(playerName, characterId);

    if (!character) {
      return {
        success: false,
        message: 'Character is not in player list',
        playerName: player.playerName,
        characterId,
        drones: []
      };
    }

    const drones = Array.isArray(character.drones)
      ? character.drones.map((drone) => ({ ...drone }))
      : [];

    return {
      success: true,
      message: 'Drone list retrieved successfully',
      playerName: player.playerName,
      characterId,
      drones
    };
  }

  async handle(socket, payload) {
    this.context.logHandlerMessage('drone-list-request', payload);

    if (!this.context.hasValidSession(payload)) {
      const response = { message: INVALID_SESSION_MESSAGE };
      socket.emit(INVALID_SESSION_EVENT, response);
      return response;
    }

    this.context.detachIdleGameCharacters();
    this.context.touchJoinedCharacters(payload);

    const response = this.buildResponse(payload);
    socket.emit(DRONE_LIST_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  DroneListMessageHandler
};