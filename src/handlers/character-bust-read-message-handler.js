'use strict';

const { CHARACTER_BUST_READ_RESPONSE_EVENT } = require('../model/character-bust-read');
const { INVALID_SESSION_EVENT, INVALID_SESSION_MESSAGE } = require('../model/session');
const { resolveCorrelationId, normalizeRequestIdentity } = require('./correlation-metadata');

class CharacterBustReadMessageHandler {
  constructor(context) {
    this.context = context;
  }

  normalizeRequestIdentity(requestIdentity, payload) {
    return normalizeRequestIdentity(
      {
        requestIdentity,
        operation: 'character-bust-read',
        entityTypeCandidates: ['character-bust'],
        containerIdCandidates: [payload?.characterId, '-'],
      },
      this.context.toNonEmptyString.bind(this.context)
    );
  }

  async handle(socket, payload) {
    this.context.logHandlerMessage('character-bust-read', payload);
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
      socket.emit(CHARACTER_BUST_READ_RESPONSE_EVENT, response);
      return response;
    }

    const character = this.context.findCharacter(playerName, characterId);
    if (!character) {
      const response = {
        success: false,
        message: 'Character is not in player list',
        ...baseResponse,
      };
      socket.emit(CHARACTER_BUST_READ_RESPONSE_EVENT, response);
      return response;
    }

    const descriptor = await this.context.getCharacterBustAsync(playerName, characterId);
    if (!descriptor) {
      const response = {
        success: false,
        message: 'Character bust descriptor is not set',
        ...baseResponse,
      };
      socket.emit(CHARACTER_BUST_READ_RESPONSE_EVENT, response);
      return response;
    }

    const response = {
      success: true,
      message: 'Character bust descriptor retrieved successfully',
      ...baseResponse,
      descriptor,
    };
    socket.emit(CHARACTER_BUST_READ_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  CharacterBustReadMessageHandler,
};
