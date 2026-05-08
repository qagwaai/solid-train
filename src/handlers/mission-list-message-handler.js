'use strict';

const { MISSION_LIST_RESPONSE_EVENT } = require('../model/mission-list');
const { MISSION_CATALOG_IDS, MISSION_STATUS_VALUES } = require('../model/mission');
const { INVALID_SESSION_EVENT, INVALID_SESSION_MESSAGE } = require('../model/session');

const MISSION_STATUS_SET = new Set(MISSION_STATUS_VALUES);
const MISSION_CATALOG_INDEX = new Map(
  MISSION_CATALOG_IDS.map((missionId, index) => [missionId, index])
);

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
      .filter((status) => Boolean(status) && MISSION_STATUS_SET.has(status));
  }

  attachRequestId(response, payload) {
    const requestId = this.context.toNonEmptyString(payload?.requestId);
    if (requestId) {
      response.requestId = requestId;
    }

    return response;
  }

  formatMissionForResponse(mission) {
    const normalized = this.context.normalizeMission(mission);
    const responseMission = {
      missionId: normalized.missionId,
      status: normalized.status,
    };

    const optionalFields = [
      'startedAt',
      'inProgressAt',
      'failedAt',
      'completedAt',
      'updatedAt',
      'failureReason',
      'statusDetail',
    ];

    for (const field of optionalFields) {
      if (normalized[field] !== undefined) {
        responseMission[field] = normalized[field];
      }
    }

    return responseMission;
  }

  sortMissions(missions) {
    return [...missions].sort((left, right) => {
      const leftIndex = MISSION_CATALOG_INDEX.has(left.missionId)
        ? MISSION_CATALOG_INDEX.get(left.missionId)
        : Number.MAX_SAFE_INTEGER;
      const rightIndex = MISSION_CATALOG_INDEX.has(right.missionId)
        ? MISSION_CATALOG_INDEX.get(right.missionId)
        : Number.MAX_SAFE_INTEGER;

      if (leftIndex !== rightIndex) {
        return leftIndex - rightIndex;
      }

      return left.missionId.localeCompare(right.missionId);
    });
  }

  async buildResponse(payload) {
    const playerName = this.context.toNonEmptyString(payload?.playerName);
    const characterId = this.context.toNonEmptyString(payload?.characterId);

    if (!playerName || !characterId) {
      return this.attachRequestId(
        {
          success: false,
          message: 'playerName and characterId are required',
          playerName,
          characterId,
          missions: [],
        },
        payload
      );
    }

    const player = this.context.getPlayer(playerName);
    if (!player) {
      return this.attachRequestId(
        {
          success: false,
          message: 'Player is not registered',
          playerName,
          characterId,
          missions: [],
        },
        payload
      );
    }

    const character = this.context.findCharacter(playerName, characterId);
    if (!character) {
      return this.attachRequestId(
        {
          success: false,
          message: 'Character is not in player list',
          playerName: player.playerName,
          characterId,
          missions: [],
        },
        payload
      );
    }

    const statuses = this.sanitizeStatuses(payload?.statuses);
    const missions = await this.context.getMissionsAsync(playerName, characterId);
    const filteredMissions = statuses.length
      ? missions.filter((mission) => statuses.includes(mission.status))
      : missions;
    const sortedMissions = this.sortMissions(filteredMissions);

    return this.attachRequestId(
      {
        success: true,
        message: 'Mission list retrieved successfully',
        playerName: player.playerName,
        characterId,
        missions: sortedMissions.map((mission) => this.formatMissionForResponse(mission)),
      },
      payload
    );
  }

  async handle(socket, payload) {
    this.context.logHandlerMessage('list-missions-request', payload);

    if (!(await this.context.hasValidSessionAsync(payload))) {
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
  MissionListMessageHandler,
};
