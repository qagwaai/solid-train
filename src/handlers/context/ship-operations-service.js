'use strict';

const orbitalMath = require('./orbital-math');

function getShipPositionKm(ctx, ship) {
  return orbitalMath.getShipPositionKm(ctx, ship);
}

async function hydrateShipAsync(ctx, ship) {
  const normalizedShip = ctx.normalizeShip(ship);
  const inventoryReferences = Array.isArray(normalizedShip.inventory)
    ? normalizedShip.inventory
    : [];
  const inventoryItemIds = inventoryReferences.map((reference) => reference.itemId);
  const referencedItems = await ctx.getItemsByIdsAsync(inventoryItemIds);
  const containedItems = normalizedShip.id
    ? await ctx.getItemsByContainerAsync('ship', normalizedShip.id)
    : [];

  const itemsById = new Map();
  for (const item of containedItems) {
    itemsById.set(item.id, item);
  }
  for (const item of referencedItems) {
    itemsById.set(item.id, item);
  }

  const referencedInOrder = inventoryReferences
    .map((reference) => itemsById.get(reference.itemId) || null)
    .filter((item) => Boolean(item));

  const additionalContainedItems = containedItems.filter(
    (item) => !inventoryItemIds.includes(item.id)
  );

  return {
    ...normalizedShip,
    inventory: [...referencedInOrder, ...additionalContainedItems],
  };
}

async function hydrateShipsAsync(ctx, ships) {
  if (!Array.isArray(ships) || ships.length === 0) {
    return [];
  }

  return Promise.all(ships.map((ship) => hydrateShipAsync(ctx, ship)));
}

module.exports = {
  getShipPositionKm,
  hydrateShipAsync,
  hydrateShipsAsync,
};
