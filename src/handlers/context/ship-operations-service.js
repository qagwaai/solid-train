'use strict';

const orbitalMath = require('./orbital-math');
const { buildBackfilledSubsystemItems } = require('./starter-subsystem-items');

function getShipPositionKm(ctx, ship) {
  return orbitalMath.getShipPositionKm(ctx, ship);
}

async function hydrateShipAsync(ctx, ship, options = {}) {
  const normalizedShip = ctx.normalizeShip(ship);
  const inventoryReferences = Array.isArray(normalizedShip.inventory)
    ? normalizedShip.inventory
    : [];
  const inventoryItemIds = inventoryReferences.map((reference) => reference.itemId);
  const referencedItems = await ctx.getItemsByIdsAsync(inventoryItemIds);
  const containedItems = normalizedShip.id
    ? await ctx.getItemsByContainerAsync('ship', normalizedShip.id, {
        ship: normalizedShip,
        playerName: options.playerName,
        characterId: options.characterId,
        owningPlayerId: options.owningPlayerId,
        owningCharacterId: options.owningCharacterId,
      })
    : [];

  const backfilledItems = buildBackfilledSubsystemItems(ctx, normalizedShip, [
    ...referencedItems,
    ...containedItems,
  ], {
    playerName: options.playerName,
    characterId: options.characterId,
    owningPlayerId: options.owningPlayerId,
    owningCharacterId: options.owningCharacterId,
  });

  const itemsById = new Map();
  for (const item of containedItems) {
    itemsById.set(item.id, item);
  }
  for (const item of referencedItems) {
    itemsById.set(item.id, item);
  }
  for (const item of backfilledItems) {
    itemsById.set(item.id, item);
  }

  const referencedInOrder = inventoryReferences
    .map((reference) => itemsById.get(reference.itemId) || null)
    .filter((item) => Boolean(item));

  const additionalContainedItems = [...containedItems, ...backfilledItems].filter(
    (item) => !inventoryItemIds.includes(item.id)
  );

  return {
    ...normalizedShip,
    inventory: [...referencedInOrder, ...additionalContainedItems],
  };
}

async function hydrateShipsAsync(ctx, ships, options = {}) {
  if (!Array.isArray(ships) || ships.length === 0) {
    return [];
  }

  return Promise.all(ships.map((ship) => hydrateShipAsync(ctx, ship, options)));
}

module.exports = {
  getShipPositionKm,
  hydrateShipAsync,
  hydrateShipsAsync,
};
