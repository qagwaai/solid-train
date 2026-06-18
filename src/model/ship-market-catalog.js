'use strict';

const DEFAULT_SHIP_BASE_RATE_PER_TIER = 500;

const SHIP_MARKET_CATALOG = Object.freeze([
  Object.freeze({
    itemId: 'scavenger-pod',
    shipModel: 'Scavenger Pod',
    displayName: 'Scavenger Pod',
    tier: 1,
    baseRatePerTier: DEFAULT_SHIP_BASE_RATE_PER_TIER,
    starterInventory: Object.freeze([
      Object.freeze({
        itemType: 'expendable-dart-drone',
        displayName: 'Expendable Dart Drone',
        tier: 1,
        quantity: 2,
        launchable: true,
      }),
      Object.freeze({
        itemType: 'propulsion-manifold',
        displayName: 'Propulsion Manifold',
        tier: 1,
        quantity: 1,
        launchable: false,
      }),
      Object.freeze({
        itemType: 'sensor-array',
        displayName: 'Sensor Array',
        tier: 1,
        quantity: 1,
        launchable: false,
      }),
      Object.freeze({
        itemType: 'power-distribution-bus',
        displayName: 'Power Distribution Bus',
        tier: 1,
        quantity: 1,
        launchable: false,
      }),
      Object.freeze({
        itemType: 'ship-tractor-beam',
        displayName: 'Tractor Beam',
        tier: 1,
        quantity: 1,
        launchable: false,
      }),
    ]),
  }),
]);

const SHIP_MARKET_CATALOG_BY_ID = new Map(
  SHIP_MARKET_CATALOG.map((entry) => [entry.itemId, entry])
);

function computeShipListingUnitPrice(entry) {
  const tier = Number.isInteger(entry?.tier) && entry.tier > 0 ? entry.tier : 1;
  const baseRate =
    Number.isFinite(entry?.baseRatePerTier) && entry.baseRatePerTier > 0
      ? entry.baseRatePerTier
      : DEFAULT_SHIP_BASE_RATE_PER_TIER;

  return tier * baseRate;
}

function buildDefaultShipListings(asOfTimestamp) {
  const createdAt =
    typeof asOfTimestamp === 'string' && asOfTimestamp.trim()
      ? asOfTimestamp.trim()
      : new Date().toISOString();

  return SHIP_MARKET_CATALOG.map((entry) => ({
    listingId: `seed-ship-${entry.itemId}`,
    itemId: entry.itemId,
    shipModel: entry.shipModel,
    displayName: entry.displayName,
    tier: entry.tier,
    unitPrice: computeShipListingUnitPrice(entry),
    quantityAvailable: 1,
    status: 'available',
    starterInventory: entry.starterInventory.map((inventoryEntry) => ({
      itemType: inventoryEntry.itemType,
      displayName: inventoryEntry.displayName,
      tier: Number.isInteger(inventoryEntry.tier) && inventoryEntry.tier > 0 ? inventoryEntry.tier : 1,
      quantity: inventoryEntry.quantity,
      launchable: inventoryEntry.launchable,
    })),
    createdAt,
  }));
}

module.exports = {
  DEFAULT_SHIP_BASE_RATE_PER_TIER,
  SHIP_MARKET_CATALOG,
  SHIP_MARKET_CATALOG_BY_ID,
  computeShipListingUnitPrice,
  buildDefaultShipListings,
};
