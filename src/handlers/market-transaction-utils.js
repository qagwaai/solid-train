'use strict';

/**
 * Shared buildResponse logic for market buy and sell handlers.
 * Handles payload validation, context transaction dispatch, and response shaping.
 *
 * @param {Object} context - MessageHandlerContext
 * @param {Object} payload
 * @param {'buy'|'sell'} direction
 * @param {Object} FAILURE_REASONS - domain-specific reason constants (must include INVALID_PAYLOAD)
 * @param {function(string): string} messageForReason - maps result.reason to a client message
 * @returns {Promise<Object>}
 */
async function buildMarketTransactionResponse(context, payload, direction, FAILURE_REASONS, messageForReason) {
  const playerName = context.toNonEmptyString(payload?.playerName);
  const characterId = context.toNonEmptyString(payload?.characterId);
  const marketId = context.toNonEmptyString(payload?.marketId);
  const solarSystemId = context.toNonEmptyString(payload?.solarSystemId);
  const itemId = context.toNonEmptyString(payload?.itemId).toLowerCase();
  const quantity = Number.isInteger(payload?.quantity)
    ? payload.quantity
    : Number(payload?.quantity);
  const requestId = context.toNonEmptyString(payload?.requestId) || null;

  if (
    !playerName ||
    !characterId ||
    !marketId ||
    !solarSystemId ||
    !itemId ||
    !Number.isInteger(quantity) ||
    quantity <= 0
  ) {
    return {
      success: false,
      message:
        'playerName, characterId, marketId, solarSystemId, itemId, and positive integer quantity are required',
      reason: FAILURE_REASONS.INVALID_PAYLOAD,
      requestId,
    };
  }

  const result = await context.executeMarketTransactionAsync({
    playerName,
    characterId,
    marketId,
    solarSystemId,
    itemId,
    quantity,
    direction,
    requestId,
    transactionId: context.toNonEmptyString(payload?.transactionId),
  });

  if (!result.success) {
    return {
      success: false,
      message: messageForReason(result.reason),
      reason: result.reason,
      requestId,
    };
  }

  return {
    success: true,
    message: `Market ${direction} transaction completed`,
    requestId,
    transaction: result.transaction,
  };
}

module.exports = { buildMarketTransactionResponse };
