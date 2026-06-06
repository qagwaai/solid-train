'use strict';

const { NPC_BUST_CREATE_RESPONSE_EVENT } = require('../model/npc-bust-create');
const { INVALID_SESSION_EVENT, INVALID_SESSION_MESSAGE } = require('../model/session');
const { resolveCorrelationId, normalizeRequestIdentity } = require('./correlation-metadata');
const {
  buildNpcDescriptorForWrite,
  buildValidationFailureResponse,
} = require('./bust-lifecycle');

class NpcBustCreateMessageHandler {
  constructor(context) {
    this.context = context;
  }

  normalizeRequestIdentity(requestIdentity, payload) {
    return normalizeRequestIdentity(
      {
        requestIdentity,
        operation: 'npc-bust-create',
        entityTypeCandidates: ['npc-bust'],
        containerIdCandidates: [payload?.npcId, '-'],
      },
      this.context.toNonEmptyString.bind(this.context)
    );
  }

  async handle(socket, payload) {
    this.context.logHandlerMessage('npc-bust-create', payload);
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
      const response = buildValidationFailureResponse(
        'Bust descriptor validation failed',
        [
          {
            field: 'npcId',
            reason: 'must be a non-empty string',
            rejectedValue: payload?.npcId,
          },
        ],
        baseResponse
      );
      socket.emit(NPC_BUST_CREATE_RESPONSE_EVENT, response);
      return response;
    }

    const normalized = buildNpcDescriptorForWrite(payload, null);
    if (normalized.errors.length > 0) {
      const response = buildValidationFailureResponse(
        'Bust descriptor validation failed',
        normalized.errors,
        baseResponse
      );
      socket.emit(NPC_BUST_CREATE_RESPONSE_EVENT, response);
      return response;
    }

    try {
      await this.context.upsertNpcBustAsync(
        npcId,
        normalized.deterministicSeed,
        normalized.descriptor,
        normalized.appliedOverrides
      );
      const response = {
        success: true,
        message: 'NPC bust descriptor created successfully',
        ...baseResponse,
        deterministicSeed: normalized.deterministicSeed,
        descriptor: normalized.descriptor,
        appliedOverrides: normalized.appliedOverrides,
      };
      socket.emit(NPC_BUST_CREATE_RESPONSE_EVENT, response);
      return response;
    } catch (error) {
      const response = {
        success: false,
        message: 'Failed to create NPC bust descriptor: database error',
        ...baseResponse,
      };
      socket.emit(NPC_BUST_CREATE_RESPONSE_EVENT, response);
      return response;
    }
  }
}

module.exports = {
  NpcBustCreateMessageHandler,
};
