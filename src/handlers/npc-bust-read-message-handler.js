'use strict';

const { NPC_BUST_READ_RESPONSE_EVENT } = require('../model/npc-bust-read');
const { resolveCorrelationId } = require('./correlation-metadata');
const { makeBustRequestIdentity } = require('./bust-lifecycle');

class NpcBustReadMessageHandler {
  constructor(context) {
    this.context = context;
  }

  async handle(socket, payload) {
    this.context.logHandlerMessage('npc-bust-read', payload);
    const correlationId = resolveCorrelationId(payload, this.context.toNonEmptyString.bind(this.context));
    const requestIdentity = makeBustRequestIdentity('npc-bust-read', 'npc-bust', [payload?.npcId, '-'], payload?.requestIdentity, this.context.toNonEmptyString.bind(this.context));


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
