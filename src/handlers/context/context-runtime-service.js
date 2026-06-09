'use strict';

async function withDb(ctx, operationName, operation) {
  if (!ctx.databaseService) {
    return null;
  }

  try {
    return await operation(ctx.databaseService);
  } catch (error) {
    ctx.log(`[context] Error ${operationName}: ${error.message}`, { level: 'error' });
    throw error;
  }
}

async function withDbOrNull(ctx, operationName, operation) {
  if (!ctx.databaseService) {
    return null;
  }

  try {
    return await operation(ctx.databaseService);
  } catch (error) {
    ctx.log(`[context] Error ${operationName}: ${error.message}`, { level: 'error' });
    return null;
  }
}

function logHandlerMessage(ctx, messageType, payload, options = {}) {
  const player = ctx.toNonEmptyString(payload?.playerName) || '-';
  const character =
    ctx.toNonEmptyString(payload?.characterId) ||
    ctx.toNonEmptyString(payload?.characterName) ||
    '-';
  const sessionId = ctx.toNonEmptyString(payload?.sessionKey) || '-';
  const correlationId =
    ctx.toNonEmptyString(payload?.correlationId) ||
    ctx.toNonEmptyString(payload?.requestId) ||
    ctx.toNonEmptyString(payload?.messageId) ||
    '-';

  ctx.log(
    `[handler] messageType=${messageType} player=${player} character=${character} sessionId=${sessionId} correlationId=${correlationId}`,
    { level: options.level || 'info' }
  );
}

module.exports = {
  withDb,
  withDbOrNull,
  logHandlerMessage,
};
