'use strict';

const { NPC_BUST_UPDATE_RESPONSE_EVENT } = require('../model/npc-bust-update');
const { resolveCorrelationId } = require('./correlation-metadata');
const {
  BUST_BLOCKED_SAVE_REASONS,
  buildBlockedSaveResponse,
  buildNpcDescriptorForWrite,
  buildValidationFailureResponse,
  makeBustRequestIdentity,
} = require('./bust-lifecycle');

class NpcBustUpdateMessageHandler {
  constructor(context) {
    this.context = context;
  }

  async handle(socket, payload) {
    this.context.logHandlerMessage('npc-bust-update', payload);
    const correlationId = resolveCorrelationId(payload, this.context.toNonEmptyString.bind(this.context));
    const requestIdentity = makeBustRequestIdentity('npc-bust-update', 'npc-bust', [payload?.npcId, '-'], payload?.requestIdentity, this.context.toNonEmptyString.bind(this.context));


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
      socket.emit(NPC_BUST_UPDATE_RESPONSE_EVENT, response);
      return response;
    }

    const existing = await this.context.getNpcBustAsync(npcId);
    if (!existing) {
      const response = buildBlockedSaveResponse(
        'NPC bust descriptor is not set',
        BUST_BLOCKED_SAVE_REASONS.NPC_BUST_NOT_FOUND,
        baseResponse
      );
      socket.emit(NPC_BUST_UPDATE_RESPONSE_EVENT, response);
      return response;
    }

    const normalized = buildNpcDescriptorForWrite(payload, existing);
    if (normalized.errors.length > 0) {
      const response = buildValidationFailureResponse(
        'Bust descriptor validation failed',
        normalized.errors,
        baseResponse
      );
      socket.emit(NPC_BUST_UPDATE_RESPONSE_EVENT, response);
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
        message: 'NPC bust descriptor updated successfully',
        ...baseResponse,
        deterministicSeed: normalized.deterministicSeed,
        descriptor: normalized.descriptor,
        appliedOverrides: normalized.appliedOverrides,
      };
      socket.emit(NPC_BUST_UPDATE_RESPONSE_EVENT, response);
      return response;
    } catch (error) {
      const response = buildBlockedSaveResponse(
        'Failed to update NPC bust descriptor: database error',
        BUST_BLOCKED_SAVE_REASONS.DATABASE_ERROR,
        baseResponse,
        { retryable: true }
      );
      socket.emit(NPC_BUST_UPDATE_RESPONSE_EVENT, response);
      return response;
    }
  }
}

module.exports = {
  NpcBustUpdateMessageHandler,
};
