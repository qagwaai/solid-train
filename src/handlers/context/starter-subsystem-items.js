'use strict';

const {
  ITEM_STATE,
  ITEM_DAMAGE_STATUS,
  ITEM_CONTAINER_TYPE,
} = require('../../model/canonical-items');

const COLD_BOOT_STARTER_MODELS = new Set(['scavenger pod', 'scavenger-pod']);
const COLD_BOOT_ORIGIN = 'cold-boot-scripted';

const COLD_BOOT_STARTER_SUBSYSTEMS = [
  {
    itemType: 'propulsion-manifold',
    displayName: 'Propulsion Manifold',
  },
  {
    itemType: 'sensor-array',
    displayName: 'Sensor Array',
  },
  {
    itemType: 'power-distribution-bus',
    displayName: 'Power Distribution Bus',
  },
  {
    itemType: 'ship-tractor-beam',
    displayName: 'Tractor Beam',
  },
];

function isColdBootStarterShip(ctx, ship) {
  const normalizedModel = ctx.toNonEmptyString(ship?.model).toLowerCase();
  const normalizedOrigin = ctx.toNonEmptyString(ship?.damageProfile?.origin).toLowerCase();

  return COLD_BOOT_STARTER_MODELS.has(normalizedModel) && normalizedOrigin === COLD_BOOT_ORIGIN;
}

function resolveOwningPlayerId(ctx, options, existingItems) {
  const fromOptions = ctx.toNonEmptyString(options?.owningPlayerId);
  if (fromOptions) {
    return fromOptions;
  }

  const fromPlayerName = ctx.toNonEmptyString(options?.playerName);
  if (fromPlayerName) {
    return fromPlayerName;
  }

  const fromExisting = Array.isArray(existingItems)
    ? existingItems
        .map((item) => ctx.toNonEmptyString(item?.owningPlayerId))
        .find((value) => Boolean(value))
    : null;

  return fromExisting || null;
}

function resolveOwningCharacterId(ctx, options, existingItems) {
  const fromOptions = ctx.toNonEmptyString(options?.owningCharacterId);
  if (fromOptions) {
    return fromOptions;
  }

  const fromCharacterId = ctx.toNonEmptyString(options?.characterId);
  if (fromCharacterId) {
    return fromCharacterId;
  }

  const fromExisting = Array.isArray(existingItems)
    ? existingItems
        .map((item) => ctx.toNonEmptyString(item?.owningCharacterId))
        .find((value) => Boolean(value))
    : null;

  return fromExisting || null;
}

function buildBackfilledSubsystemItems(ctx, ship, existingItems, options = {}) {
  if (!ship?.id || !isColdBootStarterShip(ctx, ship)) {
    return [];
  }

  const existingByType = new Set(
    (Array.isArray(existingItems) ? existingItems : [])
      .map((item) => ctx.toNonEmptyString(item?.itemType))
      .filter((itemType) => Boolean(itemType))
  );

  const owningPlayerId = resolveOwningPlayerId(ctx, options, existingItems);
  const owningCharacterId = resolveOwningCharacterId(ctx, options, existingItems);
  const createdAt = ctx.toNonEmptyString(ship.createdAt) || ctx.getCurrentTimestamp();
  const updatedAt = createdAt;

  const missingSubsystems = COLD_BOOT_STARTER_SUBSYSTEMS.filter(
    (subsystem) => !existingByType.has(subsystem.itemType)
  );

  return missingSubsystems.map((subsystem) =>
    ctx.normalizeItem({
      id: `${ship.id}-starter-${subsystem.itemType}`,
      itemType: subsystem.itemType,
      displayName: subsystem.displayName,
      launchable: false,
      state: ITEM_STATE.CONTAINED,
      damageStatus: ITEM_DAMAGE_STATUS.DAMAGED,
      container: {
        containerType: ITEM_CONTAINER_TYPE.SHIP,
        containerId: ship.id,
      },
      owningPlayerId,
      owningCharacterId,
      spatial: null,
      createdAt,
      updatedAt,
      destroyedAt: null,
      destroyedReason: null,
    })
  );
}

module.exports = {
  COLD_BOOT_STARTER_SUBSYSTEMS,
  isColdBootStarterShip,
  buildBackfilledSubsystemItems,
};
