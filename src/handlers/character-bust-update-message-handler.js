'use strict';

const { CHARACTER_BUST_UPDATE_RESPONSE_EVENT } = require('../model/character-bust-update');
const { INVALID_SESSION_EVENT, INVALID_SESSION_MESSAGE } = require('../model/session');
const { resolveCorrelationId, normalizeRequestIdentity } = require('./correlation-metadata');
const {
  buildCharacterDescriptorForWrite,
  buildValidationFailureResponse,
} = require('./bust-lifecycle');

class CharacterBustUpdateMessageHandler {
  constructor(context) {
    this.context = context;
  }

  normalizeRequestIdentity(requestIdentity, payload) {
    return normalizeRequestIdentity(
      {
        requestIdentity,
        operation: 'character-bust-update',
        entityTypeCandidates: ['character-bust'],
        containerIdCandidates: [payload?.characterId, '-'],
      },
      this.context.toNonEmptyString.bind(this.context)
    );
  }

  async handle(socket, payload) {
    this.context.logHandlerMessage('character-bust-update', payload);
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

    const player = await this.context.getPlayerAsync(playerName);
    if (!player) {
      const response = {
        success: false,
        message: 'Player is not registered',
        ...baseResponse,
      };
      socket.emit(CHARACTER_BUST_UPDATE_RESPONSE_EVENT, response);
      return response;
    }

    const character = this.context.findCharacter(playerName, characterId);
    if (!character) {
      const response = {
        success: false,
        message: 'Character is not in player list',
        ...baseResponse,
      };
      socket.emit(CHARACTER_BUST_UPDATE_RESPONSE_EVENT, response);
      return response;
    }

    const existing = await this.context.getCharacterBustAsync(playerName, characterId);
    if (!existing) {
      const response = {
        success: false,
        message: 'Character bust descriptor is not set',
        ...baseResponse,
      };
      socket.emit(CHARACTER_BUST_UPDATE_RESPONSE_EVENT, response);
      return response;
    }

    const normalized = buildCharacterDescriptorForWrite(payload?.descriptor);
    if (normalized.errors.length > 0) {
      const response = buildValidationFailureResponse(
        'Bust descriptor validation failed',
        normalized.errors,
        baseResponse
      );
      socket.emit(CHARACTER_BUST_UPDATE_RESPONSE_EVENT, response);
      return response;
    }

    try {
      await this.context.updateCharacterBustAsync(playerName, characterId, normalized.descriptor);
      const response = {
        success: true,
        message: 'Character bust descriptor updated successfully',
        ...baseResponse,
        descriptor: normalized.descriptor,
      };
      socket.emit(CHARACTER_BUST_UPDATE_RESPONSE_EVENT, response);
      return response;
    } catch (error) {
      const response = {
        success: false,
        message: 'Failed to update character bust descriptor: database error',
        ...baseResponse,
      };
      socket.emit(CHARACTER_BUST_UPDATE_RESPONSE_EVENT, response);
      return response;
    }
  }
}

module.exports = {
  CharacterBustUpdateMessageHandler,
};
