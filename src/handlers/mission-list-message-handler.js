'use strict';

const {
  MISSION_LIST_RESPONSE_EVENT
} = require('../model/mission-list');
const {
  INVALID_SESSION_EVENT,
  INVALID_SESSION_MESSAGE
} = require('../model/session');

class MissionListMessageHandler {
  constructor(context) {
    this.context = context;
  }

  sanitizeStatuses(statuses) {
    if (!Array.isArray(statuses)) {
      return [];
    }

    return statuses
      .map((status) => this.context.toNonEmptyString(status))
      .filter((status) => Boolean(status));
  }

  async buildResponse(payload) {
    const playerName = this.context.toNonEmptyString(payload?.playerName);
    const characterId = this.context.toNonEmptyString(payload?.characterId);

    if (!playerName || !characterId) {
      return {
        success: false,
        message: 'playerName and characterId are required',
        playerName,
        characterId,
        missions: []
      };
    }

    const player = this.context.getPlayer(playerName);
    if (!player) {
      return {
        success: false,
        message: 'Player is not registered',
        playerName,
        characterId,
        missions: []
      };
    }

    const character = this.context.findCharacter(playerName, characterId);
    if (!character) {
      return {
        success: false,
        message: 'Character is not in player list',
        playerName: player.playerName,
        characterId,
        missions: []
      };
    }

    const statuses = this.sanitizeStatuses(payload?.statuses);
    const missions = await this.context.getMissionsAsync(playerName, characterId);
    const filteredMissions = statuses.length
      ? missions.filter((mission) => statuses.includes(mission.status))
      : missions;

    return {
      success: true,
      message: 'Mission list retrieved successfully',
      playerName: player.playerName,
      characterId,
      missions: filteredMissions.map((mission) => ({ ...mission }))
    };
  }

  async handle(socket, payload) {
    this.context.logHandlerMessage('list-missions-request', payload);

    if (!this.context.hasValidSession(payload)) {
      const response = { message: INVALID_SESSION_MESSAGE };
      socket.emit(INVALID_SESSION_EVENT, response);
      return response;
    }

    this.context.detachIdleGameCharacters();
    this.context.touchJoinedCharacters(payload);

    const response = await this.buildResponse(payload);
    socket.emit(MISSION_LIST_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  MissionListMessageHandler
};
