'use strict';

const { MISSION_LIST_RESPONSE_EVENT } = require('../model/mission-list');
const { MISSION_CATALOG_IDS, MISSION_STATUS_SET, MISSION_STATUS_VALUES } = require('../model/mission');
const { INVALID_SESSION_EVENT, INVALID_SESSION_MESSAGE } = require('../model/session');
const {
  resolveCorrelationId,
  normalizeRequestIdentity: normalizeCorrelationRequestIdentity,
} = require('./correlation-metadata');

const MISSION_CATALOG_INDEX = new Map(
  MISSION_CATALOG_IDS.map((missionId, index) => [missionId, index])
);

class MissionListMessageHandler {
  /**
   * @param {Object} context
   */
  constructor(context) {
    this.context = context;
  }

  normalizeRequestIdentity(requestIdentity, payload) {
    return normalizeCorrelationRequestIdentity(
      {
        requestIdentity,
        operation: 'list-missions',
        entityTypeCandidates: ['mission'],
        containerIdCandidates: [payload?.characterId, '-'],
      },
      this.context.toNonEmptyString.bind(this.context)
    );
  }

  validateStatuses(statuses) {
    if (!Array.isArray(statuses)) {
      return {
        success: true,
        statuses: [],
      };
    }

    const normalizedStatuses = statuses.map((status) => this.context.toNonEmptyString(status));
    const invalidStatuses = normalizedStatuses.filter((status) => !MISSION_STATUS_SET.has(status));

    if (invalidStatuses.length > 0) {
      return {
        success: false,
        invalidStatuses,
        message: `statuses contains unsupported values: ${invalidStatuses.join(', ')}. Allowed values: ${MISSION_STATUS_VALUES.join(', ')}`,
      };
    }

    return {
      success: true,
      statuses: normalizedStatuses,
    };
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
    if (!MISSION_STATUS_SET.has(normalized.status)) {
      throw new Error(
        `mission normalization produced unsupported status: ${normalized.status || '(empty)'}. Allowed values: ${MISSION_STATUS_VALUES.join(', ')}`
      );
    }

    const responseMission = {
      missionId: normalized.missionId,
      status: normalized.status,
    };

    if (normalized.updatedAt !== undefined) {
      responseMission.updatedAt = normalized.updatedAt;
    }

    return responseMission;
  }

  buildInvalidStatusFailure(payload, playerName, characterId, message) {
    return this.attachRequestId(
      {
        success: false,
        message,
        playerName,
        characterId,
        missions: [],
      },
      payload
    );
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

  /**
   * Build mission-list response with optional status filtering and catalog ordering.
   * @param {Object} payload
   * @returns {Promise<Object>}
   */
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

    const statusValidation = this.validateStatuses(payload?.statuses);
    if (!statusValidation.success) {
      return this.buildInvalidStatusFailure(payload, player.playerName, characterId, statusValidation.message);
    }

    const statuses = statusValidation.statuses;
    const missions = await this.context.getMissionsAsync(playerName, characterId);

    const invalidPersistedMissions = missions.filter(
      (mission) => !MISSION_STATUS_SET.has(this.context.toNonEmptyString(mission?.status))
    );
    if (invalidPersistedMissions.length > 0) {
      const invalidStatuses = [
        ...new Set(
          invalidPersistedMissions
            .map((mission) => this.context.toNonEmptyString(mission?.status))
            .filter((status) => Boolean(status))
        ),
      ];
      return this.buildInvalidStatusFailure(
        payload,
        player.playerName,
        characterId,
        `mission data contains unsupported status values: ${invalidStatuses.join(', ')}. Allowed values: ${MISSION_STATUS_VALUES.join(', ')}`
      );
    }

    const filteredMissions = statuses.length
      ? missions.filter((mission) => statuses.includes(mission.status))
      : missions;
    const sortedMissions = this.sortMissions(filteredMissions);

    try {
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
    } catch (error) {
      return this.buildInvalidStatusFailure(
        payload,
        player.playerName,
        characterId,
        this.context.toNonEmptyString(error?.message) ||
          `mission normalization failed for unsupported status. Allowed values: ${MISSION_STATUS_VALUES.join(', ')}`
      );
    }
  }

  /**
   * Enforce session and emit mission-list-response.
   * @param {import('socket.io').Socket} socket
   * @param {Object} payload
   * @returns {Promise<Object>}
   */
  async handle(socket, payload) {
    this.context.logHandlerMessage('list-missions-request', payload);
    const correlationId = resolveCorrelationId(
      payload,
      this.context.toNonEmptyString.bind(this.context)
    );
    const requestIdentity = this.normalizeRequestIdentity(payload?.requestIdentity, payload);

    if (!(await this.context.hasValidSessionAsync(payload))) {
      const response = { message: INVALID_SESSION_MESSAGE };
      socket.emit(INVALID_SESSION_EVENT, response);
      return response;
    }

    this.context.detachIdleGameCharacters();
    this.context.touchJoinedCharacters(payload);

    const response = await this.buildResponse(payload);
    if (!response.success && /unsupported status/.test(this.context.toNonEmptyString(response.message))) {
      this.context.log(
        `[mission-list-validation] operation=list-missions entityType=${requestIdentity.entityType} containerId=${requestIdentity.containerId} correlationId=${correlationId} player=${this.context.toNonEmptyString(payload?.playerName) || '-'} characterId=${this.context.toNonEmptyString(payload?.characterId) || '-'} message=${this.context.toNonEmptyString(response.message)}`
      );
    }
    socket.emit(MISSION_LIST_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  MissionListMessageHandler,
};
