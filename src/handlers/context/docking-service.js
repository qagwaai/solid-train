'use strict';

const MARKET_DOCKING_DISTANCE_KM = 50;

async function resolveDockingStateAsync(ctx, request = {}) {
  const playerName = ctx.toNonEmptyString(request.playerName);
  const characterId = ctx.toNonEmptyString(request.characterId);
  const shipId = ctx.toNonEmptyString(request.shipId);
  const markets = Array.isArray(request.markets) ? request.markets : [];

  if (!playerName || !characterId || markets.length === 0) {
    return {
      isDocked: false,
      dockedMarketId: null,
      perMarketDocked: new Map()
    };
  }

  const character = ctx.findCharacter(playerName, characterId);
  if (!character) {
    return {
      isDocked: false,
      dockedMarketId: null,
      perMarketDocked: new Map()
    };
  }

  const ships = Array.isArray(character.ships) ? character.ships : [];
  const ship = shipId
    ? ships.find((candidate) => ctx.toNonEmptyString(candidate?.id) === shipId) || null
    : ships[0] || null;
  const shipPositionKm = ctx.getShipPositionKm(ship);
  if (!shipPositionKm) {
    return {
      isDocked: false,
      dockedMarketId: null,
      perMarketDocked: new Map()
    };
  }

  const nearestDock = markets
    .filter((market) => Boolean(market.positionKm))
    .map((market) => ({
      marketId: market.marketId,
      distanceKm: ctx.calculateDistanceKm(shipPositionKm, market.positionKm)
    }))
    .filter((entry) => entry.distanceKm <= MARKET_DOCKING_DISTANCE_KM)
    .sort((left, right) => left.distanceKm - right.distanceKm)[0] || null;

  const dockedMarketId = nearestDock ? nearestDock.marketId : null;
  const perMarketDocked = new Map(
    markets.map((market) => [market.marketId, market.marketId === dockedMarketId])
  );

  return {
    isDocked: Boolean(dockedMarketId),
    dockedMarketId,
    perMarketDocked
  };
}

module.exports = {
  resolveDockingStateAsync
};
