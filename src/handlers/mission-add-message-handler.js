'use strict';

const {
  MISSION_ADD_RESPONSE_EVENT
} = require('../model/mission-add');
const {
  DEFAULT_MISSION_STATUS
} = require('../model/mission');
const {
  INVALID_SESSION_EVENT,
  INVALID_SESSION_MESSAGE
} = require('../model/session');

class MissionAddMessageHandler {
  constructor(context) {
    this.context = context;
  }

  buildResponse(payload) {
    const playerName = this.context.toNonEmptyString(payload?.playerName);
    const characterId = this.context.toNonEmptyString(payload?.characterId);
    const missionId = this.context.toNonEmptyString(payload?.missionId);
    const status = this.context.toNonEmptyString(payload?.status) || DEFAULT_MISSION_STATUS;

    if (!playerName || !characterId || !missionId) {
      return {
        success: false,
        message: 'playerName, characterId, and missionId are required',
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
      message: 'Mission recorded successfully',
      playerName: player.playerName,
      characterId,
      mission: {
        missionId,
        status
      }
    };
  }

  enrichMissionTimestamps(mission, existingMission, timestamp) {
    const nextMission = {
      ...(existingMission || {}),
      ...mission,
      updatedAt: timestamp
    };

    if (mission.status === 'started' && !nextMission.startedAt) {
      nextMission.startedAt = timestamp;
    }
    if (mission.status === 'in-progress' && !nextMission.inProgressAt) {
      nextMission.inProgressAt = timestamp;
    }
    if (mission.status === 'failed' && !nextMission.failedAt) {
      nextMission.failedAt = timestamp;
    }
    if (mission.status === 'completed' && !nextMission.completedAt) {
      nextMission.completedAt = timestamp;
    }

    return nextMission;
  }

  async handle(socket, payload) {
    this.context.logHandlerMessage('add-mission-request', payload);

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
        const existingMissions = await this.context.getMissionsAsync(
          payload?.playerName,
          payload?.characterId
        );
        const existingMission = existingMissions.find(
          (mission) => mission.missionId === response.mission.missionId
        );

        const missionWithTimestamps = this.enrichMissionTimestamps(
          response.mission,
          existingMission,
          this.context.getCurrentTimestamp()
        );

        await this.context.addOrUpdateMissionAsync(
          payload?.playerName,
          payload?.characterId,
          missionWithTimestamps
        );

        response.mission = { ...missionWithTimestamps };
      } catch (error) {
        this.context.log(`[mission-add-handler] Failed to add mission: ${error.message}`);
        response.success = false;
        response.message = 'Failed to record mission: database error';
        delete response.mission;
      }
    }

    socket.emit(MISSION_ADD_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  MissionAddMessageHandler
};
