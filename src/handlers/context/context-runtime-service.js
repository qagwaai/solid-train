'use strict';

async function withDb(ctx, operationName, operation) {
  if (!ctx.databaseService) {
    return null;
  }

  try {
    return await operation(ctx.databaseService);
  } catch (error) {
    ctx.log(`[context] Error ${operationName}: ${error.message}`);
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
    ctx.log(`[context] Error ${operationName}: ${error.message}`);
    return null;
  }
}

function logHandlerMessage(ctx, messageType, payload) {
  const player = ctx.toNonEmptyString(payload?.playerName) || '-';
  const character =
    ctx.toNonEmptyString(payload?.characterId) ||
    ctx.toNonEmptyString(payload?.characterName) ||
    '-';
  const sessionId = ctx.toNonEmptyString(payload?.sessionKey) || '-';

  ctx.log(
    `[handler] messageType=${messageType} player=${player} character=${character} sessionId=${sessionId}`
  );
}

module.exports = {
  withDb,
  withDbOrNull,
  logHandlerMessage,
};
