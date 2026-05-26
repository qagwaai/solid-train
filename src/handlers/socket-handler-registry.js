'use strict';

const { REGISTER_EVENT } = require('../model/register');
const { LOGIN_EVENT } = require('../model/login');
const { CHARACTER_LIST_REQUEST_EVENT } = require('../model/character-list');
const { CHARACTER_ADD_REQUEST_EVENT } = require('../model/character-add');
const { CHARACTER_DELETE_REQUEST_EVENT } = require('../model/character-delete');
const { CHARACTER_EDIT_REQUEST_EVENT } = require('../model/character-edit');
const { SHIP_LIST_REQUEST_EVENT } = require('../model/ship-list');
const { SHIP_UPSERT_REQUEST_EVENT } = require('../model/ship-upsert');
const { SHIP_LIST_BY_OWNER_REQUEST_EVENT } = require('../model/ship-list-by-owner');
const { SHIP_TRANSFER_REQUEST_EVENT } = require('../model/ship-transfer');
const { GAME_JOIN_REQUEST_EVENT } = require('../model/game-join');
const {
  MISSION_UPSERT_REQUEST_EVENT,
} = require('../model/mission-upsert');
const { CELESTIAL_BODY_UPSERT_REQUEST_EVENT } = require('../model/celestial-body-upsert');
const { CELESTIAL_BODY_LIST_REQUEST_EVENT } = require('../model/celestial-body-list');
const { MISSION_LIST_REQUEST_EVENT } = require('../model/mission-list');
const { ITEM_UPSERT_REQUEST_EVENT } = require('../model/item-upsert');
const { ITEM_LIST_BY_CONTAINER_REQUEST_EVENT } = require('../model/item-list-by-container');
const { ITEM_LIST_BY_LOCATION_REQUEST_EVENT } = require('../model/item-list-by-location');
const { ITEM_REMOVE_REQUEST_EVENT } = require('../model/item-remove');
const { LAUNCH_ITEM_REQUEST_EVENT } = require('../model/launch-item');
const {
  TRACTOR_BEAM_ACTIVATE_REQUEST_EVENT,
} = require('../model/tractor-beam-activate');
const { MARKET_LIST_REQUEST_EVENT } = require('../model/market-list');
const { MARKET_LIST_BY_LOCATION_REQUEST_EVENT } = require('../model/market-list-by-location');
const { MARKET_QUOTE_REQUEST_EVENT } = require('../model/market-quote');
const { MARKET_INVENTORY_LIST_REQUEST_EVENT } = require('../model/market-inventory-list');
const { MARKET_LEDGER_LIST_REQUEST_EVENT } = require('../model/market-ledger-list');
const { MARKET_BUY_REQUEST_EVENT } = require('../model/market-buy');
const { MARKET_SELL_REQUEST_EVENT } = require('../model/market-sell');
const { SOLAR_SYSTEM_LIST_REQUEST_EVENT } = require('../model/solar-system-list');
const { SOLAR_SYSTEM_GET_REQUEST_EVENT } = require('../model/solar-system-get');
const { STAR_LIST_REQUEST_EVENT } = require('../model/star-list');
const { STAR_GET_REQUEST_EVENT } = require('../model/star-get');
const {
  resolveCorrelationId,
  normalizeRequestIdentity,
  applyCorrelationEcho,
} = require('./correlation-metadata');

function toNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : '';
}

const RESPONSE_CHANNEL_BY_OPERATION = Object.freeze({
  register: 'register-response',
  login: 'login-response',
  'character-list': 'character-list-response',
  'character-add': 'character-add-response',
  'character-delete': 'character-delete-response',
  'character-edit': 'character-edit-response',
  'ship-list': 'ship-list-response',
  'ship-list-by-owner': 'ship-list-by-owner-response',
  'ship-upsert': 'ship-upsert-response',
  'ship-transfer': 'ship-transfer-response',
  'game-join': 'game-join-response',
  'mission-upsert': 'mission-upsert-response',
  'mission-list': 'list-missions-response',
  'list-missions': 'list-missions-response',
  'celestial-body-upsert': 'celestial-body-upsert-response',
  'celestial-body-list': 'celestial-body-list-response',
  'item-upsert': 'item-upsert-response',
  'item-list-by-container': 'item-list-by-container-response',
  'item-list-by-location': 'item-list-by-location-response',
  'item-remove': 'item-remove-response',
  'launch-item': 'launch-item-response',
  'tractor-beam-activate': 'tractor-beam-activate-response',
  'market-list': 'market-list-response',
  'market-list-by-location': 'market-list-by-location-response',
  'market-quote': 'market-quote-response',
  'market-inventory-list': 'market-inventory-list-response',
  'market-ledger-list': 'market-ledger-list-response',
  'market-buy': 'market-buy-response',
  'market-sell': 'market-sell-response',
  'solar-system-list': 'solar-system-list-response',
  'solar-system-get': 'solar-system-get-response',
  'star-list': 'star-list-response',
  'star-get': 'star-get-response',
});

function normalizeRequestIdentityFromPayload(payload, fallbackOperation) {
  return normalizeRequestIdentity(
    {
      requestIdentity: payload?.requestIdentity,
      operation: fallbackOperation,
      entityTypeCandidates: [
        payload?.itemType,
        payload?.ship?.model,
        payload?.ship?.id,
        payload?.missionId,
        payload?.marketId,
        'unknown',
      ],
      containerIdCandidates: [
        payload?.characterId,
        payload?.shipId,
        payload?.ship?.id,
        payload?.itemId,
        payload?.marketId,
        '-',
      ],
    },
    toNonEmptyString
  );
}

function resolveCorrelationMetadata(entry, payload) {
  const fallbackOperation = entry.operationOverride || entry.event.replace(/-request$/, '');
  const requestIdentity =
    entry.strictRequestIdentityEcho === true &&
    payload?.requestIdentity &&
    typeof payload.requestIdentity === 'object' &&
    !Array.isArray(payload.requestIdentity)
      ? payload.requestIdentity
      : normalizeRequestIdentityFromPayload(payload, fallbackOperation);
  const canonicalOperation = toNonEmptyString(entry.canonicalOperation);
  const correlationId =
    entry.strictCorrelationIdEcho === true &&
    typeof payload?.correlationId === 'string' &&
    payload.correlationId.trim().length > 0
      ? payload.correlationId
      : resolveCorrelationId(payload, toNonEmptyString);

  return {
    correlationId,
    requestIdentity: canonicalOperation
      ? {
          ...requestIdentity,
          operation: canonicalOperation,
        }
      : requestIdentity,
  };
}

function buildEchoPayload(entry, eventName, payload, correlationMetadata) {
  if (eventName === 'invalid-session') {
    return payload;
  }

  const echoedPayload = applyCorrelationEcho(payload, correlationMetadata, toNonEmptyString);
  if (
    entry.strictCorrelationIdEcho !== true &&
    entry.strictRequestIdentityEcho !== true
  ) {
    return echoedPayload;
  }

  if (!echoedPayload || typeof echoedPayload !== 'object' || Array.isArray(echoedPayload)) {
    return echoedPayload;
  }

  return {
    ...echoedPayload,
    correlationId:
      entry.strictCorrelationIdEcho === true
        ? correlationMetadata.correlationId
        : echoedPayload.correlationId,
    requestIdentity:
      entry.strictRequestIdentityEcho === true
        ? correlationMetadata.requestIdentity
        : echoedPayload.requestIdentity,
  };
}

function resolveOutboundEventName(entry, eventName) {
  const rewriteMap = entry.responseEventRewrite || null;
  if (!rewriteMap || typeof rewriteMap !== 'object') {
    return eventName;
  }

  return rewriteMap[eventName] || eventName;
}

function validateEmitChannel(entry, eventName, correlationMetadata) {
  if (eventName === 'invalid-session') {
    return;
  }

  const operation = toNonEmptyString(correlationMetadata?.requestIdentity?.operation);
  const expectedChannel = RESPONSE_CHANNEL_BY_OPERATION[operation];
  if (!expectedChannel || eventName === expectedChannel) {
    return;
  }

  const diagnostic = {
    type: 'socket-emit-contract-violation',
    handler: entry.handlerKey,
    requestEvent: entry.event,
    emittedEvent: eventName,
    expectedEvent: expectedChannel,
    operation,
    correlationId: correlationMetadata.correlationId,
  };
  process.stderr.write(`[socket] ${JSON.stringify(diagnostic)}\n`);
  throw new Error(
    `Response channel mismatch: operation=${operation} expected=${expectedChannel} emitted=${eventName}`
  );
}

function logEmit(entry, eventName, correlationMetadata) {
  const operation = toNonEmptyString(correlationMetadata?.requestIdentity?.operation) || 'unknown';
  const diagnostic = {
    type: 'socket-emit',
    handler: entry.handlerKey,
    requestEvent: entry.event,
    emittedEvent: eventName,
    operation,
    correlationId: correlationMetadata.correlationId,
  };
  process.stderr.write(`[socket] ${JSON.stringify(diagnostic)}\n`);
}

function createScopedSocket(entry, socket, correlationMetadata) {
  const originalEmit = socket.emit.bind(socket);

  return new Proxy(socket, {
    get(target, property, receiver) {
      if (property === 'emit') {
        return (eventName, responsePayload) => {
          const outboundEventName = resolveOutboundEventName(entry, eventName);
          validateEmitChannel(entry, outboundEventName, correlationMetadata);
          logEmit(entry, outboundEventName, correlationMetadata);
          const echoedPayload = buildEchoPayload(
            entry,
            outboundEventName,
            responsePayload,
            correlationMetadata
          );
          return originalEmit(outboundEventName, echoedPayload);
        };
      }

      const value = Reflect.get(target, property, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

// Central table for request-event to handler bindings used by server socket wiring.
const SOCKET_HANDLER_REGISTRY = [
  { event: REGISTER_EVENT, handlerKey: 'registerMessageHandler', errorLabel: 'Register' },
  { event: LOGIN_EVENT, handlerKey: 'loginMessageHandler', errorLabel: 'Login' },
  {
    event: CHARACTER_LIST_REQUEST_EVENT,
    handlerKey: 'characterListMessageHandler',
    errorLabel: 'Character list',
  },
  {
    event: CHARACTER_ADD_REQUEST_EVENT,
    handlerKey: 'characterAddMessageHandler',
    errorLabel: 'Character add',
  },
  {
    event: CHARACTER_DELETE_REQUEST_EVENT,
    handlerKey: 'characterDeleteMessageHandler',
    errorLabel: 'Character delete',
  },
  {
    event: CHARACTER_EDIT_REQUEST_EVENT,
    handlerKey: 'characterEditMessageHandler',
    errorLabel: 'Character edit',
  },
  { event: SHIP_LIST_REQUEST_EVENT, handlerKey: 'shipListMessageHandler', errorLabel: 'Ship list' },
  {
    event: SHIP_LIST_BY_OWNER_REQUEST_EVENT,
    handlerKey: 'shipListByOwnerMessageHandler',
    errorLabel: 'Ship list by owner',
  },
  {
    event: SHIP_UPSERT_REQUEST_EVENT,
    handlerKey: 'shipUpsertMessageHandler',
    errorLabel: 'Ship upsert',
  },
  {
    event: SHIP_TRANSFER_REQUEST_EVENT,
    handlerKey: 'shipTransferMessageHandler',
    errorLabel: 'Ship transfer',
  },
  { event: GAME_JOIN_REQUEST_EVENT, handlerKey: 'gameJoinMessageHandler', errorLabel: 'Game join' },
  {
    event: MISSION_UPSERT_REQUEST_EVENT,
    handlerKey: 'missionUpsertMessageHandler',
    errorLabel: 'Mission upsert',
  },
  {
    event: CELESTIAL_BODY_UPSERT_REQUEST_EVENT,
    handlerKey: 'celestialBodyUpsertMessageHandler',
    errorLabel: 'Celestial body upsert',
  },
  {
    event: CELESTIAL_BODY_LIST_REQUEST_EVENT,
    handlerKey: 'celestialBodyListMessageHandler',
    errorLabel: 'Celestial body list',
  },
  {
    event: MISSION_LIST_REQUEST_EVENT,
    handlerKey: 'missionListMessageHandler',
    errorLabel: 'Mission list',
    strictCorrelationIdEcho: true,
    strictRequestIdentityEcho: true,
  },
  {
    event: ITEM_UPSERT_REQUEST_EVENT,
    handlerKey: 'itemUpsertMessageHandler',
    errorLabel: 'Item upsert',
  },
  {
    event: ITEM_LIST_BY_CONTAINER_REQUEST_EVENT,
    handlerKey: 'itemListByContainerMessageHandler',
    errorLabel: 'Item list by container',
  },
  {
    event: ITEM_LIST_BY_LOCATION_REQUEST_EVENT,
    handlerKey: 'itemListByLocationMessageHandler',
    errorLabel: 'Item list by location',
  },
  {
    event: ITEM_REMOVE_REQUEST_EVENT,
    handlerKey: 'itemRemoveMessageHandler',
    errorLabel: 'Item remove',
  },
  {
    event: LAUNCH_ITEM_REQUEST_EVENT,
    handlerKey: 'launchItemMessageHandler',
    errorLabel: 'Launch item',
  },
  {
    event: TRACTOR_BEAM_ACTIVATE_REQUEST_EVENT,
    handlerKey: 'tractorBeamActivateMessageHandler',
    errorLabel: 'Tractor beam activate',
  },
  {
    event: MARKET_LIST_REQUEST_EVENT,
    handlerKey: 'marketListMessageHandler',
    errorLabel: 'Market list',
  },
  {
    event: MARKET_LIST_BY_LOCATION_REQUEST_EVENT,
    handlerKey: 'marketListByLocationMessageHandler',
    errorLabel: 'Market list by location',
  },
  {
    event: MARKET_QUOTE_REQUEST_EVENT,
    handlerKey: 'marketQuoteMessageHandler',
    errorLabel: 'Market quote',
  },
  {
    event: MARKET_INVENTORY_LIST_REQUEST_EVENT,
    handlerKey: 'marketInventoryListMessageHandler',
    errorLabel: 'Market inventory list',
  },
  {
    event: MARKET_LEDGER_LIST_REQUEST_EVENT,
    handlerKey: 'marketLedgerListMessageHandler',
    errorLabel: 'Market ledger list',
  },
  {
    event: MARKET_BUY_REQUEST_EVENT,
    handlerKey: 'marketBuyMessageHandler',
    errorLabel: 'Market buy',
  },
  {
    event: MARKET_SELL_REQUEST_EVENT,
    handlerKey: 'marketSellMessageHandler',
    errorLabel: 'Market sell',
  },
  {
    event: SOLAR_SYSTEM_LIST_REQUEST_EVENT,
    handlerKey: 'solarSystemListMessageHandler',
    errorLabel: 'Solar system list',
  },
  {
    event: SOLAR_SYSTEM_GET_REQUEST_EVENT,
    handlerKey: 'solarSystemGetMessageHandler',
    errorLabel: 'Solar system get',
  },
  {
    event: STAR_LIST_REQUEST_EVENT,
    handlerKey: 'starListMessageHandler',
    errorLabel: 'Star list',
  },
  {
    event: STAR_GET_REQUEST_EVENT,
    handlerKey: 'starGetMessageHandler',
    errorLabel: 'Star get',
  },
];

/**
 * Register all configured socket event handlers that are present in handlersByKey.
 * @param {import('socket.io').Socket} socket
 * @param {Record<string, { handle: Function }>} handlersByKey
 */
function registerSocketHandlers(socket, handlersByKey) {
  for (const entry of SOCKET_HANDLER_REGISTRY) {
    const handler = handlersByKey[entry.handlerKey];
    if (!handler || typeof handler.handle !== 'function') {
      continue;
    }

    socket.on(entry.event, async (payload) => {
      const correlationMetadata = resolveCorrelationMetadata(entry, payload);
      const scopedSocket = createScopedSocket(entry, socket, correlationMetadata);

      try {
        await handler.handle(scopedSocket, payload);
      } catch (error) {
        process.stderr.write(`[socket] ${entry.errorLabel} handler error: ${error.message}\n`);
      }
    });
  }
}

module.exports = {
  SOCKET_HANDLER_REGISTRY,
  registerSocketHandlers,
};
