'use strict';

const { CHARACTER_BUST_READ_RESPONSE_EVENT } = require('../model/character-bust-read');

const { resolveCorrelationId } = require('./correlation-metadata');
const { makeBustRequestIdentity } = require('./bust-lifecycle');

class CharacterBustReadMessageHandler {
  constructor(context) {
    this.context = context;
  }

  async handle(socket, payload) {
    this.context.logHandlerMessage('character-bust-read', payload);
    const correlationId = resolveCorrelationId(payload, this.context.toNonEmptyString.bind(this.context));
    const requestIdentity = makeBustRequestIdentity('character-bust-read', 'character-bust', [payload?.characterId, '-'], payload?.requestIdentity, this.context.toNonEmptyString.bind(this.context));

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
