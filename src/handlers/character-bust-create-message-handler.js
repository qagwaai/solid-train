'use strict';

const { CHARACTER_BUST_CREATE_RESPONSE_EVENT } = require('../model/character-bust-create');
const { resolveCorrelationId } = require('./correlation-metadata');
const {
  BUST_BLOCKED_SAVE_REASONS,
  buildBlockedSaveResponse,
  buildCharacterDescriptorForWrite,
  buildValidationFailureResponse,
  makeBustRequestIdentity,
} = require('./bust-lifecycle');

class CharacterBustCreateMessageHandler {
  constructor(context) {
    this.context = context;
  }

  async handle(socket, payload) {
    this.context.logHandlerMessage('character-bust-create', payload);
    const correlationId = resolveCorrelationId(payload, this.context.toNonEmptyString.bind(this.context));
    const requestIdentity = makeBustRequestIdentity('character-bust-create', 'character-bust', [payload?.characterId, '-'], payload?.requestIdentity, this.context.toNonEmptyString.bind(this.context));


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
      const response = buildBlockedSaveResponse(
        'Player is not registered',
        BUST_BLOCKED_SAVE_REASONS.PLAYER_NOT_REGISTERED,
        baseResponse
      );
      socket.emit(CHARACTER_BUST_CREATE_RESPONSE_EVENT, response);
      return response;
    }

    const character = this.context.findCharacter(playerName, characterId);
    if (!character) {
      const response = buildBlockedSaveResponse(
        'Character is not in player list',
        BUST_BLOCKED_SAVE_REASONS.CHARACTER_NOT_FOUND,
        baseResponse
      );
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
      const response = buildBlockedSaveResponse(
        'Failed to create character bust descriptor: database error',
        BUST_BLOCKED_SAVE_REASONS.DATABASE_ERROR,
        baseResponse,
        { retryable: true }
      );
      socket.emit(CHARACTER_BUST_CREATE_RESPONSE_EVENT, response);
      return response;
    }
  }
}

module.exports = {
  CharacterBustCreateMessageHandler,
};
