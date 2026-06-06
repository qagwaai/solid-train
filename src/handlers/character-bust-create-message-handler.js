'use strict';

const { CHARACTER_BUST_CREATE_RESPONSE_EVENT } = require('../model/character-bust-create');
const { INVALID_SESSION_EVENT, INVALID_SESSION_MESSAGE } = require('../model/session');
const { resolveCorrelationId, normalizeRequestIdentity } = require('./correlation-metadata');
const {
  buildCharacterDescriptorForWrite,
  buildValidationFailureResponse,
} = require('./bust-lifecycle');

class CharacterBustCreateMessageHandler {
  constructor(context) {
    this.context = context;
  }

  normalizeRequestIdentity(requestIdentity, payload) {
    return normalizeRequestIdentity(
      {
        requestIdentity,
        operation: 'character-bust-create',
        entityTypeCandidates: ['character-bust'],
        containerIdCandidates: [payload?.characterId, '-'],
      },
      this.context.toNonEmptyString.bind(this.context)
    );
  }

  async handle(socket, payload) {
    this.context.logHandlerMessage('character-bust-create', payload);
    const correlationId = resolveCorrelationId(payload, this.context.toNonEmptyString.bind(this.context));
    const requestIdentity = this.normalizeRequestIdentity(payload?.requestIdentity, payload);

    if (!(await this.context.hasValidSessionAsync(payload))) {
      const response = { message: INVALID_SESSION_MESSAGE };
      socket.emit(INVALID_SESSION_EVENT, response);
      return response;
    }

    const playerName = this.context.toNonEmptyString(payload?.playerName);
    const characterId = this.context.toNonEmptyString(payload?.characterId);
    const baseResponse = {
      correlationId,
      requestIdentity,
      playerName,
      characterId,
    };

    if (!playerName || !characterId) {
      const validationErrors = [];
      if (!playerName) {
        validationErrors.push({
          field: 'playerName',
          reason: 'must be a non-empty string',
          rejectedValue: payload?.playerName,
        });
      }
      if (!characterId) {
        validationErrors.push({
          field: 'characterId',
          reason: 'must be a non-empty string',
          rejectedValue: payload?.characterId,
        });
      }

      const response = buildValidationFailureResponse(
        'Bust descriptor validation failed',
        validationErrors,
        baseResponse
      );
      socket.emit(CHARACTER_BUST_CREATE_RESPONSE_EVENT, response);
      return response;
    }

    const player = await this.context.getPlayerAsync(playerName);
    if (!player) {
      const response = {
        success: false,
        message: 'Player is not registered',
        ...baseResponse,
      };
      socket.emit(CHARACTER_BUST_CREATE_RESPONSE_EVENT, response);
      return response;
    }

    const character = this.context.findCharacter(playerName, characterId);
    if (!character) {
      const response = {
        success: false,
        message: 'Character is not in player list',
        ...baseResponse,
      };
      socket.emit(CHARACTER_BUST_CREATE_RESPONSE_EVENT, response);
      return response;
    }

    const normalized = buildCharacterDescriptorForWrite(payload?.descriptor);
    if (normalized.errors.length > 0) {
      const response = buildValidationFailureResponse(
        'Bust descriptor validation failed',
        normalized.errors,
        baseResponse
      );
      socket.emit(CHARACTER_BUST_CREATE_RESPONSE_EVENT, response);
      return response;
    }

    try {
      await this.context.updateCharacterBustAsync(playerName, characterId, normalized.descriptor);
      const response = {
        success: true,
        message: 'Character bust descriptor created successfully',
        ...baseResponse,
        descriptor: normalized.descriptor,
      };
      socket.emit(CHARACTER_BUST_CREATE_RESPONSE_EVENT, response);
      return response;
    } catch (error) {
      const response = {
        success: false,
        message: 'Failed to create character bust descriptor: database error',
        ...baseResponse,
      };
      socket.emit(CHARACTER_BUST_CREATE_RESPONSE_EVENT, response);
      return response;
    }
  }
}

module.exports = {
  CharacterBustCreateMessageHandler,
};
