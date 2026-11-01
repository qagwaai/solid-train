'use strict';

const CREDIT_LEDGER_LIST_REQUEST_EVENT = 'credit-ledger-list-request';
const CREDIT_LEDGER_LIST_RESPONSE_EVENT = 'credit-ledger-list-response';
const DEFAULT_CREDIT_LEDGER_LIMIT = 50;
const MAX_CREDIT_LEDGER_LIMIT = 200;

/**
 * @typedef {Object} CreditLedgerListRequest
 * @property {string} playerName
 * @property {string} sessionKey
 * @property {string} correlationId
 * @property {{operation: 'credit-ledger-list', entityType: 'credit-ledger', containerId: string, [key: string]: unknown}} requestIdentity
 * @property {string} [characterId]
 * @property {string} [startAt]
 * @property {string} [endAt]
 * @property {number} [offset]
 * @property {number} [limit]
 */

function creditLedgerFailure(payload, reason, message) {
  return {
    success: false,
    reason,
    message,
    playerName: typeof payload?.playerName === 'string' ? payload.playerName : '',
    correlationId: payload?.correlationId ?? null,
    requestIdentity: payload?.requestIdentity ?? null,
    entries: [],
    total: 0,
    balance: 0,
    offset: Number.isSafeInteger(payload?.offset) && payload.offset >= 0 ? payload.offset : 0,
    limit:
      Number.isSafeInteger(payload?.limit) && payload.limit > 0
        ? Math.min(payload.limit, MAX_CREDIT_LEDGER_LIMIT)
        : DEFAULT_CREDIT_LEDGER_LIMIT,
  };
}

module.exports = {
  CREDIT_LEDGER_LIST_REQUEST_EVENT,
  CREDIT_LEDGER_LIST_RESPONSE_EVENT,
  DEFAULT_CREDIT_LEDGER_LIMIT,
  MAX_CREDIT_LEDGER_LIMIT,
  creditLedgerFailure,
};
