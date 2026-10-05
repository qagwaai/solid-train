'use strict';

const Ajv = require('ajv');
const requestSchema = require('../../api/schemas/credit-ledger-list-request.schema.json');
const {
  CREDIT_LEDGER_LIST_REQUEST_EVENT,
  CREDIT_LEDGER_LIST_RESPONSE_EVENT,
  DEFAULT_CREDIT_LEDGER_LIMIT,
  MAX_CREDIT_LEDGER_LIMIT,
  creditLedgerFailure,
} = require('../model/credit-ledger-list');

const validateRequest = new Ajv({ allErrors: true, format: 'full' }).compile(requestSchema);

class CreditLedgerListMessageHandler {
  constructor(context) {
    this.context = context;
  }

  async buildResponse(payload) {
    if (!validateRequest(payload)) {
      return creditLedgerFailure(payload, 'invalid-request', 'Invalid credit ledger request');
    }

    const expectedContainer =
      payload.characterId || `player-${payload.playerName.trim().toLowerCase()}`;
    if (payload.requestIdentity.containerId !== expectedContainer) {
      return creditLedgerFailure(
        payload,
        'invalid-request',
        'requestIdentity.containerId does not match ledger scope'
      );
    }
    const startAt = payload.startAt ? Date.parse(payload.startAt) : -Infinity;
    const endAt = payload.endAt ? Date.parse(payload.endAt) : Infinity;
    if (Number.isNaN(startAt) || Number.isNaN(endAt)) {
      return creditLedgerFailure(
        payload,
        'invalid-request',
        'Date bounds must be parseable instants'
      );
    }
    if (startAt > endAt) {
      return creditLedgerFailure(payload, 'invalid-request', 'startAt must not be after endAt');
    }

    const characters = await this.context.getCharactersAsync(payload.playerName, { strict: true });
    const scopedCharacters = (
      payload.characterId
        ? characters.filter((character) => character.id === payload.characterId)
        : characters
    ).map((character) => this.context.normalizeCharacter(character));
    if (payload.characterId && scopedCharacters.length === 0) {
      return creditLedgerFailure(
        payload,
        'character-not-found',
        'Character was not found or is not owned by this player'
      );
    }

    const ledger = scopedCharacters.flatMap((character) => character.creditLedger);
    if (new Set(ledger.map((entry) => entry.id)).size !== ledger.length) {
      throw new Error('Credit ledger contains duplicate entry IDs');
    }
    const balance = ledger.reduce(
      (sum, entry) => sum + (entry.type === 'put' ? entry.amount : -entry.amount),
      0
    );
    if (!Number.isFinite(balance)) {
      throw new Error('Credit ledger balance is not finite');
    }
    const entries = ledger
      .filter((entry) => {
        const timestamp = Date.parse(entry.timestamp);
        return timestamp >= startAt && timestamp <= endAt;
      })
      .sort((left, right) => {
        const timeOrder = Date.parse(right.timestamp) - Date.parse(left.timestamp);
        return timeOrder || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
      });
    const offset = payload.offset ?? 0;
    const limit = Math.min(payload.limit ?? DEFAULT_CREDIT_LEDGER_LIMIT, MAX_CREDIT_LEDGER_LIMIT);

    return {
      success: true,
      message: 'Credit ledger retrieved successfully',
      playerName: this.context.getPlayer(payload.playerName).playerName,
      correlationId: payload.correlationId,
      requestIdentity: payload.requestIdentity,
      entries: entries.slice(offset, offset + limit),
      total: entries.length,
      balance,
      offset,
      limit,
    };
  }

  async handle(socket, payload) {
    this.context.logHandlerMessage(CREDIT_LEDGER_LIST_REQUEST_EVENT, payload);
    const response = await this.buildResponse(payload);
    socket.emit(CREDIT_LEDGER_LIST_RESPONSE_EVENT, response);
    return response;
  }
}

module.exports = { CreditLedgerListMessageHandler };
