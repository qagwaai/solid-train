'use strict';

const marketService = require('./market-service');

async function getCharacterTradeItemsAsync(ctx, playerName, characterId, itemId) {
  return marketService.getCharacterTradeItemsAsync(ctx, playerName, characterId, itemId);
}

async function applyMarketStockDeltaAsync(ctx, marketId, solarSystemId, itemId, delta) {
  return marketService.applyMarketStockDeltaAsync(ctx, marketId, solarSystemId, itemId, delta);
}

async function appendCharacterLedgerEntryAsync(ctx, playerName, characterId, entry) {
  return marketService.appendCharacterLedgerEntryAsync(ctx, playerName, characterId, entry);
}

async function appendMarketLedgerEntryAsync(ctx, marketId, solarSystemId, entry) {
  return marketService.appendMarketLedgerEntryAsync(ctx, marketId, solarSystemId, entry);
}

async function addTradeItemToCharacterAsync(ctx, player, character, itemId, quantity) {
  return marketService.addTradeItemToCharacterAsync(ctx, player, character, itemId, quantity);
}

async function removeTradeItemFromCharacterAsync(ctx, playerName, characterId, itemId, quantity) {
  return marketService.removeTradeItemFromCharacterAsync(
    ctx,
    playerName,
    characterId,
    itemId,
    quantity
  );
}

async function executeMarketTransactionAsync(ctx, request = {}) {
  return marketService.executeMarketTransactionAsync(ctx, request);
}

module.exports = {
  getCharacterTradeItemsAsync,
  applyMarketStockDeltaAsync,
  appendCharacterLedgerEntryAsync,
  appendMarketLedgerEntryAsync,
  addTradeItemToCharacterAsync,
  removeTradeItemFromCharacterAsync,
  executeMarketTransactionAsync,
};
