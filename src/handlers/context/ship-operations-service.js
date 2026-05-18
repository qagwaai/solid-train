'use strict';

const orbitalMath = require('./orbital-math');
const {
  COLD_BOOT_STARTER_SUBSYSTEMS,
  buildBackfilledSubsystemItems,
} = require('./starter-subsystem-items');

const COLD_BOOT_STARTER_SUBSYSTEM_ITEM_TYPES = new Set(
  COLD_BOOT_STARTER_SUBSYSTEMS.map((subsystem) => subsystem.itemType)
);

function isProjectedShipInventoryItem(shipId, item) {
  if (!shipId || !item) {
    return false;
  }

  if (item.state === 'destroyed') {
    return false;
  }

  return item.container?.containerType === 'ship' && item.container?.containerId === shipId;
}

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
    .filter((item) => isProjectedShipInventoryItem(normalizedShip.id, item));

  const additionalBackfilledItems = backfilledItems.filter(
    (item) =>
      !inventoryItemIds.includes(item.id) && isProjectedShipInventoryItem(normalizedShip.id, item)
  );
  const additionalStarterContainedItems = containedItems.filter(
    (item) =>
      !inventoryItemIds.includes(item.id) &&
      COLD_BOOT_STARTER_SUBSYSTEM_ITEM_TYPES.has(item.itemType) &&
      isProjectedShipInventoryItem(normalizedShip.id, item)
  );

  const projectedInventory = [
    ...referencedInOrder,
    ...additionalStarterContainedItems,
    ...additionalBackfilledItems,
  ];
  const containedItemIds = containedItems.map((item) => item.id);
  const backfilledItemIds = backfilledItems.map((item) => item.id);
  const unreferencedContainedItemIds = containedItemIds.filter(
    (itemId) => !inventoryItemIds.includes(itemId)
  );

  ctx.log(
    `[ship-list-diag] correlationId=${ctx.toNonEmptyString(options.correlationId) || '-'} player=${ctx.toNonEmptyString(options.playerName) || '-'} characterId=${ctx.toNonEmptyString(options.characterId) || '-'} shipId=${normalizedShip.id || '-'} inventoryRefIds=${inventoryItemIds.join(',') || '-'} containedItemIds=${containedItemIds.join(',') || '-'} unreferencedContainedItemIds=${unreferencedContainedItemIds.join(',') || '-'} backfilledItemIds=${backfilledItemIds.join(',') || '-'} projectedItemIds=${projectedInventory.map((item) => item.id).join(',') || '-'}`
  );

  return {
    ...normalizedShip,
    inventory: projectedInventory,
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
