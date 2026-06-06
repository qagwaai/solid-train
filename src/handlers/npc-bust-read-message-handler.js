'use strict';

const { NPC_BUST_READ_RESPONSE_EVENT } = require('../model/npc-bust-read');
const { INVALID_SESSION_EVENT, INVALID_SESSION_MESSAGE } = require('../model/session');
const { resolveCorrelationId, normalizeRequestIdentity } = require('./correlation-metadata');

class NpcBustReadMessageHandler {
  constructor(context) {
    this.context = context;
  }

  normalizeRequestIdentity(requestIdentity, payload) {
    return normalizeRequestIdentity(
      {
        requestIdentity,
        operation: 'npc-bust-read',
        entityTypeCandidates: ['npc-bust'],
        containerIdCandidates: [payload?.npcId, '-'],
      },
      this.context.toNonEmptyString.bind(this.context)
    );
  }

  async handle(socket, payload) {
    this.context.logHandlerMessage('npc-bust-read', payload);
    const correlationId = resolveCorrelationId(payload, this.context.toNonEmptyString.bind(this.context));
    const requestIdentity = this.normalizeRequestIdentity(payload?.requestIdentity, payload);

    if (!(await this.context.hasValidSessionAsync(payload))) {
      const response = { message: INVALID_SESSION_MESSAGE };
      socket.emit(INVALID_SESSION_EVENT, response);
      return response;
    }

    const npcId = this.context.toNonEmptyString(payload?.npcId);
    const baseResponse = {
      correlationId,
      requestIdentity,
      npcId,
    };

    if (!npcId) {
      const response = {
        success: false,
        message: 'npcId is required',
        ...baseResponse,
      };
      socket.emit(NPC_BUST_READ_RESPONSE_EVENT, response);
      return response;
    }

    const record = await this.context.getNpcBustAsync(npcId);
    if (!record) {
      const response = {
        success: false,
        message: 'NPC bust descriptor is not set',
        ...baseResponse,
      };
      socket.emit(NPC_BUST_READ_RESPONSE_EVENT, response);
      return response;
    }

    const response = {
      success: true,
      message: 'NPC bust descriptor retrieved successfully',
      ...baseResponse,
      deterministicSeed: record.deterministicSeed,
      descriptor: record.descriptor,
      appliedOverrides: Array.isArray(record.appliedOverrides) ? record.appliedOverrides : [],
    };
    socket.emit(NPC_BUST_READ_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = {
  NpcBustReadMessageHandler,
};
