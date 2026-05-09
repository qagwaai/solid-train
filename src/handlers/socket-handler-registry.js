'use strict';

const { REGISTER_EVENT } = require('../model/register');
const { LOGIN_EVENT } = require('../model/login');
const { CHARACTER_LIST_REQUEST_EVENT } = require('../model/character-list');
const { CHARACTER_ADD_REQUEST_EVENT } = require('../model/character-add');
const { CHARACTER_DELETE_REQUEST_EVENT } = require('../model/character-delete');
const { CHARACTER_EDIT_REQUEST_EVENT } = require('../model/character-edit');
const { SHIP_LIST_REQUEST_EVENT } = require('../model/ship-list');
const { SHIP_UPSERT_REQUEST_EVENT } = require('../model/ship-upsert');
const { GAME_JOIN_REQUEST_EVENT } = require('../model/game-join');
const { MISSION_UPSERT_REQUEST_EVENT } = require('../model/mission-upsert');
const { CELESTIAL_BODY_UPSERT_REQUEST_EVENT } = require('../model/celestial-body-upsert');
const { CELESTIAL_BODY_LIST_REQUEST_EVENT } = require('../model/celestial-body-list');
const { MISSION_LIST_REQUEST_EVENT } = require('../model/mission-list');
const { ITEM_UPSERT_REQUEST_EVENT } = require('../model/item-upsert');
const { ITEM_LIST_BY_CONTAINER_REQUEST_EVENT } = require('../model/item-list-by-container');
const { ITEM_LIST_BY_LOCATION_REQUEST_EVENT } = require('../model/item-list-by-location');
const { LAUNCH_ITEM_REQUEST_EVENT } = require('../model/launch-item');
const { MARKET_LIST_REQUEST_EVENT } = require('../model/market-list');
const { MARKET_LIST_BY_LOCATION_REQUEST_EVENT } = require('../model/market-list-by-location');
const { MARKET_QUOTE_REQUEST_EVENT } = require('../model/market-quote');
const { MARKET_INVENTORY_LIST_REQUEST_EVENT } = require('../model/market-inventory-list');
const { MARKET_LEDGER_LIST_REQUEST_EVENT } = require('../model/market-ledger-list');
const { MARKET_BUY_REQUEST_EVENT } = require('../model/market-buy');
const { MARKET_SELL_REQUEST_EVENT } = require('../model/market-sell');

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
    event: SHIP_UPSERT_REQUEST_EVENT,
    handlerKey: 'shipUpsertMessageHandler',
    errorLabel: 'Ship upsert',
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
    event: LAUNCH_ITEM_REQUEST_EVENT,
    handlerKey: 'launchItemMessageHandler',
    errorLabel: 'Launch item',
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

    socket.on(entry.event, (payload) => {
      handler.handle(socket, payload).catch((error) => {
        process.stderr.write(`[socket] ${entry.errorLabel} handler error: ${error.message}\n`);
      });
    });
  }
}

module.exports = {
  SOCKET_HANDLER_REGISTRY,
  registerSocketHandlers,
};
