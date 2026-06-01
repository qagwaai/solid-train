'use strict';

const orbitalMath = require('./orbital-math');
const { ITEM_STATE, ITEM_CONTAINER_TYPE } = require('../../model/canonical-items');
const {
  STARTER_DRONE_ITEM_TYPE,
  COLD_BOOT_STARTER_SUBSYSTEMS,
  buildBackfilledSubsystemItems,
  buildBackfilledStarterDroneItems,
  isStarterPodShip,
  isColdBootStarterShip,
} = require('./starter-subsystem-items');
const { DEFAULT_STARTER_MISSION_ID } = require('../../model/mission');

const COLD_BOOT_STARTER_SUBSYSTEM_ITEM_TYPES = new Set(
  COLD_BOOT_STARTER_SUBSYSTEMS.map((subsystem) => subsystem.itemType)
);
const STARTER_DRONE_REQUIRED_MISSION_STATUSES = new Set([
  'available',
  'active',
]);

function isProjectedShipInventoryItem(shipId, item) {
  if (!shipId || !item) {
    return false;
  }

  if (item.state === ITEM_STATE.DESTROYED) {
    return false;
  }

  return (
    item.container?.containerType === ITEM_CONTAINER_TYPE.SHIP &&
    item.container?.containerId === shipId
  );
}

function getShipPositionKm(ctx, ship) {
  return orbitalMath.getShipPositionKm(ctx, ship);
}

async function shouldRecoverStarterDroneForMission(ctx, ship, options = {}) {
  if (!isStarterPodShip(ctx, ship)) {
    return false;
  }

  const playerName = ctx.toNonEmptyString(options.playerName);
  const characterId = ctx.toNonEmptyString(options.characterId);
  if (!playerName || !characterId) {
    return false;
  }

  const missions = await ctx.getMissionsAsync(playerName, characterId);
  const starterMission = Array.isArray(missions)
    ? missions.find((mission) => ctx.toNonEmptyString(mission?.missionId) === DEFAULT_STARTER_MISSION_ID)
    : null;
  const starterMissionStatus = ctx.toNonEmptyString(starterMission?.status);

  return Boolean(starterMissionStatus) && STARTER_DRONE_REQUIRED_MISSION_STATUSES.has(starterMissionStatus);
}

async function hydrateShipAsync(ctx, ship, options = {}) {
  const normalizedShip = ctx.normalizeShip(ship);
  const starterDroneCanonicalId = normalizedShip.id ? `${normalizedShip.id}-item-1` : null;
  const inventoryReferences = Array.isArray(normalizedShip.inventory)
    ? normalizedShip.inventory
    : [];
  const inventoryItemIds = inventoryReferences.map((reference) => reference.itemId);
  const referencedItems = await ctx.getItemsByIdsAsync(inventoryItemIds);
  const historicalStarterItems = starterDroneCanonicalId
    ? await ctx.getItemsByIdsAsync([starterDroneCanonicalId])
    : [];
  const containedItems = normalizedShip.id
    ? await ctx.getItemsByContainerAsync(ITEM_CONTAINER_TYPE.SHIP, normalizedShip.id, {
        ship: normalizedShip,
        playerName: options.playerName,
        characterId: options.characterId,
        owningPlayerId: options.owningPlayerId,
        owningCharacterId: options.owningCharacterId,
      })
    : [];

  const backfilledSubsystemItems = buildBackfilledSubsystemItems(
    ctx,
    normalizedShip,
    [...referencedItems, ...containedItems],
    {
      playerName: options.playerName,
      characterId: options.characterId,
      owningPlayerId: options.owningPlayerId,
      owningCharacterId: options.owningCharacterId,
    }
  );
  const shouldRecoverStarterDrone = await shouldRecoverStarterDroneForMission(
    ctx,
    normalizedShip,
    options
  );
  const backfilledStarterDroneItems = shouldRecoverStarterDrone
    ? buildBackfilledStarterDroneItems(
        ctx,
        normalizedShip,
        [
          ...referencedItems,
          ...historicalStarterItems,
          ...containedItems,
          ...backfilledSubsystemItems,
        ],
        {
          playerName: options.playerName,
          characterId: options.characterId,
          owningPlayerId: options.owningPlayerId,
          owningCharacterId: options.owningCharacterId,
        }
      )
    : [];
  const backfilledItems = [...backfilledSubsystemItems, ...backfilledStarterDroneItems];

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
  const additionalStarterContainedItems = containedItems.filter((item) => {
    if (inventoryItemIds.includes(item.id)) {
      return false;
    }

    const itemType = ctx.toNonEmptyString(item?.itemType);
    const isRecoverableStarterItem =
      COLD_BOOT_STARTER_SUBSYSTEM_ITEM_TYPES.has(itemType) ||
      (itemType === STARTER_DRONE_ITEM_TYPE && shouldRecoverStarterDrone);

    return isRecoverableStarterItem && isProjectedShipInventoryItem(normalizedShip.id, item);
  });

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
